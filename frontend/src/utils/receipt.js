import { authApi } from '../api/client';

const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : '';

/**
 * Opens the receipt HTML page for a transaction in a new tab.
 * The backend renders the full HTML; localStorage settings are
 * applied by the receipt page's own script.
 */
export function openReceipt(transactionId) {
  const token = localStorage.getItem('pos_token');
  if (!token) return;

  // We can't set headers on window.open, so we pass the token as a query param.
  // The receipt endpoint must accept ?token= as an alternative to Authorization header.
  const url = `${BASE}/api/transactions/${transactionId}/receipt?token=${encodeURIComponent(token)}`;
  window.open(url, '_blank', 'width=500,height=700,noopener');
}

/** Saves the preferred receipt size to localStorage */
export function setReceiptSize(size) {
  localStorage.setItem('pos_receipt_size', size);
}

export function getReceiptSize() {
  return localStorage.getItem('pos_receipt_size') || '80mm';
}

export function setAutoPrint(enabled) {
  localStorage.setItem('pos_auto_print', enabled ? 'true' : 'false');
}

export function getAutoPrint() {
  return localStorage.getItem('pos_auto_print') === 'true';
}
