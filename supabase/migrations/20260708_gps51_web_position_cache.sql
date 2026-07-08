-- GPS51 map cache position sync: position_source column and latest-position timestamp guard.
-- Does not modify JT808/JT1078 tables.

begin;

alter table public.gps51_web_sync_runs
  drop constraint if exists gps51_web_sync_runs_mode_check;

alter table public.gps51_web_sync_runs
  add constraint gps51_web_sync_runs_mode_check
  check (mode in ('auth','discover','sync','one_shot','live','status_bootstrap','status_tree','positions_tree','position_cache'));

alter table public.gps51_web_positions
  add column if not exists position_source text;

alter table public.gps51_web_latest_positions
  add column if not exists position_source text;

create or replace function public.gps51_web_sync_latest_position()
returns trigger
language plpgsql
as $$
declare
  incoming_ts timestamptz;
  existing_ts timestamptz;
begin
  incoming_ts := coalesce(new.source_updated_at, new.source_located_at, new.received_at);
  select coalesce(source_updated_at, source_located_at, received_at)
    into existing_ts
    from public.gps51_web_latest_positions
   where gps51_device_id = new.gps51_device_id;

  if existing_ts is not null and incoming_ts < existing_ts then
    return new;
  end if;

  insert into public.gps51_web_latest_positions (
    gps51_device_id,
    organization_id,
    account_id,
    position_id,
    source_updated_at,
    source_located_at,
    received_at,
    latitude,
    longitude,
    speed_kmh,
    acc_on,
    online_status,
    status_text,
    address,
    satellite_count,
    cellular_signal_percent,
    mileage_km,
    source_position_id,
    altitude_m,
    direction_deg,
    status_bits,
    alarm_bits,
    positioned,
    moving,
    position_source,
    updated_at
  ) values (
    new.gps51_device_id,
    new.organization_id,
    new.account_id,
    new.id,
    new.source_updated_at,
    new.source_located_at,
    new.received_at,
    new.latitude,
    new.longitude,
    new.speed_kmh,
    new.acc_on,
    new.online_status,
    new.status_text,
    new.address,
    new.satellite_count,
    new.cellular_signal_percent,
    new.mileage_km,
    new.source_position_id,
    new.altitude_m,
    new.direction_deg,
    new.status_bits,
    new.alarm_bits,
    new.positioned,
    new.moving,
    new.position_source,
    now()
  )
  on conflict (gps51_device_id) do update set
    organization_id = excluded.organization_id,
    account_id = excluded.account_id,
    position_id = excluded.position_id,
    source_updated_at = excluded.source_updated_at,
    source_located_at = excluded.source_located_at,
    received_at = excluded.received_at,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    speed_kmh = excluded.speed_kmh,
    acc_on = excluded.acc_on,
    online_status = coalesce(excluded.online_status, public.gps51_web_latest_positions.online_status),
    status_text = excluded.status_text,
    address = excluded.address,
    satellite_count = excluded.satellite_count,
    cellular_signal_percent = excluded.cellular_signal_percent,
    mileage_km = excluded.mileage_km,
    source_position_id = excluded.source_position_id,
    altitude_m = excluded.altitude_m,
    direction_deg = excluded.direction_deg,
    status_bits = excluded.status_bits,
    alarm_bits = excluded.alarm_bits,
    positioned = excluded.positioned,
    moving = excluded.moving,
    position_source = excluded.position_source,
    updated_at = now()
  where coalesce(excluded.source_updated_at, excluded.source_located_at, excluded.received_at)
     >= coalesce(public.gps51_web_latest_positions.source_updated_at, public.gps51_web_latest_positions.source_located_at, public.gps51_web_latest_positions.received_at);

  update public.gps51_web_devices
  set source_updated_at = coalesce(new.source_updated_at, source_updated_at),
      source_located_at = coalesce(new.source_located_at, source_located_at),
      last_seen_at = coalesce(new.source_updated_at, last_seen_at),
      latitude = new.latitude,
      longitude = new.longitude,
      speed_kmh = new.speed_kmh,
      acc_on = new.acc_on,
      online_status = coalesce(new.online_status, online_status),
      status_text = new.status_text,
      address = new.address,
      satellite_count = new.satellite_count,
      cellular_signal_percent = new.cellular_signal_percent,
      mileage_km = new.mileage_km,
      last_scraped_at = now(),
      updated_at = now()
  where id = new.gps51_device_id;

  return new;
end;
$$;

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
  p.position_source,
  d.media_channels,
  d.last_scraped_at
from public.gps51_web_devices d
left join public.gps51_web_latest_positions p
  on p.gps51_device_id = d.id;

commit;
