-- Birdie Fleet direct terminal integration
-- JT/T 808-2011/2019 signaling + JT/T 1078-2016 audio/video
-- Target: Supabase PostgreSQL
-- This migration is additive. It does not modify the existing devices, vehicles,
-- customers, organizations, profiles, or auth tables.

begin;

create extension if not exists pgcrypto;

-- Shared updated_at trigger
create or replace function public.jt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Gateway nodes. A production deployment may have one or more gateway instances.
create table if not exists public.jt_gateway_instances (
  id text primary key,
  hostname text,
  public_ip inet,
  signaling_tcp_port integer not null default 6808 check (signaling_tcp_port between 1 and 65535),
  media_tcp_port integer not null default 6809 check (media_tcp_port between 1 and 65535),
  media_udp_port integer not null default 6810 check (media_udp_port between 1 and 65535),
  software_version text,
  status text not null default 'offline' check (status in ('online','offline','degraded','maintenance')),
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_jt_gateway_instances_updated_at on public.jt_gateway_instances;
create trigger trg_jt_gateway_instances_updated_at
before update on public.jt_gateway_instances
for each row execute function public.jt_set_updated_at();

-- One row represents one physical JT terminal/dashcam.
-- External IDs intentionally remain UUID references without hard foreign keys so this
-- migration can run against the current Birdie schema without assuming exact table names.
create table if not exists public.jt_terminals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  device_id uuid,
  vehicle_id uuid,
  customer_id uuid,

  display_name text,
  terminal_no text not null,
  terminal_no_raw text,
  media_sim_no text,
  imei text,
  sim_iccid text,
  terminal_id_code text,
  manufacturer_id text,
  terminal_model text,
  plate_number text,
  plate_color smallint,

  protocol_version text not null default 'auto'
    check (protocol_version in ('auto','2011','2019')),
  transport_preference text not null default 'tcp'
    check (transport_preference in ('tcp','udp')),
  timezone_offset_minutes smallint not null default 480
    check (timezone_offset_minutes between -720 and 840),

  auth_code_hash text,
  auth_code_issued_at timestamptz,
  registration_state text not null default 'pending'
    check (registration_state in ('pending','registered','authenticated','rejected','disabled')),
  allow_auto_registration boolean not null default false,
  is_enabled boolean not null default true,

  expected_video_channels smallint check (expected_video_channels is null or expected_video_channels between 0 and 64),
  expected_audio_channels smallint check (expected_audio_channels is null or expected_audio_channels between 0 and 64),

  is_online boolean not null default false,
  last_seen_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  last_remote_ip inet,
  last_remote_port integer check (last_remote_port is null or last_remote_port between 1 and 65535),
  last_message_id integer check (last_message_id is null or last_message_id between 0 and 65535),
  last_error text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jt_terminals_terminal_no_digits check (terminal_no ~ '^[0-9]{1,20}$'),
  constraint jt_terminals_media_sim_digits check (media_sim_no is null or media_sim_no ~ '^[0-9]{1,12}$'),
  constraint jt_terminals_imei_digits check (imei is null or imei ~ '^[0-9]{14,17}$')
);

create unique index if not exists uq_jt_terminals_terminal_no
  on public.jt_terminals (terminal_no);
create unique index if not exists uq_jt_terminals_media_sim_no
  on public.jt_terminals (media_sim_no) where media_sim_no is not null;
create unique index if not exists uq_jt_terminals_imei
  on public.jt_terminals (imei) where imei is not null;
create unique index if not exists uq_jt_terminals_device_id
  on public.jt_terminals (device_id) where device_id is not null;
create index if not exists ix_jt_terminals_org on public.jt_terminals (organization_id);
create index if not exists ix_jt_terminals_vehicle on public.jt_terminals (vehicle_id);
create index if not exists ix_jt_terminals_online on public.jt_terminals (organization_id, is_online, last_seen_at desc);

drop trigger if exists trg_jt_terminals_updated_at on public.jt_terminals;
create trigger trg_jt_terminals_updated_at
before update on public.jt_terminals
for each row execute function public.jt_set_updated_at();

