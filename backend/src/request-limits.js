import { isIP, SocketAddress } from 'node:net';

const trackedKeysPerWindow = 50_000;
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const healthPath = /^\/health(?:\/ready)?\/?$/i;

function fixedWindow(limit, windowMs, now) {
  const counts = new Map();
  let resetsAt = 0;
  return key => {
    const currentTime = now();
    if (currentTime >= resetsAt) {
      counts.clear();
      resetsAt = currentTime + windowMs;
    }
    const count = counts.get(key) ?? 0;
    if (count >= limit || (count === 0 && counts.size >= trackedKeysPerWindow)) {
      return Math.ceil((resetsAt - currentTime) / 1000);
    }
    counts.set(key, count + 1);
    return 0;
  };
}

function clientKey(req, renderPublicIngress) {
  const edgeIp = renderPublicIngress ? req.get('CF-Connecting-IP') : undefined;
  const forwardedIp = isIP(edgeIp) ? edgeIp : req.ip;
  const ip = isIP(forwardedIp) ? forwardedIp : req.socket.remoteAddress;
  const family = isIP(ip);
  if (!family) return 'unknown';
  const { address } = new SocketAddress({ address: ip, family: family === 6 ? 'ipv6' : 'ipv4' });
  return address.replace(/^::ffff:(?=\d+\.)/, '');
}

function finishLimit(res, next, retryAfter) {
  if (retryAfter === 0) return next();
  return res.set('Retry-After', String(retryAfter)).set('Cache-Control', 'no-store').status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  });
}

export function createRequestLimits({
  ipLimit = 120,
  writeLimit = 30,
  uploadLimit = 10,
  windowMs = 60_000,
  now = () => performance.now(),
  renderPublicIngress = false,
} = {}) {
  const consumeIp = fixedWindow(ipLimit, windowMs, now);
  const consumeWrite = fixedWindow(writeLimit, windowMs, now);
  const consumeUpload = fixedWindow(uploadLimit, windowMs, now);
  return {
    byIp(req, res, next) {
      if ((req.method === 'GET' || req.method === 'HEAD') && healthPath.test(req.path)) return next();
      return finishLimit(res, next, consumeIp(clientKey(req, renderPublicIngress)));
    },
    write(req, res, next) {
      if (!writeMethods.has(req.method)) return next();
      return finishLimit(res, next, consumeWrite(req.userId.toLowerCase()));
    },
    upload(req, res, next) {
      return finishLimit(res, next, consumeUpload(req.userId.toLowerCase()));
    },
  };
}
