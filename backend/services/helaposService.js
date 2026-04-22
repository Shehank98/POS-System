const db = require('../config/database');

const BASE_URL = 'https://helapos.lk/merchant-api';

// Per-shop promise locks — prevents concurrent token refreshes (multiple cashiers)
const refreshLocks = new Map();

async function helaPost(url, body, authHeader) {
  console.log(`[HelaPOS] POST ${url}`);
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const res = await fetch(url, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`[HelaPOS] ${res.status} ← ${url} : ${text.slice(0, 200)}`);
  if (!res.ok) {
    throw new Error(`HelaPOS ${res.status}: ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function fetchFreshToken(cfg) {
  const credentials = Buffer.from(`${cfg.app_id}:${cfg.app_secret}`).toString('base64');
  const raw = await helaPost(
    `${BASE_URL}/merchant/api/v1/getToken`,
    { grant_type: 'client_credentials' },
    `Basic ${credentials}`
  );
  return {
    access_token:  raw.accessToken  || raw.access_token,
    refresh_token: raw.refreshToken || raw.refresh_token,
  };
}

async function getOrRefreshToken(shopId) {
  // Wait if another call is already refreshing this shop's token
  if (refreshLocks.has(shopId)) {
    await refreshLocks.get(shopId);
    // Re-read DB after waiting — other caller stored fresh token
  }

  const { rows } = await db.query(
    'SELECT * FROM shop_helapos_config WHERE shop_id = $1',
    [shopId]
  );
  if (!rows.length) throw new Error('HelaPOS not configured for this shop');
  const cfg = rows[0];

  const needsRefresh =
    !cfg.access_token ||
    !cfg.token_expires_at ||
    new Date(cfg.token_expires_at) <= new Date(Date.now() + 60_000);

  if (!needsRefresh) return cfg.access_token;

  // Acquire lock
  let resolveLock;
  const lockPromise = new Promise((r) => { resolveLock = r; });
  refreshLocks.set(shopId, lockPromise);

  try {
    let tokenData;

    if (cfg.refresh_token) {
      // Try refresh first; API docs show no Authorization header for this endpoint
      try {
        const raw = await helaPost(
          `${BASE_URL}/merchant/api/v1/merchant/auth/refresh`,
          { refreshToken: cfg.refresh_token },
          ''  // no Authorization header per HelaPOS API docs v1.2.0
        );
        const d = Array.isArray(raw.data) ? raw.data[0] : (raw.data || raw);
        tokenData = {
          access_token:  d.accessToken  || d.access_token,
          refresh_token: d.refreshToken || d.refresh_token || cfg.refresh_token,
        };
        console.log('[HelaPOS] token refreshed via refresh_token');
      } catch (refreshErr) {
        console.warn('[HelaPOS] refresh failed, falling back to getToken:', refreshErr.message);
        tokenData = await fetchFreshToken(cfg);
        console.log('[HelaPOS] token obtained via getToken (fallback)');
      }
    } else {
      tokenData = await fetchFreshToken(cfg);
      console.log('[HelaPOS] token obtained via getToken (first time)');
    }

    if (!tokenData.access_token) {
      throw new Error('HelaPOS returned no access_token. Check your App ID and App Secret.');
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    await db.query(
      `UPDATE shop_helapos_config
       SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
       WHERE shop_id = $4`,
      [tokenData.access_token, tokenData.refresh_token, expiresAt, shopId]
    );

    return tokenData.access_token;
  } finally {
    refreshLocks.delete(shopId);
    resolveLock();
  }
}

async function generateQR(shopId, businessId, reference, amount) {
  const token = await getOrRefreshToken(shopId);
  const raw = await helaPost(
    `${BASE_URL}/merchant/api/helapos/qr/generate`,
    { b: businessId, r: reference, am: amount },
    `Bearer ${token}`
  );
  const qr_data      = raw.qr_data      || raw.qrData;
  const qr_reference = raw.qr_reference || raw.qrReference || raw.reference;
  if (!qr_data) throw new Error('HelaPOS did not return qr_data. Response: ' + JSON.stringify(raw));
  return { qr_data, qr_reference };
}

async function checkPaymentStatus(shopId, businessId, reference, qrReference) {
  const token = await getOrRefreshToken(shopId);
  // HelaPOS only recognises their own qr_reference for status lookups.
  // Sending our UUID as "reference" causes 404 even when paired with qr_reference.
  // Prefer qr_reference; fall back to reference only when qr_reference is absent.
  const body = {};
  if (qrReference) body.qr_reference = qrReference;
  else             body.reference    = reference;
  console.log('[HelaPOS] getSaleStatus body:', JSON.stringify(body));
  const raw = await helaPost(
    `${BASE_URL}/merchant/api/helapos/sales/getSaleStatus`,
    body,
    `Bearer ${token}`
  );
  console.log('[HelaPOS] getSaleStatus raw response:', JSON.stringify(raw));
  const status = raw.sale?.payment_status ?? raw.payment_status ?? raw.statusCode ?? 0;
  return {
    payment_status: Number(status),
    sale:           raw.sale || null,
  };
}

module.exports = { getOrRefreshToken, generateQR, checkPaymentStatus };