-- Every accepted TCP/UDP signaling connection is audited here.
create table if not exists public.jt_terminal_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  gateway_instance_id text references public.jt_gateway_instances(id) on delete set null,
  connection_key text not null unique,
  transport text not null check (transport in ('tcp','udp')),
  protocol_version text check (protocol_version in ('2011','2019')),
  remote_ip inet,
  remote_port integer check (remote_port is null or remote_port between 1 and 65535),
  connected_at timestamptz not null default now(),
  authenticated_at timestamptz,
  disconnected_at timestamptz,
  disconnect_reason text,
  last_rx_at timestamptz,
  last_tx_at timestamptz,
  rx_bytes bigint not null default 0 check (rx_bytes >= 0),
  tx_bytes bigint not null default 0 check (tx_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_jt_terminal_sessions_terminal
  on public.jt_terminal_sessions (terminal_id, connected_at desc);
create index if not exists ix_jt_terminal_sessions_active
  on public.jt_terminal_sessions (terminal_id, disconnected_at)
  where disconnected_at is null;

-- Raw signaling audit. Retain for a limited period in production.
create table if not exists public.jt_message_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  terminal_id uuid references public.jt_terminals(id) on delete cascade,
  session_id uuid references public.jt_terminal_sessions(id) on delete set null,
  direction text not null check (direction in ('terminal_to_platform','platform_to_terminal')),
  channel text not null default 'signaling' check (channel in ('signaling','media_control','media_stream')),
  message_id integer check (message_id is null or message_id between 0 and 65535),
  message_serial integer check (message_serial is null or message_serial between 0 and 65535),
  protocol_version text check (protocol_version is null or protocol_version in ('2011','2019','1078')),
  body_length integer check (body_length is null or body_length >= 0),
  checksum_valid boolean,
  raw_hex text,
  parsed_payload jsonb not null default '{}'::jsonb,
  parse_error text,
  received_at timestamptz not null default now()
);

create index if not exists ix_jt_message_logs_terminal_time
  on public.jt_message_logs (terminal_id, received_at desc);
create index if not exists ix_jt_message_logs_message_id
  on public.jt_message_logs (message_id, received_at desc);
create index if not exists ix_jt_message_logs_errors
  on public.jt_message_logs (received_at desc)
  where parse_error is not null or checksum_valid = false;

-- Full location history from 0x0200, 0x0201 and 0x0704.
create table if not exists public.jt_positions (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  vehicle_id uuid,
  message_log_id bigint references public.jt_message_logs(id) on delete set null,
  source_message_id integer not null default 512 check (source_message_id between 0 and 65535),
  message_serial integer check (message_serial is null or message_serial between 0 and 65535),

  device_time_text text,
  located_at timestamptz,
  received_at timestamptz not null default now(),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  altitude_m integer,
  speed_kmh numeric(8,2) check (speed_kmh is null or speed_kmh >= 0),
  recorder_speed_kmh numeric(8,2) check (recorder_speed_kmh is null or recorder_speed_kmh >= 0),
  direction_deg integer check (direction_deg is null or direction_deg between 0 and 359),

  alarm_bits bigint not null default 0,
  status_bits bigint not null default 0,
  acc_on boolean,
  positioned boolean,
  north_latitude boolean,
  east_longitude boolean,
  in_service boolean,
  moving boolean,

  mileage_km numeric(14,1),
  fuel_l numeric(12,1),
  signal_strength smallint,
  satellite_count smallint,
  additional_info jsonb not null default '{}'::jsonb
);

create index if not exists ix_jt_positions_terminal_time
  on public.jt_positions (terminal_id, located_at desc, received_at desc);
create index if not exists ix_jt_positions_org_time
  on public.jt_positions (organization_id, received_at desc);
create index if not exists ix_jt_positions_vehicle_time
  on public.jt_positions (vehicle_id, located_at desc) where vehicle_id is not null;
create unique index if not exists uq_jt_positions_dedupe
  on public.jt_positions (terminal_id, located_at, message_serial)
  where located_at is not null and message_serial is not null;

