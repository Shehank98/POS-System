/**
 * Simple in-memory rate limiter for login endpoints.
 * Limits each IP to 20 login attempts per 15-minute window.
 * Uses a Map so it resets automatically on process restart (acceptable for this use case).
 * If express-rate-limit is installed it uses that; otherwise falls back to this implementation.
 */

const WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const MAX_HITS   = 20;

// Attempt to use express-rate-limit if it's installed (added to package.json)
let rateLimitMiddleware = null;
try {
  const rateLimit = require('express-rate-limit');
  rateLimitMiddleware = rateLimit({
    windowMs:         WINDOW_MS,
    max:              MAX_HITS,
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          { error: 'Too many login attempts. Please try again in 15 minutes.' },
    skip:             () => process.env.NODE_ENV === 'test',
  });
  console.log('[RateLimit] express-rate-limit loaded for login endpoints');
} catch {
  // Package not installed yet — use built-in fallback
  console.log('[RateLimit] express-rate-limit not found — using built-in IP limiter');
}

// Built-in fallback: map of ip → { count, resetAt }
const attempts = new Map();

function builtInLimiter(req, res, next) {
  // Skip in test environments
  if (process.env.NODE_ENV === 'test') return next();

  const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(ip, entry);
  }

  entry.count++;

  if (entry.count > MAX_HITS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    res.setHeader('X-RateLimit-Limit', MAX_HITS);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
  }

  res.setHeader('X-RateLimit-Limit', MAX_HITS);
  res.setHeader('X-RateLimit-Remaining', MAX_HITS - entry.count);
  next();
}

module.exports = rateLimitMiddleware || builtInLimiter;
