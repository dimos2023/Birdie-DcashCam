-- Extend gps51_web_device_live view with live position fields from Phase 2C.
-- Frontend-only additive change; does not modify JT tables.

begin;

create or replace view public.gps51_web_device_live
with (security_invoker = true)
as
select
  d.id as gps51_device_id,
  d.organization_id,
  d.account_id,
  d.source_device_id,
  d.device_name,
  d.imei,
  d.sim_no,
  d.group_path,
  d.birdie_device_id,
  d.vehicle_id,
  d.customer_id,
  d.online_status,
  d.source_updated_at,
  d.source_located_at,
  d.last_seen_at,
  p.received_at,
  p.latitude,
  p.longitude,
  p.speed_kmh,
  p.acc_on,
  p.status_text,
  p.address,
  p.satellite_count,
  p.cellular_signal_percent,
  p.mileage_km,
  p.source_position_id,
  p.altitude_m,
  p.direction_deg,
  p.status_bits,
  p.alarm_bits,
  p.positioned,
  p.moving,
  d.media_channels,
  d.last_scraped_at
from public.gps51_web_devices d
left join public.gps51_web_latest_positions p
  on p.gps51_device_id = d.id;

commit;