-- Fast current-state table maintained by trigger.
create table if not exists public.jt_latest_positions (
  terminal_id uuid primary key references public.jt_terminals(id) on delete cascade,
  organization_id uuid not null,
  vehicle_id uuid,
  position_id bigint not null references public.jt_positions(id) on delete cascade,
  located_at timestamptz,
  received_at timestamptz not null,
  latitude double precision,
  longitude double precision,
  altitude_m integer,
  speed_kmh numeric(8,2),
  direction_deg integer,
  alarm_bits bigint not null default 0,
  status_bits bigint not null default 0,
  acc_on boolean,
  positioned boolean,
  moving boolean,
  mileage_km numeric(14,1),
  fuel_l numeric(12,1),
  signal_strength smallint,
  satellite_count smallint,
  additional_info jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists ix_jt_latest_positions_org
  on public.jt_latest_positions (organization_id, received_at desc);

create or replace function public.jt_sync_latest_position()
returns trigger
language plpgsql
as $$
begin
  insert into public.jt_latest_positions (
    terminal_id, organization_id, vehicle_id, position_id,
    located_at, received_at, latitude, longitude, altitude_m,
    speed_kmh, direction_deg, alarm_bits, status_bits,
    acc_on, positioned, moving, mileage_km, fuel_l,
    signal_strength, satellite_count, additional_info, updated_at
  ) values (
    new.terminal_id, new.organization_id, new.vehicle_id, new.id,
    new.located_at, new.received_at, new.latitude, new.longitude, new.altitude_m,
    new.speed_kmh, new.direction_deg, new.alarm_bits, new.status_bits,
    new.acc_on, new.positioned, new.moving, new.mileage_km, new.fuel_l,
    new.signal_strength, new.satellite_count, new.additional_info, now()
  )
  on conflict (terminal_id) do update set
    organization_id = excluded.organization_id,
    vehicle_id = excluded.vehicle_id,
    position_id = excluded.position_id,
    located_at = excluded.located_at,
    received_at = excluded.received_at,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    altitude_m = excluded.altitude_m,
    speed_kmh = excluded.speed_kmh,
    direction_deg = excluded.direction_deg,
    alarm_bits = excluded.alarm_bits,
    status_bits = excluded.status_bits,
    acc_on = excluded.acc_on,
    positioned = excluded.positioned,
    moving = excluded.moving,
    mileage_km = excluded.mileage_km,
    fuel_l = excluded.fuel_l,
    signal_strength = excluded.signal_strength,
    satellite_count = excluded.satellite_count,
    additional_info = excluded.additional_info,
    updated_at = now()
  where excluded.received_at >= public.jt_latest_positions.received_at;

  update public.jt_terminals
  set is_online = true,
      last_seen_at = case
        when last_seen_at is null or new.received_at > last_seen_at then new.received_at
        else last_seen_at
      end,
      last_message_id = new.source_message_id,
      updated_at = now()
  where id = new.terminal_id;

  return new;
end;
$$;

drop trigger if exists trg_jt_sync_latest_position on public.jt_positions;
create trigger trg_jt_sync_latest_position
after insert on public.jt_positions
for each row execute function public.jt_sync_latest_position();

-- Active and historical alarm lifecycle.
create table if not exists public.jt_alarms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  vehicle_id uuid,
  source text not null check (source in ('jt808','jt1078','vendor')),
  alarm_bit smallint,
  alarm_code text,
  alarm_name text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  is_active boolean not null default true,
  started_at timestamptz not null,
  ended_at timestamptz,
  first_position_id bigint references public.jt_positions(id) on delete set null,
  last_position_id bigint references public.jt_positions(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_jt_alarms_active_bit
  on public.jt_alarms (terminal_id, source, alarm_bit)
  where is_active = true and alarm_bit is not null;
create index if not exists ix_jt_alarms_org_active
  on public.jt_alarms (organization_id, is_active, started_at desc);

drop trigger if exists trg_jt_alarms_updated_at on public.jt_alarms;
create trigger trg_jt_alarms_updated_at
before update on public.jt_alarms
for each row execute function public.jt_set_updated_at();

-- Last known terminal configuration values, including standard and vendor-defined IDs.
create table if not exists public.jt_terminal_parameters (
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  organization_id uuid not null,
  parameter_id integer not null check (parameter_id between 0 and 65535),
  value_type text not null default 'raw' check (value_type in ('byte','word','dword','string','bytes','json','raw')),
  value_json jsonb not null default '{}'::jsonb,
  raw_hex text,
  source text not null default 'terminal' check (source in ('terminal','platform','provisioning')),
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (terminal_id, parameter_id)
);

create index if not exists ix_jt_terminal_parameters_org
  on public.jt_terminal_parameters (organization_id, terminal_id);

drop trigger if exists trg_jt_terminal_parameters_updated_at on public.jt_terminal_parameters;
create trigger trg_jt_terminal_parameters_updated_at
before update on public.jt_terminal_parameters
for each row execute function public.jt_set_updated_at();

-- JT/T 1078 channel inventory and capabilities.
create table if not exists public.jt_av_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  physical_channel smallint check (physical_channel is null or physical_channel between 1 and 255),
  logical_channel smallint not null check (logical_channel between 1 and 255),
  channel_type text not null default 'audio_video'
    check (channel_type in ('audio_video','audio','video')),
  cloud_connected boolean,
  video_codec text check (video_codec is null or video_codec in ('h264','h265','avs','svac','custom','unknown')),
  audio_codec text,
  max_resolution text,
  live_resolution text,
  live_frame_rate smallint,
  live_bitrate_kbps integer,
  storage_resolution text,
  storage_frame_rate smallint,
  storage_bitrate_kbps integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (terminal_id, logical_channel)
);

create index if not exists ix_jt_av_channels_org
  on public.jt_av_channels (organization_id, terminal_id);

drop trigger if exists trg_jt_av_channels_updated_at on public.jt_av_channels;
create trigger trg_jt_av_channels_updated_at
before update on public.jt_av_channels
for each row execute function public.jt_set_updated_at();

-- Durable downlink queue. The gateway claims and sends these over the active JT808 socket.
create table if not exists public.jt_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  stream_session_id uuid,
  command_name text not null,
  message_id integer not null check (message_id between 0 and 65535),
  payload jsonb not null default '{}'::jsonb,
  body_hex text,
  message_serial integer check (message_serial is null or message_serial between 0 and 65535),
  status text not null default 'queued'
    check (status in ('queued','claimed','sent','acknowledged','failed','expired','cancelled')),
  priority smallint not null default 100,
  attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 20),
  claimed_by text,
  claimed_at timestamptz,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  failed_at timestamptz,
  expires_at timestamptz,
  ack_result smallint,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_jt_commands_queue
  on public.jt_commands (status, priority desc, created_at)
  where status in ('queued','claimed','sent');
