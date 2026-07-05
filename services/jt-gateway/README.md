# Birdie JT Gateway

Always-on Node.js service for direct JT/T 808 signaling and JT/T 1078 media on a VPS.

## Local development

```bash
cd services/jt-gateway
cp .env.example .env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Apply `supabase/migrations/20260705_birdie_jt808_jt1078.sql` to your Supabase project first.

## Simulator

```bash
npx tsx src/simulator/jt-terminal-simulator.ts --host 127.0.0.1 --terminal 13800138000
```

Provision a matching row in `jt_terminals` with `terminal_no = 13800138000` and `allow_auto_registration = false`.

## Tests

```bash
npm test
```

## Docker Compose (VPS)

```bash
cd services/jt-gateway
docker compose up -d --build
```

Health: `http://<vps>:8090/health/ready`

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 6808 | TCP | JT808 signaling |
| 6809 | TCP | JT1078 media |
| 6810 | UDP | JT1078 media (optional) |
| 8090 | HTTP | Health/metrics |
| 8888 | HTTP | MediaMTX HLS |
