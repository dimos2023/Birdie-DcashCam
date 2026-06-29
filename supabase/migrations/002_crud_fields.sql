-- CRUD field extensions for customers and devices

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending', 'granted', 'declined'));

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS activation_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_start DATE,
  ADD COLUMN IF NOT EXISTS warranty_end DATE;