create index if not exists ix_jt_commands_terminal
  on public.jt_commands (terminal_id, created_at desc);

drop trigger if exists trg_jt_commands_updated_at on public.jt_commands;
create trigger trg_jt_commands_updated_at
before update on public.jt_commands
for each row execute function public.jt_set_updated_at();

-- Live, playback and download sessions.
create table if not exists public.jt_stream_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  vehicle_id uuid,
  gateway_instance_id text references public.jt_gateway_instances(id) on delete set null,
  session_key text not null unique,
  mode text not null check (mode in ('live','playback','download')),
  logical_channel smallint not null check (logical_channel between 1 and 255),
  data_type text not null default 'video'
    check (data_type in ('audio_video','video','two_way_audio','monitor','broadcast','transparent')),
  stream_type text not null default 'sub'
    check (stream_type in ('main','sub','all')),
  transport text not null default 'tcp' check (transport in ('tcp','udp')),
  status text not null default 'requested'
    check (status in ('requested','command_sent','connecting','active','stopping','stopped','failed','expired')),
  codec text,
  media_sim_no text,
  server_ip inet,
  tcp_port integer check (tcp_port is null or tcp_port between 1 and 65535),
  udp_port integer check (udp_port is null or udp_port between 1 and 65535),
  playback_start timestamptz,
  playback_end timestamptz,
  internal_publish_url text,
  playback_url text,
  access_token_hash text,
  request_command_id uuid references public.jt_commands(id) on delete set null,
  stop_command_id uuid references public.jt_commands(id) on delete set null,
  started_at timestamptz,
  last_packet_at timestamptz,
  ended_at timestamptz,
  bytes_received bigint not null default 0 check (bytes_received >= 0),
  packets_received bigint not null default 0 check (packets_received >= 0),
  packets_lost bigint not null default 0 check (packets_lost >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add the circular command/session foreign key after both tables exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_jt_commands_stream_session'
      and conrelid = 'public.jt_commands'::regclass
  ) then
    alter table public.jt_commands
      add constraint fk_jt_commands_stream_session
      foreign key (stream_session_id)
      references public.jt_stream_sessions(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists ix_jt_stream_sessions_terminal
  on public.jt_stream_sessions (terminal_id, created_at desc);
create index if not exists ix_jt_stream_sessions_active
  on public.jt_stream_sessions (organization_id, status, updated_at desc)
  where status in ('requested','command_sent','connecting','active','stopping');

drop trigger if exists trg_jt_stream_sessions_updated_at on public.jt_stream_sessions;
create trigger trg_jt_stream_sessions_updated_at
before update on public.jt_stream_sessions
for each row execute function public.jt_set_updated_at();

-- Remote recording catalogue returned by 0x1205.
create table if not exists public.jt_media_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  vehicle_id uuid,
  logical_channel smallint not null check (logical_channel between 1 and 255),
  start_time timestamptz not null,
  end_time timestamptz not null,
  alarm_bits_64 numeric(20,0) not null default 0,
  media_type text not null check (media_type in ('audio_video','audio','video')),
  stream_type text not null check (stream_type in ('main','sub')),
  memory_type text not null check (memory_type in ('main','disaster_recovery')),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  source_command_id uuid references public.jt_commands(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  unique (terminal_id, logical_channel, start_time, end_time, media_type, stream_type, memory_type)
);

create index if not exists ix_jt_media_resources_terminal_time
  on public.jt_media_resources (terminal_id, start_time desc);

-- Files copied from terminal FTP upload or generated clips/snapshots.
create table if not exists public.jt_media_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  terminal_id uuid not null references public.jt_terminals(id) on delete cascade,
  vehicle_id uuid,
  stream_session_id uuid references public.jt_stream_sessions(id) on delete set null,
  media_resource_id uuid references public.jt_media_resources(id) on delete set null,
  object_kind text not null check (object_kind in ('snapshot','recording','download','clip','thumbnail')),
  storage_bucket text not null default 'jt-media',
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum_sha256 text,
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists ix_jt_media_objects_terminal_time
  on public.jt_media_objects (terminal_id, captured_at desc, created_at desc);

-- Atomically claim queued commands from one or more gateway processes.
create or replace function public.jt_claim_commands(
  p_gateway_instance text,
  p_limit integer default 25
)
returns setof public.jt_commands
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jt_commands
  set status = 'expired',
      error_message = coalesce(error_message, 'Command expired before delivery'),
      updated_at = now()
  where status in ('queued','claimed','sent')
    and expires_at is not null
    and expires_at <= now();

  return query
  with picked as (
    select c.id
    from public.jt_commands c
    join public.jt_terminals t on t.id = c.terminal_id
    where c.status = 'queued'
      and t.is_enabled = true
      and t.is_online = true
      and (c.expires_at is null or c.expires_at > now())
    order by c.priority desc, c.created_at asc
    for update of c skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.jt_commands c
  set status = 'claimed',
      claimed_by = p_gateway_instance,
      claimed_at = now(),
      attempts = c.attempts + 1,
      updated_at = now()
  from picked
  where c.id = picked.id
  returning c.*;
end;
$$;

-- Gateway helper to update command lifecycle after sending or receiving 0x0001.
create or replace function public.jt_mark_command_result(
  p_command_id uuid,
  p_status text,
  p_message_serial integer default null,
  p_ack_result integer default null,
  p_error_message text default null
)
returns public.jt_commands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command public.jt_commands;
begin
  if p_status not in ('sent','acknowledged','failed','cancelled') then
    raise exception 'Unsupported command status: %', p_status;
  end if;

  update public.jt_commands
  set status = p_status,
      message_serial = coalesce(p_message_serial, message_serial),
      ack_result = p_ack_result,
      error_message = p_error_message,
      sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
      acknowledged_at = case when p_status = 'acknowledged' then now() else acknowledged_at end,
      failed_at = case when p_status = 'failed' then now() else failed_at end,
      updated_at = now()
  where id = p_command_id
  returning * into v_command;

  if v_command.id is null then
    raise exception 'Command not found: %', p_command_id;
  end if;

  return v_command;
end;
$$;

revoke all on function public.jt_claim_commands(text, integer) from public, anon, authenticated;
revoke all on function public.jt_mark_command_result(uuid, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.jt_claim_commands(text, integer) to service_role;
grant execute on function public.jt_mark_command_result(uuid, text, integer, integer, text) to service_role;

-- Convenience view for dashboard and map pages.
create or replace view public.jt_terminal_live
with (security_invoker = true)
as
select
  t.id as terminal_id,
  t.organization_id,
  t.device_id,
  t.vehicle_id,
  t.customer_id,
  t.display_name,
  t.terminal_no,
  t.media_sim_no,
  t.imei,
  t.terminal_model,
  t.plate_number,
  t.protocol_version,
  t.registration_state,
  t.is_enabled,
  t.is_online,
  t.last_seen_at,
  p.located_at,
  p.received_at as position_received_at,
  p.latitude,
  p.longitude,
  p.altitude_m,
  p.speed_kmh,
  p.direction_deg,
  p.acc_on,
  p.positioned,
  p.moving,
  p.alarm_bits,
  p.status_bits,
  p.mileage_km,
  p.fuel_l,
  p.signal_strength,
  p.satellite_count
from public.jt_terminals t
left join public.jt_latest_positions p on p.terminal_id = t.id;

-- Organization access helpers use the existing profiles table used by Birdie Fleet.
create or replace function public.jt_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.jt_can_access_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or p.organization_id = p_organization_id
      )
  );
$$;

create or replace function public.jt_can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (
          p.organization_id = p_organization_id
          and p.role in ('org_admin', 'operator')
        )
      )
  );
