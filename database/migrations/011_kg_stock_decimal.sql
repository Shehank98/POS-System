-- Migration 011: Allow decimal stock quantities for KG (weight-based) products
-- stock_quantity was INTEGER; change to NUMERIC(10,3) so 50.5 KG can be stored.
-- Existing integer values are preserved exactly (e.g. 100 → 100.000).

ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE NUMERIC(10,3)
    USING stock_quantity::NUMERIC(10,3);
