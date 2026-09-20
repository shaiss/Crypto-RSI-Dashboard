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

Optional: override the alert conditions JSON path (default `data/alerts.json`):

```sh
export ALERTS_PATH=/path/to/alerts.json
```

Copy `data/watchlist.json.example` to `data/watchlist.json` if you want a local file in the repo layout; the runtime file is gitignored and created automatically when you add tokens.

Copy `data/alerts.json.example` to `data/alerts.json` for local alert conditions; the runtime file is gitignored and created when you POST a condition.

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

`alert.status` is evaluated on each session fetch (no background polling):

| Status   | Meaning |
|----------|---------|
| `none`   | No matching condition for this token/timeframe, RSI unavailable, or threshold not met |
| `active` | A stored condition matches the latest RSI |
| `recent` | Threshold not met now, but the condition fired on a prior fetch within the last 15 minutes |

When `active` or `recent`, `conditionId` and `summary` describe the matched rule (e.g. `BTC 1h RSI 72.00 >= 70`).

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

### Alert conditions (`/api/alerts`)

Session-only RSI alert rules stored in `data/alerts.json`. Each condition has:

| Field        | Description |
|-------------|-------------|
| `id`        | UUID (server-generated) |
| `token`     | Base symbol, e.g. `BTC` |
| `timeframe` | One of `15m`, `1h`, `4h`, `1d` |
| `op`        | Comparison: `<`, `<=`, `>`, or `>=` |
| `threshold` | Numeric RSI level |

Optional `lastFiredAt` (ISO timestamp) is updated when `/api/session` evaluates a met condition; it powers the `recent` alert status without background jobs.

#### `GET /api/alerts`

List all conditions.

```sh
curl "http://localhost:3000/api/alerts"
```

```json
{ "conditions": [] }
```

#### `POST /api/alerts`

Create a condition. Body JSON: `token`, `timeframe`, `op`, `threshold`.

```sh
curl -X POST "http://localhost:3000/api/alerts" \
  -H "Content-Type: application/json" \
  -d '{"token":"BTC","timeframe":"1h","op":">=","threshold":70}'
```

Response (`201`):

```json
{
  "condition": {
    "id": "…",
    "token": "BTC",
    "timeframe": "1h",
    "op": ">=",
    "threshold": 70
  },
  "conditions": [ … ]
}
```

Invalid token, timeframe, operator, or threshold returns HTTP 400.

#### `DELETE /api/alerts/:id`

Remove a condition by id. Returns `{ "removed": true|false, "conditions": [...] }`.

```sh
curl -X DELETE "http://localhost:3000/api/alerts/<condition-id>"
```

## Project layout

- `index.js` — Express server, watchlist routes, alert routes, and `/api/session`
- `lib/watchlist.js` — JSON file watchlist persistence
- `lib/alerts.js` — JSON alert condition store and session evaluator
- `lib/taapiClient.js` — TAAPI RSI client (exchange, symbol, interval)
- `lib/session.js` — Decision session builder and validation
- `lib/constants.js` — Allowed timeframes and defaults
- `data/watchlist.json.example` — Empty watchlist template
- `data/alerts.json.example` — Empty alert conditions template
- `test/session.test.js` — Mocked TAAPI smoke tests (no network or real secret)
- `test/watchlist.test.js` — Watchlist CRUD and session `onWatchlist` tests
- `test/alerts.test.js` — Alert CRUD, evaluator, and session `alert` tests

## Tests

```sh
npm test
```

## License

MIT — see `LICENSE`.

## Contact

shai@kalmansforge.com