$$;

revoke all on function public.jt_is_super_admin() from public;
revoke all on function public.jt_can_access_org(uuid) from public;
revoke all on function public.jt_can_manage_org(uuid) from public;
grant execute on function public.jt_is_super_admin() to authenticated;
grant execute on function public.jt_can_access_org(uuid) to authenticated;
grant execute on function public.jt_can_manage_org(uuid) to authenticated;

-- Enable RLS.
alter table public.jt_gateway_instances enable row level security;
alter table public.jt_terminals enable row level security;
alter table public.jt_terminal_sessions enable row level security;
alter table public.jt_message_logs enable row level security;
alter table public.jt_positions enable row level security;
alter table public.jt_latest_positions enable row level security;
alter table public.jt_alarms enable row level security;
alter table public.jt_terminal_parameters enable row level security;
alter table public.jt_av_channels enable row level security;
alter table public.jt_commands enable row level security;
alter table public.jt_stream_sessions enable row level security;
alter table public.jt_media_resources enable row level security;
alter table public.jt_media_objects enable row level security;

-- Gateway nodes are visible only to super admins.
drop policy if exists jt_gateway_super_admin_select on public.jt_gateway_instances;
create policy jt_gateway_super_admin_select
on public.jt_gateway_instances for select
to authenticated
using (public.jt_is_super_admin());

