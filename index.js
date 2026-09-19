const express = require('express');
const path = require('path');
const { buildDecisionSession } = require('./lib/session');
const { createWatchlistStore } = require('./lib/watchlist');

function createApp(options = {}) {
  const app = express();
  const watchlist = options.watchlistStore || createWatchlistStore(options.watchlistPath);

  app.use(express.json());
  app.use(express.static('public'));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  app.get('/api/session', async (req, res) => {
    const { token, timeframe, exchange } = req.query;
    let onWatchlist = false;
    try {
      onWatchlist = await watchlist.has(token);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    const result = await buildDecisionSession({ token, timeframe, exchange, onWatchlist });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result.session);
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
