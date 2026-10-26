import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const authConfigured = Boolean(import.meta.env.VITE_NEON_AUTH_URL);
export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL || 'http://localhost:3000/auth-not-configured',
  {
    adapter: BetterAuthReactAdapter({
      fetchOptions: { credentials: 'include' },
    }),
  },
);

export async function sessionHeaders(): Promise<Record<string, string>> {
  let token: string | undefined;
  try {
    const result = await authClient.token();
    if (!result.error && isJwt(result.data?.token)) token = result.data.token;
  } catch {
    // Fall through to the session response, which also carries the signed JWT.
  }

  if (!token) {
    const result = await authClient.getSession();
    if (!result.error) {
      const session = result.data?.session as { token?: string } | null | undefined;
      if (isJwt(session?.token)) token = session.token;
    }
  }

  if (!token) {
    throw new Error('Your session has no usable JWT. Sign out and sign in again.');
  }
  return { Authorization: `Bearer ${token}` };
}

function isJwt(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 3;
}
