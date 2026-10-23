import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getSetupStatus,
  testDatabase,
  saveDatabase,
  completeSetup,
  saveAccessMode,
} from '../services/setup.js';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import config from '../config/app.js';
import { cookieOptions, verifyToken } from '../services/auth.js';
import { getUserAccess } from '../services/rbac.js';
import { assertSetupAllowed, hasValidSetupToken, requireSetupToken, setupTokenConfigured } from '../middleware/setupGuard.js';

const router = Router();

/*
 * The last step (access mode) runs after the administrator exists, so it must
 * come from whoever created that administrator — not from anyone who finds the
 * half-finished wizard. /complete hands its browser a short signed grant (an
 * httpOnly cookie for /api/setup only); a signed-in superadministrator or a
 * valid SETUP_TOKEN also pass. The key lives in memory: after a restart the
 * administrator signs in (or uses SETUP_TOKEN) to finish.
 */
const GRANT_COOKIE = 'da_setup';
const GRANT_TTL_MS = 60 * 60 * 1000;
const grantKey = randomBytes(32);
const grantSignature = (body) => createHmac('sha256', grantKey).update(body).digest('base64url');

function grantFor(userId) {
  const body = `${userId}.${Date.now() + GRANT_TTL_MS}`;
  return `${body}.${grantSignature(body)}`;
}

function validGrant(value) {
  const [userId, expires, signature] = String(value || '').split('.');
  if (!userId || !expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(grantSignature(`${userId}.${expires}`));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function isSuperadminSession(req) {
  const token = req.cookies?.[config.auth.cookieName];
  if (!token) return false;
  try {
    const userId = Number(verifyToken(token).sub);
    return Number.isInteger(userId) && (await getUserAccess(userId)).permissions.includes('*');
  } catch {
    return false;
  }
}

async function requireSetupOwner(req, res, next) {
  try {
    if (!req.setupStatus?.hasAdmin) return next();
    if (setupTokenConfigured() && hasValidSetupToken(req)) return next();
    if (validGrant(req.cookies?.[GRANT_COOKIE]) || (await isSuperadminSession(req))) return next();
    return res.status(403).json({
      success: false,
      code: 'SETUP_OWNER_REQUIRED',
      error: 'Only the administrator who started the setup can finish it. Sign in as that administrator or use SETUP_TOKEN.',
    });
  } catch (err) {
    return next(err);
  }
}

const grantCookieOptions = (req) => ({ ...cookieOptions(req), sameSite: 'strict', path: '/api/setup', maxAge: GRANT_TTL_MS });

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many setup attempts. Try again later.' },
});

// Only the write endpoints are throttled hard. The SPA reads /status on every
// page load, so limiting it would bounce real users into the wizard.
router.get('/status', async (req, res, next) => {
  try {
    const status = await getSetupStatus();
    const tokenRequired = setupTokenConfigured();
    const allowed = hasValidSetupToken(req);
    if (tokenRequired && !allowed) {
      return res.json({
        success: true,
        needsSetup: status.needsSetup,
        step: status.step,
        setupTokenRequired: true,
      });
    }
    res.json({ success: true, setupTokenRequired: tokenRequired, ...status });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/test-db',
  setupLimiter,
  requireSetupToken,
  assertSetupAllowed,
  async (req, res, next) => {
    try {
      const result = await testDatabase(req.body);
      if (!result.ok) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Connection failed',
        });
      }

      res.json({
        success: true,
        database: result.database,
        version: result.version,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/database',
  setupLimiter,
  requireSetupToken,
  assertSetupAllowed,
  async (req, res, next) => {
    try {
      const result = await saveDatabase(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/complete',
  setupLimiter,
  requireSetupToken,
  assertSetupAllowed,
  async (req, res, next) => {
    try {
      const result = await completeSetup(req.body);
      if (result.user?.id) res.cookie(GRANT_COOKIE, grantFor(result.user.id), grantCookieOptions(req));
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/access',
  setupLimiter,
  requireSetupToken,
  assertSetupAllowed,
  requireSetupOwner,
  async (req, res, next) => {
    try {
      const result = await saveAccessMode(req.body);
      res.clearCookie(GRANT_COOKIE, { ...grantCookieOptions(req), maxAge: undefined });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
