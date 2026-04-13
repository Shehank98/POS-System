-- Add extra staff slots column to shops (run once in Railway Data tab)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS extra_staff_slots INT DEFAULT 0;