drop policy if exists jt_gateway_super_admin_manage on public.jt_gateway_instances;
create policy jt_gateway_super_admin_manage
on public.jt_gateway_instances for all
to authenticated
using (public.jt_is_super_admin())
with check (public.jt_is_super_admin());

-- Read policies for organization-scoped tables.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'jt_terminals',
    'jt_terminal_sessions',
    'jt_message_logs',
    'jt_positions',
    'jt_latest_positions',
    'jt_alarms',
    'jt_terminal_parameters',
    'jt_av_channels',
    'jt_commands',
    'jt_stream_sessions',
    'jt_media_resources',
    'jt_media_objects'
  ] loop
    execute format('drop policy if exists jt_org_select on public.%I', v_table);
    execute format(
      'create policy jt_org_select on public.%I for select to authenticated using (public.jt_can_access_org(organization_id))',
      v_table
    );
  end loop;
end;
$$;

-- Management policies. Telemetry inserts remain service-role only.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'jt_terminals',
    'jt_terminal_parameters',
    'jt_av_channels',
    'jt_commands',
    'jt_stream_sessions',
    'jt_alarms'
  ] loop
    execute format('drop policy if exists jt_org_manage on public.%I', v_table);
    execute format(
      'create policy jt_org_manage on public.%I for all to authenticated using (public.jt_can_manage_org(organization_id)) with check (public.jt_can_manage_org(organization_id))',
      v_table
    );
  end loop;
end;
$$;

-- Realtime publication for dashboard data. Ignore duplicate publication errors.
do $$
begin
  begin
    alter publication supabase_realtime add table public.jt_terminals;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jt_latest_positions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jt_alarms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jt_stream_sessions;
  exception when duplicate_object then null;
  end;
end;
$$;

-- Private storage bucket for recordings, snapshots and clips.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('jt-media', 'jt-media', false, 2147483648)
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit;
  end if;
end;
$$;

comment on table public.jt_terminals is 'Physical JT/T 808 and JT/T 1078 terminals linked to Birdie devices and vehicles.';
comment on column public.jt_terminals.terminal_no is 'Normalized JT808 terminal phone number. Keep only digits and preserve leading-zero normalization in terminal_no_raw.';
comment on column public.jt_terminals.media_sim_no is 'JT1078 BCD[6] stream identifier, normally up to 12 digits. It may differ from the JT808-2019 BCD[10] terminal number.';
comment on table public.jt_commands is 'Durable downlink command queue consumed by the always-on JT gateway.';
comment on table public.jt_message_logs is 'Raw signaling audit. Apply a scheduled retention policy, usually 7 to 30 days.';

commit;
