const express = require('express');
const path = require('path');
const { buildDecisionSession } = require('./lib/session');
const { createWatchlistStore } = require('./lib/watchlist');
const { createAlertsStore } = require('./lib/alerts');
const {
  createClerkAuthMiddleware,
  getClerkPublishableKey,
  getClerkSecretKey,
  authenticateClerkRequest,
  attachClerkAuth,
  isAllowlistConfigured,
  isEmailAllowlisted,
  getAllowlistEmails,
  shouldEnforceClerkAuth,
} = require('./lib/apiAccess');
const { createStrategyEventsStore } = require('./lib/strategyEvents');
const { isDatabaseMode } = require('./lib/persistence');
const { restorePublicUrlMiddleware } = require('./lib/vercelRequest');

function createApp(options = {}) {
  const app = express();
  const watchlist = options.watchlistStore || createWatchlistStore(options.watchlistPath);
  const alerts = options.alertsStore || createAlertsStore(options.alertsPath);
  const strategyEvents = options.strategyEventsStore
    || createStrategyEventsStore(options.strategyEventsPath);

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

  app.get('/api/me', async (req, res) => {
    const publishableKey = getClerkPublishableKey();
    const clerkEnabled = Boolean(publishableKey);
    const base = {
      clerkEnabled,
      authenticated: false,
      email: null,
      walletConnected: false,
      walletAddressTruncated: null,
    };

    const enforce = shouldEnforceClerkAuth(
      options.isDatabaseMode || isDatabaseMode,
      options.getClerkSecretKey || getClerkSecretKey,
    );
    if (!enforce) {
      return res.json(base);
    }

    if (!isAllowlistConfigured(options.getAllowlistEmails || getAllowlistEmails)) {
      return res.status(503).json({
        error: 'CLERK_ALLOWLIST_EMAILS is required when Clerk auth is enforced',
      });
    }

    try {
      const context = await authenticateClerkRequest(req, {
        getClerkSecretKey: options.getClerkSecretKey || getClerkSecretKey,
        getClerkPublishableKey: options.getClerkPublishableKey || getClerkPublishableKey,
      });
      if (!context?.email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!isEmailAllowlisted(context.email, options.getAllowlistEmails || getAllowlistEmails)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json({
        clerkEnabled,
        authenticated: true,
        email: context.email,
        walletConnected: Boolean(context.walletConnected),
        walletAddressTruncated: context.walletAddressTruncated ?? null,
      });
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  });

  app.get('/api/strategy/events', async (req, res) => {
    try {
      const { token, timeframe, limit } = req.query;
      const events = await strategyEvents.list({
        token,
        timeframe,
        limit: limit != null ? Number(limit) : 50,
      });
      return res.json({ events });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
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

    let clerkAuth = req.clerkAuth;
    const enforce = shouldEnforceClerkAuth(
      options.isDatabaseMode || isDatabaseMode,
      options.getClerkSecretKey || getClerkSecretKey,
    );
    if (!clerkAuth && enforce && isAllowlistConfigured(options.getAllowlistEmails || getAllowlistEmails)) {
      try {
        const context = await authenticateClerkRequest(req, {
          getClerkSecretKey: options.getClerkSecretKey || getClerkSecretKey,
          getClerkPublishableKey: options.getClerkPublishableKey || getClerkPublishableKey,
        });
        if (context?.email && isEmailAllowlisted(context.email, options.getAllowlistEmails || getAllowlistEmails)) {
          attachClerkAuth(req, context);
          clerkAuth = req.clerkAuth;
        }
      } catch {
        // Optional auth for open session reads.
      }
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

    const session = result.session;
    session.paperStrategy = { events: [] };

    if (clerkAuth?.walletConnected && session.rsi != null) {
      try {
        const recorded = await strategyEvents.recordSessionEvaluation({
          token: session.token,
          timeframe: session.timeframe,
          rsi: session.rsi,
          buyBelow: session.thresholds?.buyBelow,
          sellAbove: session.thresholds?.sellAbove,
          walletAddress: clerkAuth.walletAddress,
        });
        session.paperStrategy.events = recorded;
        const recent = await strategyEvents.list({
          token: session.token,
          timeframe: session.timeframe,
          limit: 20,
        });
        session.paperStrategy.recentEvents = recent;
      } catch (err) {
        session.paperStrategy.error = err.message;
      }
    }

    return res.json(session);
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
