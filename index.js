const express = require('express');
const path = require('path');
const { buildDecisionSession } = require('./lib/session');

const app = express();

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/session', async (req, res) => {
  const { token, timeframe, exchange } = req.query;
  const result = await buildDecisionSession({ token, timeframe, exchange });

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.json(result.session);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
