-- Add parsed address and GPS status columns to webhook logs

ALTER TABLE gps51_webhook_logs
  ADD COLUMN IF NOT EXISTS parsed_address TEXT,
  ADD COLUMN IF NOT EXISTS parsed_gps_status TEXT;
