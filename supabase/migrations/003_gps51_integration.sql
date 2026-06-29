-- GPS51 webhook integration tables and optional device telemetry columns

CREATE TABLE IF NOT EXISTS gps51_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsed_device_id TEXT,
  parsed_latitude DOUBLE PRECISION,
  parsed_longitude DOUBLE PRECISION,
  parsed_speed_kmh DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS gps51_device_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gps51_device_id TEXT NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gps51_mappings_device_id_unique
  ON gps51_device_mappings (gps51_device_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gps51_logs_received_at
  ON gps51_webhook_logs (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_gps51_mappings_gps51_id
  ON gps51_device_mappings (gps51_device_id);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_speed_kmh DOUBLE PRECISION;
