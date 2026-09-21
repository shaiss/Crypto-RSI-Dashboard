/**
 * Vercel serverless entry — must export the same Express app as index.js (all /api routes).
 */
const app = require('../index');

module.exports = app;
