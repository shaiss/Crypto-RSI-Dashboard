const { authenticateRequest, clerkClient } = require('@clerk/express');
const { isDatabaseMode } = require('./persistence');
const { getWalletSummaryFromClerkUser } = require('./wallet');

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
  if (raw == null || !String(raw).trim()) {
    return [];
  }
  return String(raw)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlistConfigured(resolveAllowlist = getAllowlistEmails) {
  return resolveAllowlist().length > 0;
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

function isStrategyEventsApiRoute(req) {
  const path = req.path || '';
  return path === '/api/strategy/events';
}

function isAlertsThresholdMutation(req) {
  if (req.method !== 'POST' || req.path !== '/api/alerts') {
    return false;
  }
  const body = req.body ?? {};
  return body.buyBelow != null || body.sellAbove != null;
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

async function resolveAuthContextFromAuthState(state) {
  if (!state.isAuthenticated) {
    return null;
  }
  const auth = state.toAuth();
  if (!auth.userId) {
    return null;
  }
  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const claimEmail = auth.sessionClaims?.email;
    let email = typeof claimEmail === 'string' && claimEmail.trim()
      ? claimEmail.trim()
      : user.primaryEmailAddress?.emailAddress;
    email = email ? String(email).trim() : null;
    const wallet = getWalletSummaryFromClerkUser(user);
    return {
      userId: auth.userId,
      email,
      emailNormalized: email ? email.toLowerCase() : null,
      ...wallet,
    };
  } catch {
    return null;
  }
}

async function authenticateClerkRequest(req, deps) {
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
  return resolveAuthContextFromAuthState(state);
}

async function defaultResolveAuthenticatedEmail(req, deps) {
  const context = await authenticateClerkRequest(req, deps);
  return context?.email ?? null;
}

async function defaultResolveAuthenticatedContext(req, deps) {
  return authenticateClerkRequest(req, deps);
}

function attachClerkAuth(req, context) {
  req.clerkAuth = {
    email: context.emailNormalized || String(context.email || '').trim().toLowerCase(),
    userId: context.userId,
    walletConnected: Boolean(context.walletConnected),
    walletAddress: context.walletAddress ?? null,
    walletAddressTruncated: context.walletAddressTruncated ?? null,
  };
}

/**
 * @param {{
 *   getClerkSecretKey?: () => string|null,
 *   getClerkPublishableKey?: () => string|null,
 *   getAllowlistEmails?: () => string[],
 *   isDatabaseMode?: () => boolean,
 *   resolveAuthenticatedEmail?: (req: import('express').Request) => Promise<string|null>,
 *   resolveAuthenticatedContext?: (req: import('express').Request) => Promise<object|null>,
 * }} [options]
 */
function createClerkAuthMiddleware(options = {}) {
  const resolveSecretKey = options.getClerkSecretKey || getClerkSecretKey;
  const resolvePublishableKey = options.getClerkPublishableKey || getClerkPublishableKey;
  const resolveAllowlist = options.getAllowlistEmails || getAllowlistEmails;
  const resolveDatabaseMode = options.isDatabaseMode || isDatabaseMode;
  const deps = {
    getClerkSecretKey: resolveSecretKey,
    getClerkPublishableKey: resolvePublishableKey,
  };
  const resolveEmail = options.resolveAuthenticatedEmail
    || ((req) => defaultResolveAuthenticatedEmail(req, deps));
  const resolveContext = options.resolveAuthenticatedContext
    || ((req) => defaultResolveAuthenticatedContext(req, deps));

  return async function clerkAuthMiddleware(req, res, next) {
    const path = req.path || '';
    if (!path.startsWith('/api')) {
      return next();
    }

    const needsClerk = isWatchlistOrAlertsApiRoute(req)
      || isStrategyEventsApiRoute(req)
      || isAlertsThresholdMutation(req);

    if (!needsClerk) {
      return next();
    }

    if (resolveDatabaseMode() && !resolveSecretKey()) {
      return res.status(503).json({
        error: 'Protected API routes require Clerk (CLERK_SECRET_KEY) when using database persistence',
      });
    }

    if (!shouldEnforceClerkAuth(resolveDatabaseMode, resolveSecretKey)) {
      return next();
    }

    if (!isAllowlistConfigured(resolveAllowlist)) {
      return res.status(503).json({
        error: 'Protected API routes require CLERK_ALLOWLIST_EMAILS when Clerk auth is enforced',
      });
    }

    try {
      const context = await resolveContext(req);
      const email = context?.email ?? await resolveEmail(req);
      if (!email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!isEmailAllowlisted(email, resolveAllowlist)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      attachClerkAuth(req, {
        ...context,
        email,
        emailNormalized: String(email).trim().toLowerCase(),
      });

      const needsWallet = isStrategyEventsApiRoute(req) || isAlertsThresholdMutation(req);
      if (needsWallet && !req.clerkAuth.walletConnected) {
        return res.status(403).json({
          error: 'Connect a Web3 wallet in Clerk to use paper strategy features',
        });
      }

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
  authenticateClerkRequest,
  defaultResolveAuthenticatedContext,
  attachClerkAuth,
  getClerkSecretKey,
  getClerkPublishableKey,
  getAllowlistEmails,
  isAllowlistConfigured,
  isEmailAllowlisted,
  isWatchlistOrAlertsApiRoute,
  isWatchlistOrAlertsMutation,
  isStrategyEventsApiRoute,
  isAlertsThresholdMutation,
  resolveEmailFromAuthState,
  resolveAuthContextFromAuthState,
  shouldEnforceClerkAuth,
};
