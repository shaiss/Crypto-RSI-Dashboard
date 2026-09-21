const { isDatabaseMode } = require('./persistence');

function getAppAccessToken() {
  const value = process.env.APP_ACCESS_TOKEN;
  if (value == null || !String(value).trim()) {
    return null;
  }
  return String(value).trim();
}

function extractRequestToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const headerToken = req.headers['x-app-access-token'];
  if (headerToken != null && String(headerToken).trim()) {
    return String(headerToken).trim();
  }
  return null;
}

function isWatchlistOrAlertsMutation(req) {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return false;
  }
  const path = req.path || '';
  return (
    path === '/api/watchlist'
    || path.startsWith('/api/watchlist/')
    || path === '/api/alerts'
    || path.startsWith('/api/alerts/')
  );
}

/**
 * @param {{ getAppAccessToken?: () => string|null, isDatabaseMode?: () => boolean }} [options]
 */
function createApiAccessMiddleware(options = {}) {
  const resolveExpected = options.getAppAccessToken || getAppAccessToken;
  const resolveDatabaseMode = options.isDatabaseMode || isDatabaseMode;

  return function apiAccess(req, res, next) {
    const path = req.path || '';
    if (!path.startsWith('/api')) {
      return next();
    }

    if (!isWatchlistOrAlertsMutation(req)) {
      return next();
    }

    const expected = resolveExpected();

    if (resolveDatabaseMode() && !expected) {
      return res.status(503).json({
        error: 'Mutations require APP_ACCESS_TOKEN when using database persistence',
      });
    }

    if (expected) {
      const provided = extractRequestToken(req);
      if (provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    return next();
  };
}

module.exports = {
  createApiAccessMiddleware,
  getAppAccessToken,
  extractRequestToken,
  isWatchlistOrAlertsMutation,
};
