const { authenticateRequest, clerkClient } = require('@clerk/express');
const { isDatabaseMode } = require('./persistence');

const DEFAULT_ALLOWLIST_EMAILS = ['shaiss@gmail.com'];

function getClerkSecretKey() {
  const value = process.env.CLERK_SECRET_KEY;
  if (value == null || !String(value).trim()) {
    return null;
  }
  return String(value).trim();
}

/**
 * Prefer CLERK_PUBLISHABLE_KEY (Vercel prod/preview); fall back to NEXT_PUBLIC_* from Marketplace.
 */
function getClerkPublishableKey() {
  const value = process.env.CLERK_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (value == null || !String(value).trim()) {
    return null;
  }
  return String(value).trim();
}

function getAllowlistEmails() {
  const raw = process.env.CLERK_ALLOWLIST_EMAILS;
  if (raw != null && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWLIST_EMAILS.map((email) => email.toLowerCase());
}

function isEmailAllowlisted(email, resolveAllowlist = getAllowlistEmails) {
  if (!email) {
    return false;
  }
  const normalized = String(email).trim().toLowerCase();
  return resolveAllowlist().includes(normalized);
}

function isWatchlistOrAlertsApiRoute(req) {
  const path = req.path || '';
  return (
    path === '/api/watchlist'
    || path.startsWith('/api/watchlist/')
    || path === '/api/alerts'
    || path.startsWith('/api/alerts/')
  );
}

/** @deprecated use isWatchlistOrAlertsApiRoute */
function isWatchlistOrAlertsMutation(req) {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return false;
  }
  return isWatchlistOrAlertsApiRoute(req);
}

function shouldEnforceClerkAuth(resolveDatabaseMode, resolveSecretKey) {
  return resolveDatabaseMode() || Boolean(resolveSecretKey());
}

async function resolveEmailFromAuthState(state) {
  if (!state.isAuthenticated) {
    return null;
  }
  const auth = state.toAuth();
  const claimEmail = auth.sessionClaims?.email;
  if (typeof claimEmail === 'string' && claimEmail.trim()) {
    return claimEmail.trim();
  }
  if (!auth.userId) {
    return null;
  }
  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const primary = user.primaryEmailAddress?.emailAddress;
    return primary ? String(primary).trim() : null;
  } catch {
    return null;
  }
}

async function defaultResolveAuthenticatedEmail(req, deps) {
  const secretKey = deps.getClerkSecretKey();
  const publishableKey = deps.getClerkPublishableKey();
  const state = await authenticateRequest({
    request: req,
    clerkClient,
    options: {
      secretKey: secretKey || undefined,
      publishableKey: publishableKey || undefined,
    },
  });
  return resolveEmailFromAuthState(state);
}

/**
 * @param {{
 *   getClerkSecretKey?: () => string|null,
 *   getClerkPublishableKey?: () => string|null,
 *   getAllowlistEmails?: () => string[],
 *   isDatabaseMode?: () => boolean,
 *   resolveAuthenticatedEmail?: (req: import('express').Request) => Promise<string|null>,
 * }} [options]
 */
function createClerkAuthMiddleware(options = {}) {
  const resolveSecretKey = options.getClerkSecretKey || getClerkSecretKey;
  const resolvePublishableKey = options.getClerkPublishableKey || getClerkPublishableKey;
  const resolveAllowlist = options.getAllowlistEmails || getAllowlistEmails;
  const resolveDatabaseMode = options.isDatabaseMode || isDatabaseMode;
  const resolveEmail = options.resolveAuthenticatedEmail
    || ((req) => defaultResolveAuthenticatedEmail(req, {
      getClerkSecretKey: resolveSecretKey,
      getClerkPublishableKey: resolvePublishableKey,
    }));

  return async function clerkAuthMiddleware(req, res, next) {
    const path = req.path || '';
    if (!path.startsWith('/api')) {
      return next();
    }

    if (!isWatchlistOrAlertsApiRoute(req)) {
      return next();
    }

    if (resolveDatabaseMode() && !resolveSecretKey()) {
      return res.status(503).json({
        error: 'Watchlist and alerts require Clerk (CLERK_SECRET_KEY) when using database persistence',
      });
    }

    if (!shouldEnforceClerkAuth(resolveDatabaseMode, resolveSecretKey)) {
      return next();
    }

    try {
      const email = await resolveEmail(req);
      if (!email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!isEmailAllowlisted(email, resolveAllowlist)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.clerkAuth = { email: String(email).trim().toLowerCase() };
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

const createApiAccessMiddleware = createClerkAuthMiddleware;

module.exports = {
  createClerkAuthMiddleware,
  createApiAccessMiddleware,
  getClerkSecretKey,
  getClerkPublishableKey,
  getAllowlistEmails,
  isEmailAllowlisted,
  isWatchlistOrAlertsApiRoute,
  isWatchlistOrAlertsMutation,
  resolveEmailFromAuthState,
};
