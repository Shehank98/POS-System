/**
 * System-level HelaPOS service.
 * Uses the platform's own credentials (from env vars) rather than per-shop credentials.
 * Used for billing QR payments so shops can pay their activation/subscription fee.
 */
const db = require('../config/database');

const BASE_URL     = 'https://helapos.lk/merchant-api';
const APP_ID       = process.env.HELAPOS_SYSTEM_APP_ID;
const APP_SECRET   = process.env.HELAPOS_SYSTEM_APP_SECRET;
const BUSINESS_ID  = process.env.HELAPOS_SYSTEM_BUSINESS_ID;

let refreshLock = null; // in-flight refresh promise

async function helaPost(url, body, authHeader) {
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const res  = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  console.log(`[SysHelaPOS] ${res.status} ← ${url.split('/').slice(-2).join('/')}: ${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(`HelaPOS ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function fetchFreshToken() {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('HELAPOS_SYSTEM_APP_ID / HELAPOS_SYSTEM_APP_SECRET not configured');
  }
  const creds = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64');
  const raw   = await helaPost(
    `${BASE_URL}/merchant/api/v1/getToken`,
    { grant_type: 'client_credentials' },
    `Basic ${creds}`
  );
  return {
    access_token:  raw.accessToken  || raw.access_token,
    refresh_token: raw.refreshToken || raw.refresh_token,
  };
}

async function getOrRefreshToken() {
  // Wait if another call is already refreshing
  if (refreshLock) await refreshLock;

  // Read cached token from DB
  const { rows } = await db.query('SELECT * FROM system_helapos_token WHERE id = 1');
  const cached   = rows[0];

  const needsRefresh =
    !cached?.access_token ||
    !cached?.expires_at  ||
    new Date(cached.expires_at) <= new Date(Date.now() + 60_000);

  if (!needsRefresh) return cached.access_token;

  // Acquire lock
  let unlock;
  refreshLock = new Promise((r) => { unlock = r; });

  try {
    let tokenData;

    if (cached?.refresh_token) {
      try {
        const raw = await helaPost(
          `${BASE_URL}/merchant/api/v1/merchant/auth/refresh`,
          { refreshToken: cached.refresh_token },
          ''
        );
        const d = Array.isArray(raw.data) ? raw.data[0] : (raw.data || raw);
        tokenData = {
          access_token:  d.accessToken  || d.access_token,
          refresh_token: d.refreshToken || d.refresh_token || cached.refresh_token,
        };
      } catch {
        tokenData = await fetchFreshToken();
      }
    } else {
      tokenData = await fetchFreshToken();
    }

    if (!tokenData.access_token) {
      throw new Error('HelaPOS returned no access_token for system credentials');
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    await db.query(
      `INSERT INTO system_helapos_token (id, access_token, refresh_token, expires_at, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE
         SET access_token  = $1,
             refresh_token = $2,
             expires_at    = $3,
             updated_at    = NOW()`,
      [tokenData.access_token, tokenData.refresh_token, expiresAt]
    );

    return tokenData.access_token;
  } finally {
    refreshLock = null;
    unlock();
  }
}

async function generateBillingQR(reference, amount) {
  if (!BUSINESS_ID) throw new Error('HELAPOS_SYSTEM_BUSINESS_ID not configured');
  const token = await getOrRefreshToken();
  const raw   = await helaPost(
    `${BASE_URL}/merchant/api/helapos/qr/generate`,
    { b: BUSINESS_ID, r: reference, am: Number(amount) },
    `Bearer ${token}`
  );
  const qr_data      = raw.qr_data      || raw.qrData;
  const qr_reference = raw.qr_reference || raw.qrReference || raw.reference;
  if (!qr_data) throw new Error('HelaPOS did not return qr_data: ' + JSON.stringify(raw));
  return { qr_data, qr_reference };
}

async function checkBillingQRStatus(reference, qrReference) {
  const token = await getOrRefreshToken();
  const body  = qrReference ? { qr_reference: qrReference } : { reference };
  const raw   = await helaPost(
    `${BASE_URL}/merchant/api/helapos/sales/getSaleStatus`,
    body,
    `Bearer ${token}`
  );
  const status = raw.sale?.payment_status ?? raw.payment_status ?? 0;
  return { payment_status: Number(status), sale: raw.sale || null };
}

module.exports = { generateBillingQR, checkBillingQRStatus, getOrRefreshToken };
