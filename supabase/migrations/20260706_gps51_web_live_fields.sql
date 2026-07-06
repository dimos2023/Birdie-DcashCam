-- GPS51 Web Sync Phase 2C: live WebSocket position fields
-- Additive migration. Does not modify JT808/JT1078 tables.

begin;

alter table public.gps51_web_sync_runs
  drop constraint if exists gps51_web_sync_runs_mode_check;

alter table public.gps51_web_sync_runs
  add constraint gps51_web_sync_runs_mode_check
  check (mode in ('auth','discover','sync','one_shot','live'));

alter table public.gps51_web_positions
  add column if not exists source_position_id bigint,
  add column if not exists altitude_m integer,
  add column if not exists direction_deg integer,
  add column if not exists status_bits bigint,
  add column if not exists alarm_bits bigint,
  add column if not exists positioned boolean,
  add column if not exists moving boolean;

alter table public.gps51_web_latest_positions
  add column if not exists source_position_id bigint,
  add column if not exists altitude_m integer,
  add column if not exists direction_deg integer,
  add column if not exists status_bits bigint,
  add column if not exists alarm_bits bigint,
  add column if not exists positioned boolean,
  add column if not exists moving boolean;

drop index if exists public.uq_gps51_web_positions_dedupe;

create unique index if not exists uq_gps51_web_positions_positionlast_dedupe
  on public.gps51_web_positions (
    gps51_device_id,
    coalesce(source_position_id, -1),
    coalesce(source_updated_at, '-infinity'::timestamptz)
  );

create or replace function public.gps51_web_sync_latest_position()
returns trigger
language plpgsql
as $$
begin
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
    online_status = excluded.online_status,
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
    updated_at = now()
  where excluded.received_at >= public.gps51_web_latest_positions.received_at;

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

comment on column public.gps51_web_positions.source_position_id is
  'GPS51 positionlastid from WebSocket positionLast frames.';

commit;
