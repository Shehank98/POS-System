/**
 * Safe type conversion helpers.
 * Use at API boundaries where server may return strings instead of numbers
 * or null/undefined for optional numeric fields.
 */

export function safeNum(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

export function safeInt(value, fallback = 0) {
  const n = safeNum(value, fallback);
  return Math.trunc(n);
}

export function safeFloat(value, fallback = 0.0) {
  return safeNum(value, fallback);
}

export function safeStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeBool(value, fallback = false) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}
