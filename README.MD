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

Optional: override the watchlist JSON path (default `data/watchlist.json`):

```sh
export WATCHLIST_PATH=/path/to/watchlist.json
```

Copy `data/watchlist.json.example` to `data/watchlist.json` if you want a local file in the repo layout; the runtime file is gitignored and created automatically when you add tokens.

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

`onWatchlist` is `true` when the normalized token symbol appears in the server-side watchlist store (JSON file).

### `GET /api/watchlist`

Returns all watchlisted base symbols (uppercase).

```sh
curl "http://localhost:3000/api/watchlist"
```

```json
{ "tokens": ["BTC", "ETH"] }
```

If the watchlist file does not exist yet, the list is empty.

### `POST /api/watchlist`

Add a token to the watchlist. Send `token` in the JSON body or as a query parameter. Symbols are trimmed and uppercased; duplicates are ignored.

```sh
curl -X POST "http://localhost:3000/api/watchlist" \
  -H "Content-Type: application/json" \
  -d '{"token":"btc"}'
```

Response (`201`):

```json
{ "token": "BTC", "tokens": ["BTC"] }
```

Empty or missing `token` returns HTTP 400.

### `DELETE /api/watchlist/:token`

Remove a token (case-insensitive). Returns `{ "removed": true|false, "tokens": [...] }`.

```sh
curl -X DELETE "http://localhost:3000/api/watchlist/BTC"
```

## Project layout

- `index.js` — Express server, watchlist routes, and `/api/session`
- `lib/watchlist.js` — JSON file watchlist persistence
- `lib/taapiClient.js` — TAAPI RSI client (exchange, symbol, interval)
- `lib/session.js` — Decision session builder and validation
- `lib/constants.js` — Allowed timeframes and defaults
- `data/watchlist.json.example` — Empty watchlist template
- `test/session.test.js` — Mocked TAAPI smoke tests (no network or real secret)
- `test/watchlist.test.js` — Watchlist CRUD and session `onWatchlist` tests

## Tests

```sh
npm test
```

## License

MIT — see `LICENSE`.

## Contact

shai@kalmansforge.com
