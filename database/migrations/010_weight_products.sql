-- Migration 010: Weight-based product support
-- unit_type: 'unit' (default, sold by count)
--            'kg'   (sold by weight; price is price-per-kg)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_type VARCHAR(10) NOT NULL DEFAULT 'unit';
