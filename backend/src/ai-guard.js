/**
 * Circuit breaker and bulkhead for calls to the AI provider.
 *
 * Circuit breaker: after `failureThreshold` provider failures in a row, stop
 * calling the provider for `cooldownMs` and fail fast instead of making every
 * user wait for a timeout. After the cool-down, one trial call is let through
 * (half-open): success closes the circuit, failure opens it again.
 *
 * Bulkhead: at most `maxConcurrent` AI calls run at once, so a burst of slow
 * AI requests cannot pile up sockets and memory or trip the provider's own rate
 * limit, and the rest of the API keeps answering.
 *
 * Both checks run before the AI budget is charged, so a rejected request costs
 * the user nothing.
 */
export const AI_OUTCOME = Object.freeze({ success: 'success', failure: 'failure', neutral: 'neutral' });

// Codes that mean the provider itself is down or refusing us.
const providerFailureCodes = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_ERROR']);
// A reply arrived, even if unusable: the provider is up.
const providerUpCodes = new Set(['INVALID_PROVIDER_RESPONSE']);

/** Map a provider error code (or null for success) to what it says about the provider's health. */
export function providerOutcome(code) {
  if (code === null || code === undefined || providerUpCodes.has(code)) return AI_OUTCOME.success;
  return providerFailureCodes.has(code) ? AI_OUTCOME.failure : AI_OUTCOME.neutral;
}

export function createAiGuard({
  failureThreshold = 3,
  cooldownMs = 30_000,
  maxConcurrent = 4,
  busyRetryAfterSeconds = 5,
  now = Date.now,
  logger = console,
} = {}) {
  let state = 'closed';
  let stateVersion = 0;
  let consecutiveFailures = 0;
  let openedAt = 0;
  let inFlight = 0;
  let trialInFlight = false;

  const transition = (to, requestId) => {
    if (state === to) return;
    logger?.info?.(JSON.stringify({ event: 'ai_circuit', requestId: requestId ?? null, from: state, to, consecutiveFailures }));
    state = to;
    stateVersion += 1;
  };

  return {
    /**
     * Ask to start one AI call. Returns `{ allowed: true, finish(outcome) }`, or
     * `{ allowed: false, code, retryAfterSeconds }` when the call must not run.
     * Call `finish` exactly once with an `AI_OUTCOME` value.
     */
    admit(requestId) {
      if (state === 'open') {
        const remaining = openedAt + cooldownMs - now();
        if (remaining > 0) {
          return { allowed: false, code: 'AI_UNAVAILABLE', retryAfterSeconds: Math.ceil(remaining / 1000) };
        }
        transition('half_open', requestId);
      }
      if (state === 'half_open' && trialInFlight) {
        return { allowed: false, code: 'AI_UNAVAILABLE', retryAfterSeconds: Math.ceil(cooldownMs / 1000) };
      }
      if (inFlight >= maxConcurrent) {
        return { allowed: false, code: 'AI_BUSY', retryAfterSeconds: busyRetryAfterSeconds };
      }
      const trial = state === 'half_open';
      const admittedVersion = stateVersion;
      if (trial) trialInFlight = true;
      inFlight += 1;
      let finished = false;
      return {
        allowed: true,
        trial,
        finish(outcome) {
          if (finished) return;
          finished = true;
          inFlight -= 1;
          // Calls from an earlier state release their slot without changing provider health.
          if (admittedVersion !== stateVersion) return;
          if (trial) trialInFlight = false;
          if (outcome === AI_OUTCOME.success) {
            consecutiveFailures = 0;
            transition('closed', requestId);
          } else if (outcome === AI_OUTCOME.failure) {
            consecutiveFailures += 1;
            if (trial || consecutiveFailures >= failureThreshold) {
              openedAt = now();
              transition('open', requestId);
            }
          }
          // Neutral (not configured, budget refused, our own bug): no change; a
          // half-open trial slot is simply freed for the next request.
        },
      };
    },
    /** Current state for health and metrics; contains no request data. */
    snapshot() {
      return { state, consecutiveFailures, inFlight, maxConcurrent };
    },
  };
}
