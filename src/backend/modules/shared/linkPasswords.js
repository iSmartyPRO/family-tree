import { isIPv6 } from 'net';
import rateLimit from 'express-rate-limit';

/*
 * Brute-force protection for public link passwords (Files /l/…, knowledge base /s/…).
 *
 *   - new passwords are at least LINK_PASSWORD_MIN characters (older links keep theirs);
 *   - per address and link: a few tries per 15 minutes — IPv6 clients are grouped by
 *     their /64, since one host usually owns the whole network;
 *   - per link from every address together: a budget per hour, so a botnet or a big
 *     IPv6 range cannot spread guesses over many keys.
 */

export const LINK_PASSWORD_MIN = 8;

/** The rate-limit key of a client address: IPv4 as is, IPv6 cut to its /64 network. */
export function addressKey(ip) {
  const value = String(ip || '').replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, '$1');
  if (!isIPv6(value)) return value;
  const [head] = value.split('::');
  const groups = value.includes('::') ? head.split(':').filter(Boolean) : value.split(':');
  return `${[...groups, '0', '0', '0', '0'].slice(0, 4).join(':')}::/64`;
}

const refuse = (req, res) => res.status(429).json({ success: false, error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' });

/**
 * The two limiters of an unlock route. `linkKey(req)` names the link (may be async),
 * `prefix` keeps the modules' counters apart.
 */
export function unlockLimiters(prefix, linkKey) {
  return [
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: async (req) => `${prefix}-u:${addressKey(req.ip)}:${await linkKey(req)}`,
      handler: refuse,
    }),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 50,
      // Only wrong passwords spend the shared budget: a popular link keeps opening for real visitors.
      skipSuccessfulRequests: true,
      standardHeaders: false,
      legacyHeaders: false,
      keyGenerator: async (req) => `${prefix}-ul:${await linkKey(req)}`,
      handler: refuse,
    }),
  ];
}
