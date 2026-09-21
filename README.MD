# Crypto RSI Dashboard

DeFi decision tool for inspecting token RSI across supported timeframes. The default UI at `/` loads a decision session (token, timeframe, optional exchange) from `/api/session`. The legacy bubble heatmap remains under `/legacy/heatmap.html` for reference only.

## Prerequisites

- Node.js 18+ (for built-in test runner and `fetch`)
- npm
- **Production (Vercel):** [Neon](https://neon.tech) Postgres — set `DATABASE_URL` (or `NEON_DATABASE_URL`)
- **Local without Postgres:** set `USE_FILE_PERSISTENCE=true` to use JSON files under `data/`

## Installation

```sh
git clone https://github.com/shaiss/Crypto-RSI-Dashboard.git
cd Crypto-RSI-Dashboard
npm install
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TAAPI_SECRET` | recommended | TAAPI API secret for live RSI (never commit) |
| `DATABASE_URL` | Vercel / prod | Neon Postgres connection string (preferred) |
| `NEON_DATABASE_URL` | alternative | Same as `DATABASE_URL` if your Neon integration uses this name |
| `USE_FILE_PERSISTENCE` | local only | Set to `true` to use JSON files instead of Postgres when no DB URL is set |
| `WATCHLIST_PATH` | optional | Watchlist JSON path when using file persistence (default `data/watchlist.json`) |
| `ALERTS_PATH` | optional | Alerts JSON path when using file persistence (default `data/alerts.json`) |
| `PORT` | local only | HTTP port for `npm start` (default `3000`) |
| `APP_ACCESS_TOKEN` | Vercel / prod (with DB) | Shared secret for watchlist and alert **mutations** (`POST`/`DELETE`). Set only in Vercel/host env — never commit or embed in the client bundle. |

Without `TAAPI_SECRET`, `/api/session` still responds but returns `rsi: null` and an `errors` entry instead of crashing.

### API access (mutations)

- `GET` routes (including `/api/session`) stay open for read-only use.
- When `DATABASE_URL` / `NEON_DATABASE_URL` is active and `USE_FILE_PERSISTENCE` is not set, **database mode** applies: watchlist and alert mutations require `APP_ACCESS_TOKEN` on the server. If it is missing, mutations return **503** (fail closed — no silent open writes).
- When `APP_ACCESS_TOKEN` is set, clients must send the same value on each mutation via `Authorization: Bearer <token>` or `x-app-access-token: <token>`.
- **Local file mode** (`USE_FILE_PERSISTENCE=true`, or default local JSON without a DB URL): mutations work without `APP_ACCESS_TOKEN` unless you set one (then the header is required).

### Decision UI and mutations

The landing page loads sessions with an unauthenticated `GET /api/session`. Optional watchlist add/remove buttons send mutations with `x-app-access-token` from a password field you paste once per browser session; the value is stored in **`sessionStorage` only** (not in source code). You can also use `curl` with the same header. Set `APP_ACCESS_TOKEN` in Vercel to match what you paste locally.

### Persistence

- **Vercel / production:** watchlist and alert conditions are stored in **Neon Postgres**. Tables are created automatically on first use (see `migrations/001_init.sql`). Serverless filesystem JSON is not used in production.
- **Local dev:** either point `DATABASE_URL` at a Neon branch, or set `USE_FILE_PERSISTENCE=true` and optionally copy `data/watchlist.json.example` / `data/alerts.json.example` into `data/*.json` (runtime files are gitignored).

## Run locally

```sh
export TAAPI_SECRET=your_taapi_secret
# Option A — Neon
export DATABASE_URL=postgresql://...
# Option B — JSON files
export USE_FILE_PERSISTENCE=true

npm start
```

Server listens on `http://localhost:3000` (or `PORT` if set).

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Add environment variables: `TAAPI_SECRET`, `DATABASE_URL` (Neon integration or manual connection string), and `APP_ACCESS_TOKEN` (mutation auth).
3. Deploy — `vercel.json` routes all traffic to the Express app via `api/index.js` (`@vercel/node`).

No domain configuration is required in this repo; attach a custom domain in Vercel when ready.

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

`onWatchlist` is `true` when the normalized token symbol appears in the server-side watchlist store (Postgres or local JSON).

### `GET /api/watchlist`

Returns all watchlisted base symbols (uppercase).

```sh
curl "http://localhost:3000/api/watchlist"
```

```json
{ "tokens": ["BTC", "ETH"] }
```

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

Session-only RSI alert rules. Each condition has:

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

## Database schema (Neon)

Applied at runtime and documented in `migrations/001_init.sql`:

- `watchlist_tokens` — `token` (PK), `created_at`
- `alert_conditions` — `id` (UUID PK), `token`, `timeframe`, `op`, `threshold`, `last_fired_at`, `created_at`

## Project layout

- `index.js` — Express server, watchlist routes, alert routes, and `/api/session`
- `api/index.js` — Vercel serverless entry (re-exports Express app)
- `vercel.json` — Rewrites all routes to the Express handler
- `lib/watchlist.js` — Watchlist store (Postgres or JSON file)
- `lib/alerts.js` — Alert condition store and session evaluator
- `lib/db.js` — Neon client and schema bootstrap
- `lib/persistence.js` — Store backend selection
- `lib/apiAccess.js` — Mutation auth (`APP_ACCESS_TOKEN`) and DB-mode fail-closed
- `lib/taapiClient.js` — TAAPI RSI client (exchange, symbol, interval)
- `lib/session.js` — Decision session builder and validation
- `lib/constants.js` — Allowed timeframes and defaults
- `public/index.html` — Decision session landing UI
- `public/legacy/heatmap.html` — Archived heatmap demo
- `test/` — API and store tests (file-backed stores; no network)

## Tests

```sh
npm test
```

## License

MIT — see `LICENSE`.

## Contact

shai@kalmansforge.com
