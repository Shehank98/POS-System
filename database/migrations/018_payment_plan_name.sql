-- Add plan_name to payments to track which subscription tier was purchased
ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50);
