import { createRemoteJWKSet, errors, jwtVerify } from 'jose';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createNeonTokenVerifier(env = process.env) {
  const baseValue = env.NEON_AUTH_BASE_URL;
  if (!baseValue) throw new Error('Set NEON_AUTH_BASE_URL to the Neon Auth URL.');

  let baseUrl;
  try {
    baseUrl = new URL(baseValue);
  } catch {
    throw new Error('NEON_AUTH_BASE_URL must be a valid URL.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname);
  if (!['https:', ...(local ? ['http:'] : [])].includes(baseUrl.protocol)) {
    throw new Error('NEON_AUTH_BASE_URL must use HTTPS except on localhost.');
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('NEON_AUTH_BASE_URL must not contain credentials, query, or fragment.');
  }

  const jwksUrl = env.NEON_AUTH_JWKS_URL || new URL(
    `${baseUrl.pathname.replace(/\/+$/, '')}/.well-known/jwks.json`,
    baseUrl.origin,
  ).toString();
  let parsedJwksUrl;
  try {
    parsedJwksUrl = new URL(jwksUrl);
  } catch {
    throw new Error('NEON_AUTH_JWKS_URL must be a valid URL.');
  }
  if (!['https:', ...(local ? ['http:'] : [])].includes(parsedJwksUrl.protocol)) {
    throw new Error('NEON_AUTH_JWKS_URL must use HTTPS except on localhost.');
  }

  const jwks = createRemoteJWKSet(parsedJwksUrl);
  return createTokenVerifier(jwks, baseUrl.origin);
}

export function createTokenVerifier(jwks, issuer) {
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      algorithms: ['EdDSA'],
    });
    if (typeof payload.sub !== 'string' || !uuid.test(payload.sub)
      || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      throw new Error('Token must contain a valid user ID and expiration.');
    }
    return payload.sub;
  };
}

export function requireUser(verifyToken, logger = console) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match) {
      return res.status(401).json({
        error: { code: 'MISSING_BEARER_TOKEN', message: 'A bearer token is required.' },
      });
    }
    try {
      req.userId = await verifyToken(match[1]);
      if (typeof req.userId !== 'string' || !uuid.test(req.userId)) {
        throw new Error('Token subject is not a valid user ID.');
      }
      next();
    } catch (error) {
      if (error instanceof TypeError || error instanceof errors.JWKSTimeout) {
        logger.error({
          requestId: req.requestId,
          event: 'auth_verification_unavailable',
          type: error.name,
        });
        return res.status(503).json({
          error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable.' },
        });
      }
      res.status(401).json({
        error: { code: 'INVALID_BEARER_TOKEN', message: 'The bearer token is invalid or was issued by a different Auth branch.' },
      });
    }
  };
}
