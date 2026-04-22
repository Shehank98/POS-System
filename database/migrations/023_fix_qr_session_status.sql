-- Fix qr_payment_sessions rows that were incorrectly set to HelaPOS HTTP status
-- codes (e.g. 404) instead of real payment statuses (0=pending, 2=paid, -1=failed).
-- Sessions still within their expiry window are reset to pending (0) so an in-flight
-- webhook or the next poll can settle them correctly.
-- Expired sessions with invalid status are marked failed (-1).
UPDATE qr_payment_sessions
   SET payment_status = 0, updated_at = NOW()
 WHERE payment_status NOT IN (0, 2, -1)
   AND expires_at > NOW();

UPDATE qr_payment_sessions
   SET payment_status = -1, updated_at = NOW()
 WHERE payment_status NOT IN (0, 2, -1)
   AND expires_at <= NOW();
