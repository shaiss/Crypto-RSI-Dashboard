const express = require('express');
const path = require('path');
const { buildDecisionSession } = require('./lib/session');
const { createWatchlistStore } = require('./lib/watchlist');
const { createAlertsStore } = require('./lib/alerts');
const {
  createClerkAuthMiddleware,
  getClerkPublishableKey,
} = require('./lib/apiAccess');
const { restorePublicUrlMiddleware } = require('./lib/vercelRequest');

function createApp(options = {}) {
  const app = express();
  const watchlist = options.watchlistStore || createWatchlistStore(options.watchlistPath);
  const alerts = options.alertsStore || createAlertsStore(options.alertsPath);

  app.use(express.json());
  app.use(options.vercelRequestMiddleware || restorePublicUrlMiddleware);
  app.use(options.apiAccessMiddleware || createClerkAuthMiddleware());

  app.get('/api/auth/config', (req, res) => {
    const publishableKey = getClerkPublishableKey();
    return res.json({
      publishableKey,
      clerkEnabled: Boolean(publishableKey),
    });
  });

  app.get('/api/watchlist', async (req, res) => {
    try {
      const tokens = await watchlist.list();
      return res.json({ tokens });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/watchlist', async (req, res) => {
    const token = req.body?.token ?? req.query.token;
    try {
      const result = await watchlist.add(token);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json({ token: result.token, tokens: result.tokens });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/watchlist/:token', async (req, res) => {
    try {
      const result = await watchlist.remove(req.params.token);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ removed: result.removed, tokens: result.tokens });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/alerts', async (req, res) => {
    try {
      const conditions = await alerts.list();
      return res.json({ conditions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/alerts', async (req, res) => {
    const { token, timeframe, op, threshold, buyBelow, sellAbove } = req.body ?? {};
    if (buyBelow != null || sellAbove != null) {
      try {
        const result = await alerts.setThresholds({
          token,
          timeframe,
          buyBelow,
          sellAbove,
        });
        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(200).json({
          thresholds: result.thresholds,
          conditions: result.conditions,
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    try {
      const result = await alerts.add({ token, timeframe, op, threshold });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(201).json({ condition: result.condition, conditions: result.conditions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/alerts/:id', async (req, res) => {
    try {
      const result = await alerts.remove(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ removed: result.removed, conditions: result.conditions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/session', async (req, res) => {
    const { token, timeframe, exchange } = req.query;
    let onWatchlist = false;
    try {
      onWatchlist = await watchlist.has(token);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    const result = await buildDecisionSession({
      token,
      timeframe,
      exchange,
      onWatchlist,
      alertsStore: alerts,
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result.session);
  });

  app.use(express.static('public'));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

const app = createApp();

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.createApp = createApp;
