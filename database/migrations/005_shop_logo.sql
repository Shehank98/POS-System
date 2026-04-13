-- Add logo URL and contact email to shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
