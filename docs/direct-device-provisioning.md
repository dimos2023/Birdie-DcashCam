# Direct Birdie Dashcam Provisioning (JT808 / JT1078)

This guide covers connecting physical Birdie dashcams directly to Birdie Fleet via the `jt-gateway` service on a VPS. This path is independent of GPS51 platform forwarding.

## VPS requirements

- Public static IPv4 address
- Docker and Docker Compose
- Adequate uplink bandwidth for live video (plan per camera count and stream type)
- Disk for MediaMTX segments and optional recording storage

## Firewall ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 6808 | TCP | JT/T 808 signaling |
| 6809 | TCP | JT/T 1078 media (primary) |
| 6810 | UDP | JT/T 1078 media (optional, feature flag) |
| 8090 | TCP | Gateway health (`/health/ready`) |
| 443 | TCP | HTTPS playback to operators (MediaMTX HLS behind reverse proxy) |

## SIM / APN

Terminals need outbound connectivity to the VPS public IP on ports 6808–6809. Use a data SIM with a route to the internet or a private APN/VPN terminating at your VPC.

## Device server parameters (JT808)

Configure the terminal to use Birdie as the **master** platform center:

- Parameter `0x0013` — master server `IP:port` (use your VPS IP and `6808`)
- Parameters `0x0023`–`0x0026` — optional slave/backup centers
- Parameter `0x0001` — heartbeat interval (seconds)
- Parameter `0x0029` — default location reporting interval

**Important:** A slave center may receive telemetry, but the terminal typically accepts live-video commands (`0x9101`) only from the master center unless vendor firmware explicitly supports secondary-center control. Birdie must be master to start JT1078 streams.

## GPS51 “To Servers” vs direct connection

GPS51 forwarding sends copies of platform data to third-party URLs. It does **not** replace direct JT808/JT1078 sockets from the physical device to your VPS.

Changing the device master server to Birdie may disconnect it from GPS51 until reconfigured.

Configuration methods vary by vendor: manufacturer tool, SMS, or the current master platform UI.

## Values to collect before provisioning

| Field | Where used |
|-------|------------|
| JT808 terminal number | `jt_terminals.terminal_no` |
| JT1078 media SIM (BCD[6]) | `jt_terminals.media_sim_no` |
| IMEI | Registration auth matching |
| Terminal model / manufacturer ID | Registration parsing |
| Channel map (Front/Rear/Cabin) | `jt_av_channels`, live `logical_channel` |
| Video codec (H.264/H.265) | Stream pipeline / transcode |

Enter these on **Devices → Edit → Direct JT terminal** in Birdie Fleet.

## Security

JT/T protocols do not provide modern TLS on the wire. Prefer private APN or VPN when available. Never expose Supabase service-role keys or registration auth codes in the browser or client logs.

## Deployment

```bash
cd services/jt-gateway
cp .env.example .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_GATEWAY_IPV4, STREAM_TOKEN_SECRET
docker compose up -d --build
```

Apply migration `supabase/migrations/20260705_birdie_jt808_jt1078.sql` to Supabase before starting the gateway.

## Verification

1. Provision `jt_terminals` row matching device terminal number.
2. Run simulator: `npx tsx src/simulator/jt-terminal-simulator.ts --host <vps-ip> --terminal <number>`
3. Confirm GPS on **Live Monitoring** and `jt_positions` in Supabase.
4. Start live stream from UI; confirm `jt_commands` → `0x9101` and HLS URL on active `jt_stream_sessions`.

Physical device validation is required before production cutover.
