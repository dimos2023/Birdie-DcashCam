# GPS51 Web Sync (Browser Automation)

Read-only GPS51 portal scraper using Playwright. **Isolated** from direct JT808/JT1078 (`jt-gateway` ports 6808/6809/8090).

## Modes

| Command | Purpose |
|---------|---------|
| `npm run auth` | Manual headed login → saves `data/auth/storage-state.json` |
| `npm run discover` | Capture sanitized network candidates from Monitor page |
| `npm run sync` | Headless worker: import devices/positions to `gps51_web_*` tables |
| `npm run dev` | Same as sync (tsx, for development) |

## First-time setup (Windows)

```powershell
cd services/gps51-web-sync
copy .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

npm install
npx playwright install chromium

# Headed manual login as BXAW
$env:GPS51_HEADLESS="false"
npm run auth

npm run discover
npm run sync
```

## Environment

See `.env.example`. **No password variable** — authentication is manual via Playwright storage state.

## Health

`http://127.0.0.1:8091/health/ready`

## Safety

- Read-only: no Cmd, Track, Playback, parameters, reboot, or Send To Server
- Secrets never logged or committed (`data/` is gitignored)
- Data stored in `gps51_web_*` tables only (not `jt_*`, not `vehicle_locations`)

Full guide: [docs/gps51-web-sync.md](../../docs/gps51-web-sync.md)
