-- Birdie Fleet Monitoring Platform - Initial Schema
-- Run this migration in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'operator', 'viewer');
CREATE TYPE device_status AS ENUM ('active', 'inactive', 'maintenance', 'decommissioned');
CREATE TYPE vehicle_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE stream_type AS ENUM ('webrtc', 'hls');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'assign', 'unassign', 'stream_start', 'stream_stop');

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Saudi Arabia',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  plate_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  vin TEXT,
  status vehicle_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, plate_number)
);

-- Device Models
CREATE TABLE device_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT 'Birdie',
  type TEXT NOT NULL CHECK (type IN ('dash_cam', 'gps_tracker', 'combo')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_model_id UUID REFERENCES device_models(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL,
  imei TEXT,
  sim_number TEXT,
  firmware_version TEXT,
  status device_status NOT NULL DEFAULT 'inactive',
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, serial_number)
);

-- Vehicle Device Assignments
CREATE TABLE vehicle_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, device_id)
);

-- Vehicle Locations
CREATE TABLE vehicle_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  altitude_m DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  ignition_on BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_locations_vehicle_recorded ON vehicle_locations(vehicle_id, recorded_at DESC);
CREATE INDEX idx_vehicle_locations_org ON vehicle_locations(organization_id);

-- Camera Streams
CREATE TABLE camera_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL,
  stream_type stream_type NOT NULL DEFAULT 'hls',
  stream_url TEXT,
  webrtc_signaling_url TEXT,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Conversations
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  wa_phone_number TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Messages
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  body TEXT NOT NULL,
  wa_message_id TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id, sent_at DESC);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- Helper: get current user's organization
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER camera_streams_updated_at BEFORE UPDATE ON camera_streams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER whatsapp_conversations_updated_at BEFORE UPDATE ON whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup (requires organization_id in metadata)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  user_role_val user_role;
BEGIN
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  user_role_val := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer');

  IF org_id IS NOT NULL THEN
    INSERT INTO profiles (id, organization_id, email, full_name, role)
    VALUES (
      NEW.id,
      org_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      user_role_val
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = auth.organization_id());

-- Profiles policies
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Admins can manage org profiles"
  ON profiles FOR ALL
  USING (
    organization_id = auth.organization_id()
    AND auth.user_role() IN ('super_admin', 'org_admin')
  );

-- Generic org-scoped policies
CREATE POLICY "Org members can view customers" ON customers FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage customers" ON customers FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view vehicles" ON vehicles FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage vehicles" ON vehicles FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view device_models" ON device_models FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Admins can manage device_models" ON device_models FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin'));

CREATE POLICY "Org members can view devices" ON devices FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage devices" ON devices FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view vehicle_devices" ON vehicle_devices FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage vehicle_devices" ON vehicle_devices FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view locations" ON vehicle_locations FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "System can insert locations" ON vehicle_locations FOR INSERT WITH CHECK (organization_id = auth.organization_id());

CREATE POLICY "Org members can view streams" ON camera_streams FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage streams" ON camera_streams FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view whatsapp conversations" ON whatsapp_conversations FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage whatsapp conversations" ON whatsapp_conversations FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view whatsapp messages" ON whatsapp_messages FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "Operators+ can manage whatsapp messages" ON whatsapp_messages FOR ALL USING (organization_id = auth.organization_id() AND auth.user_role() IN ('super_admin', 'org_admin', 'operator'));

CREATE POLICY "Org members can view audit logs" ON audit_logs FOR SELECT USING (organization_id = auth.organization_id());
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (organization_id = auth.organization_id());

-- Enable Realtime for vehicle_locations
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_locations;

-- Seed default organization and device models (optional)
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Birdie Fleet', 'birdie-fleet');

INSERT INTO device_models (organization_id, name, manufacturer, type, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Birdie Dash Cam Pro', 'Birdie', 'dash_cam', '4K dual-channel dash camera with GPS'),
  ('00000000-0000-0000-0000-000000000001', 'Birdie GPS Tracker', 'Birdie', 'gps_tracker', 'Real-time GPS tracking device'),
  ('00000000-0000-0000-0000-000000000001', 'Birdie Fleet Combo', 'Birdie', 'combo', 'Integrated dash cam and GPS tracker');
