/**
 * Vercel rewrites often invoke `/api/index` while Express routes are registered on
 * the public path (e.g. `/api/auth/config`). Restore the caller path when present.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function restorePublicUrlMiddleware(req, res, next) {
  if (!process.env.VERCEL) {
    return next();
  }

  const currentPath = (req.url || '').split('?')[0];
  if (currentPath !== '/api/index' && currentPath !== '/api/index.js') {
    return next();
  }

  const headerCandidates = [
    req.headers['x-vercel-original-url'],
    req.headers['x-original-url'],
    req.headers['x-invoke-path'],
    req.headers['x-matched-path'],
  ];

  for (const candidate of headerCandidates) {
    if (typeof candidate !== 'string' || !candidate.startsWith('/')) {
      continue;
    }
    const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const pathOnly = candidate.split('?')[0];
    req.url = `${pathOnly}${query}`;
    break;
  }

  return next();
}

module.exports = { restorePublicUrlMiddleware };
