import { authApi } from '../api/client';

const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : '';

/**
 * Canonical receipt size key stored in localStorage.
 * Settings page saves '80mm' | '58mm' | 'a4'.
 * 'narrow' was the legacy key for 58mm - normalised transparently.
 */
export function getReceiptSize() {
  const raw = localStorage.getItem('pos_receipt_size');
  if (!raw || raw === '') return '80mm';
  if (raw === 'narrow')   return '58mm'; // normalise legacy value
  return raw; // '80mm' | '58mm' | 'a4'
}

export function setReceiptSize(size) {
  localStorage.setItem('pos_receipt_size', size);
}

export function isA4Receipt() {
  return getReceiptSize() === 'a4';
}

/** Returns 32 (58mm) or 48 (80mm). Falls back to 48. */
export function getThermalWidth() {
  return getReceiptSize() === '58mm' ? 32 : 48;
}

export function setAutoPrint(enabled) {
  localStorage.setItem('pos_auto_print', enabled ? 'true' : 'false');
}

export function getAutoPrint() {
  return localStorage.getItem('pos_auto_print') === 'true';
}

/**
 * Opens the server-rendered HTML receipt (used for A4 printing).
 */
export function openReceipt(transactionId) {
  const token = localStorage.getItem('pos_token');
  if (!token) return;
  const url = `${BASE}/api/transactions/${transactionId}/receipt?token=${encodeURIComponent(token)}`;
  window.open(url, '_blank', 'width=500,height=700,noopener');
}

/**
 * Opens the thermal plain-text receipt for a transaction in a new tab.
 * Honours the saved paper-size preference automatically.
 */
export function openThermalReceipt(transactionId) {
  const token = localStorage.getItem('pos_token');
  if (!token) return;
  const size = getReceiptSize() === '58mm' ? '32' : '48';
  const url  = `${BASE}/api/transactions/${transactionId}/receipt?format=thermal&size=${size}&token=${encodeURIComponent(token)}`;
  window.open(url, '_blank', 'width=640,height=800,noopener');
}
