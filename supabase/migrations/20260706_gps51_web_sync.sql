-- Birdie Fleet GPS51 Web Sync
-- Browser-session based read-only ingestion from the authorized GPS51 web portal.
-- Additive migration. It does not modify JT808/JT1078 tables or existing Birdie tables.

begin;

create extension if not exists pgcrypto;

create or replace function public.gps51_web_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.gps51_web_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  username text not null,
  portal_url text not null,
  monitor_url text,
  status text not null default 'pending'
    check (status in ('pending','active','reauth_required','disabled','error')),
  last_auth_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, username, portal_url)
);

drop trigger if exists trg_gps51_web_accounts_updated_at on public.gps51_web_accounts;
create trigger trg_gps51_web_accounts_updated_at
before update on public.gps51_web_accounts
for each row execute function public.gps51_web_set_updated_at();

create table if not exists public.gps51_web_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  account_id uuid not null references public.gps51_web_accounts(id) on delete cascade,

  source_device_id text not null,
  device_name text,
  imei text,
  sim_no text,
  group_path text,

  birdie_device_id uuid,
  vehicle_id uuid,
  customer_id uuid,

  online_status text not null default 'unknown'
    check (online_status in ('online','offline','unknown')),
  source_updated_at timestamptz,
  source_located_at timestamptz,
  last_seen_at timestamptz,

  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  speed_kmh numeric(9,2) check (speed_kmh is null or speed_kmh >= 0),
  acc_on boolean,
  status_text text,
  address text,
  satellite_count smallint,
  cellular_signal_percent smallint
    check (cellular_signal_percent is null or cellular_signal_percent between 0 and 100),
  mileage_km numeric(16,2),
  media_channels jsonb not null default '[]'::jsonb,

  first_seen_at timestamptz not null default now(),
  last_scraped_at timestamptz not null default now(),
  raw_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (account_id, source_device_id)
);

create index if not exists ix_gps51_web_devices_org
  on public.gps51_web_devices (organization_id, online_status, last_scraped_at desc);
create index if not exists ix_gps51_web_devices_imei
  on public.gps51_web_devices (imei) where imei is not null;
create index if not exists ix_gps51_web_devices_sim
  on public.gps51_web_devices (sim_no) where sim_no is not null;
create index if not exists ix_gps51_web_devices_birdie
  on public.gps51_web_devices (birdie_device_id) where birdie_device_id is not null;

drop trigger if exists trg_gps51_web_devices_updated_at on public.gps51_web_devices;
create trigger trg_gps51_web_devices_updated_at
before update on public.gps51_web_devices
for each row execute function public.gps51_web_set_updated_at();

