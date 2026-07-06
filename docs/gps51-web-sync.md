# GPS51 Web Sync (Browser Automation)

Birdie Fleet can ingest GPS51 telemetry without vendor API keys or “Send To Server” by replaying an **authorized browser session** captured with Playwright.

This service is **fully isolated** from direct JT808/JT1078:

- Does not use `services/jt-gateway`
- Does not write to `jt_*` tables or ports 6808/6809/8090
- Stores data only in `gps51_web_*` tables

## Architecture

```text
Operator (Windows, headed browser)
    npm run auth  →  data/auth/storage-state.json

VPS / Docker worker
    npm run discover  →  data/captures/*.json (sanitized)
    npm run sync      →  Supabase gps51_web_*
         health: 127.0.0.1:8091 only
```

## Database

Apply migration:

`supabase/migrations/20260706_gps51_web_sync.sql`

Tables: `gps51_web_accounts`, `gps51_web_devices`, `gps51_web_positions`, `gps51_web_latest_positions`, `gps51_web_sync_runs`, `gps51_web_raw_payloads`

View: `gps51_web_device_live`

## Commands

| npm script | Description |
|------------|-------------|
| `auth` | Manual login at `https://gps51.com/#/login`, save storage state |
| `discover` | Capture & score JSON responses from Monitor page |
| `sync` | Scheduled headless import worker |
| `dev` | Development worker (tsx) |

## First authentication (Windows)

```powershell
cd services/gps51-web-sync
copy .env.example .env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

npm install
npx playwright install chromium

$env:GPS51_HEADLESS = "false"
$env:GPS51_USERNAME = "BXAW"
npm run auth
```

After successful login, these files exist locally (never commit):

- `data/auth/storage-state.json`
- `data/captures/auth-success.png`

Then:

```powershell
npm run discover
npm run sync
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `GPS51_BASE_URL` | Portal root, default `https://gps51.com/` |
| `GPS51_MONITOR_URL` | Monitor hash route |
| `GPS51_USERNAME` | Expected account label (`BXAW`) |
| `GPS51_STORAGE_STATE_PATH` | Default `data/auth/storage-state.json` |
| `GPS51_HEADLESS` | `false` = headed browser (required for `auth`) |
| `SYNC_INTERVAL_SECONDS` | Worker interval (default 60) |
| `ORGANIZATION_ID` | Birdie org UUID |
| `HEALTH_PORT` | Default **8091** bound to localhost only |

No password env var — operator enters credentials manually during `npm run auth`.

## Safety rules

1. Read-only scraping — no device commands or settings changes
2. Recursive redaction of tokens/cookies/passwords in discovery captures
3. `data/` and storage state gitignored
4. Service role key server-side only
5. Does not merge into `vehicle_locations` in phase 1

## Docker (VPS)

```bash
cd services/gps51-web-sync
docker compose up -d --build
curl http://127.0.0.1:8091/health/ready
```

Copy `data/auth/storage-state.json` from the operator workstation into the VPS volume before starting the worker.

## Troubleshooting

| Issue | Action |
|-------|--------|
| `storage state missing` | Run `npm run auth` |
| `reauth_required` | Session expired — re-run `npm run auth` |
| Zero devices parsed | Run `npm run discover`, inspect `data/captures/network-candidates.json` |
| Supabase 503 on health | Apply migration / check service role key |

## Relation to GPS51 webhook

The Vercel webhook (`/api/gps51/webhook`) handles push forwarding. Web sync is a **pull fallback** when push is unavailable. Both can coexist; web sync does not modify webhook code.
