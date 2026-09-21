const { resolveDatabaseUrl } = require('./db');

function isTruthyEnv(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Choose watchlist/alerts backend: injected path (tests), Postgres, or JSON files.
 * @param {{ filePath?: string }} options
 */
function shouldUseFilePersistence(options = {}) {
  if (options.filePath) {
    return true;
  }
  if (isTruthyEnv(process.env.USE_FILE_PERSISTENCE)) {
    return true;
  }
  if (resolveDatabaseUrl()) {
    return false;
  }
  if (!process.env.VERCEL) {
    return true;
  }
  return false;
}

function isDatabaseMode() {
  if (isTruthyEnv(process.env.USE_FILE_PERSISTENCE)) {
    return false;
  }
  return Boolean(resolveDatabaseUrl());
}

function requireDatabaseUrl() {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      'DATABASE_URL (or NEON_DATABASE_URL) is required on Vercel. '
        + 'For local JSON files, set USE_FILE_PERSISTENCE=true.',
    );
  }
  return url;
}

module.exports = {
  shouldUseFilePersistence,
  isDatabaseMode,
  requireDatabaseUrl,
  resolveDatabaseUrl,
};