create table if not exists public.gps51_web_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  account_id uuid not null references public.gps51_web_accounts(id) on delete cascade,
  status text not null
    check (status in ('running','success','partial','failed','reauth_required')),
  mode text not null default 'sync'
    check (mode in ('auth','discover','sync','one_shot')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  devices_visible integer,
  devices_upserted integer not null default 0,
  positions_inserted integer not null default 0,
  parse_failures integer not null default 0,
  duration_ms integer,
  error_message text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_gps51_web_sync_runs_account
  on public.gps51_web_sync_runs (account_id, started_at desc);

create table if not exists public.gps51_web_raw_payloads (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  account_id uuid not null references public.gps51_web_accounts(id) on delete cascade,
  sync_run_id uuid references public.gps51_web_sync_runs(id) on delete set null,
  payload_kind text not null
    check (payload_kind in ('device_list','position','account_tree','websocket','dom','unknown')),
  source_url text,
  payload_hash text not null,
  sanitized_payload jsonb not null,
  captured_at timestamptz not null default now(),
  unique (account_id, payload_hash)
);

create index if not exists ix_gps51_web_raw_payloads_time
  on public.gps51_web_raw_payloads (account_id, captured_at desc);

create table if not exists public.gps51_web_positions (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  account_id uuid not null references public.gps51_web_accounts(id) on delete cascade,
  gps51_device_id uuid not null references public.gps51_web_devices(id) on delete cascade,
  sync_run_id uuid references public.gps51_web_sync_runs(id) on delete set null,

  source_updated_at timestamptz,
  source_located_at timestamptz,
  received_at timestamptz not null default now(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed_kmh numeric(9,2) check (speed_kmh is null or speed_kmh >= 0),
  acc_on boolean,
  online_status text check (online_status is null or online_status in ('online','offline','unknown')),
  status_text text,
  address text,
  satellite_count smallint,
  cellular_signal_percent smallint
    check (cellular_signal_percent is null or cellular_signal_percent between 0 and 100),
  mileage_km numeric(16,2),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_gps51_web_positions_device_time
  on public.gps51_web_positions (gps51_device_id, source_located_at desc, received_at desc);
create index if not exists ix_gps51_web_positions_org_time
  on public.gps51_web_positions (organization_id, received_at desc);

create unique index if not exists uq_gps51_web_positions_dedupe
  on public.gps51_web_positions (
    gps51_device_id,
    coalesce(source_updated_at, '-infinity'::timestamptz),
    coalesce(source_located_at, '-infinity'::timestamptz),
    latitude,
    longitude,
    coalesce(speed_kmh, -1)
  );

create table if not exists public.gps51_web_latest_positions (
  gps51_device_id uuid primary key references public.gps51_web_devices(id) on delete cascade,
  organization_id uuid not null,
  account_id uuid not null references public.gps51_web_accounts(id) on delete cascade,
  position_id bigint not null references public.gps51_web_positions(id) on delete cascade,
  source_updated_at timestamptz,
  source_located_at timestamptz,
  received_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  speed_kmh numeric(9,2),
  acc_on boolean,
  online_status text,
  status_text text,
  address text,
  satellite_count smallint,
  cellular_signal_percent smallint,
  mileage_km numeric(16,2),
  updated_at timestamptz not null default now()
);

create index if not exists ix_gps51_web_latest_positions_org
  on public.gps51_web_latest_positions (organization_id, received_at desc);

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
    updated_at = now()
  where excluded.received_at >= public.gps51_web_latest_positions.received_at;

  update public.gps51_web_devices
  set source_updated_at = coalesce(new.source_updated_at, source_updated_at),
      source_located_at = coalesce(new.source_located_at, source_located_at),
      last_seen_at = case
        when new.online_status = 'online' then new.received_at
        else last_seen_at
      end,
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
      last_scraped_at = new.received_at,
      updated_at = now()
  where id = new.gps51_device_id;

  return new;
end;
$$;

drop trigger if exists trg_gps51_web_sync_latest_position on public.gps51_web_positions;
create trigger trg_gps51_web_sync_latest_position
after insert on public.gps51_web_positions
for each row execute function public.gps51_web_sync_latest_position();

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
  d.media_channels,
  d.last_scraped_at
from public.gps51_web_devices d
left join public.gps51_web_latest_positions p
  on p.gps51_device_id = d.id;

create or replace function public.gps51_web_can_access_org(p_organization_id uuid)
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

create or replace function public.gps51_web_can_manage_org(p_organization_id uuid)
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

revoke all on function public.gps51_web_can_access_org(uuid) from public;
revoke all on function public.gps51_web_can_manage_org(uuid) from public;
grant execute on function public.gps51_web_can_access_org(uuid) to authenticated;
grant execute on function public.gps51_web_can_manage_org(uuid) to authenticated;

alter table public.gps51_web_accounts enable row level security;
alter table public.gps51_web_devices enable row level security;
alter table public.gps51_web_positions enable row level security;
alter table public.gps51_web_latest_positions enable row level security;
alter table public.gps51_web_sync_runs enable row level security;
alter table public.gps51_web_raw_payloads enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'gps51_web_accounts',
    'gps51_web_devices',
    'gps51_web_positions',
    'gps51_web_latest_positions',
    'gps51_web_sync_runs',
    'gps51_web_raw_payloads'
  ] loop
    execute format('drop policy if exists gps51_web_org_select on public.%I', v_table);
    execute format(
      'create policy gps51_web_org_select on public.%I for select to authenticated using (public.gps51_web_can_access_org(organization_id))',
      v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'gps51_web_accounts',
    'gps51_web_devices'
  ] loop
    execute format('drop policy if exists gps51_web_org_manage on public.%I', v_table);
    execute format(
      'create policy gps51_web_org_manage on public.%I for all to authenticated using (public.gps51_web_can_manage_org(organization_id)) with check (public.gps51_web_can_manage_org(organization_id))',
      v_table
    );
  end loop;
end;
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.gps51_web_devices;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.gps51_web_latest_positions;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.gps51_web_sync_runs;
  exception when duplicate_object then null;
  end;
end;
$$;

comment on table public.gps51_web_devices is
  'Read-only device inventory captured from the authorized GPS51 browser session. Separate from direct JT terminal data.';
comment on table public.gps51_web_positions is
  'GPS51 web location history. Do not write these rows into JT tables.';
comment on table public.gps51_web_raw_payloads is
  'Sanitized discovery payloads only. Never store authorization headers, cookies, passwords or access tokens.';

commit;
