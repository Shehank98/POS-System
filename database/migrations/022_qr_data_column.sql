-- Add qr_data column to store the QR string for mobile display
ALTER TABLE qr_payment_sessions ADD COLUMN IF NOT EXISTS qr_data TEXT;
