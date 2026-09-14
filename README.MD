# Crypto RSI Dashboard

DeFi decision tool for inspecting token RSI across supported timeframes. Slice A exposes a server-side decision-session API backed by [TAAPI](https://taapi.io/).

The legacy heatmap bubble-chart UI remains in `public/` but is not the product surface. New work should target `/api/session`.

## Prerequisites

- Node.js 18+ (for built-in test runner and `fetch`)
- npm

## Installation

```sh
git clone https://github.com/shaiss/Crypto-RSI-Dashboard.git
cd Crypto-RSI-Dashboard
npm install
```

## Configuration

Set your TAAPI API secret as an environment variable (never commit it):

```sh
export TAAPI_SECRET=your_taapi_secret
```

Without `TAAPI_SECRET`, `/api/session` still responds but returns `rsi: null` and an `errors` entry instead of crashing.

## Run

```sh
npm start
```

Server listens on `http://localhost:3000` (or `PORT` if set).

## API

### `GET /api/session`

Returns a decision session for a single token and timeframe.

**Query parameters**

| Parameter   | Required | Default   | Description                                      |
|------------|----------|-----------|--------------------------------------------------|
| `token`    | yes      | —         | Base asset symbol, e.g. `BTC`                    |
| `timeframe`| yes      | —         | One of `15m`, `1h`, `4h`, `1d`                   |
| `exchange` | no       | `binance` | Exchange passed through to TAAPI                 |

**Example**

```sh
curl "http://localhost:3000/api/session?token=BTC&timeframe=1h"
```

**Response shape**

```json
{
  "token": "BTC",
  "pair": "BTC/USDT",
  "exchange": "binance",
  "timeframe": "1h",
  "rsi": 52.3,
  "rsiAsOf": "2024-11-14T12:00:00.000Z",
  "onWatchlist": false,
  "alert": { "status": "none" }
}
```

When configuration or upstream fetch fails, `rsi` and `rsiAsOf` are `null` and `errors` contains human-readable messages. Invalid timeframes return HTTP 400.

## Project layout

- `index.js` — Express server and `/api/session` route
- `lib/taapiClient.js` — TAAPI RSI client (exchange, symbol, interval)
- `lib/session.js` — Decision session builder and validation
- `lib/constants.js` — Allowed timeframes and defaults
- `test/session.test.js` — Mocked TAAPI smoke tests (no network or real secret)

## Tests

```sh
npm test
```

## License

MIT — see `LICENSE`.

## Contact

shai@kalmansforge.com
