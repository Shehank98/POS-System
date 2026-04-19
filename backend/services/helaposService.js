const db = require('../config/database');

const BASE_URL = 'https://helapos.lk/merchant-api';

async function helaPost(url, body, authHeader) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HelaPOS ${res.status}: ${text}`);
  }
  return res.json();
}

async function getOrRefreshToken(shopId) {
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

  let tokenData;
  if (cfg.refresh_token && cfg.access_token) {
    // API uses refreshToken (camelCase) per docs
    const raw = await helaPost(
      `${BASE_URL}/merchant/api/v1/merchant/auth/refresh`,
      { refreshToken: cfg.refresh_token },
      `Bearer ${cfg.access_token}`
    );
    // Response nests tokens inside data[0]
    const d = Array.isArray(raw.data) ? raw.data[0] : raw.data || raw;
    tokenData = {
      access_token:  d.accessToken  || d.access_token,
      refresh_token: d.refreshToken || d.refresh_token || cfg.refresh_token,
    };
  } else {
    const credentials = Buffer.from(`${cfg.app_id}:${cfg.app_secret}`).toString('base64');
    const raw = await helaPost(
      `${BASE_URL}/merchant/api/v1/getToken`,
      { grant_type: 'client_credentials' },
      `Basic ${credentials}`
    );
    tokenData = {
      access_token:  raw.accessToken  || raw.access_token,
      refresh_token: raw.refreshToken || raw.refresh_token,
    };
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000); // tokens valid ~1 hour
  await db.query(
    `UPDATE shop_helapos_config
     SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
     WHERE shop_id = $4`,
    [tokenData.access_token, tokenData.refresh_token, expiresAt, shopId]
  );

  return tokenData.access_token;
}

async function generateQR(shopId, businessId, reference, amount) {
  const token = await getOrRefreshToken(shopId);
  const raw = await helaPost(
    `${BASE_URL}/merchant/api/helapos/qr/generate`,
    { b: businessId, r: reference, am: amount },
    `Bearer ${token}`
  );
  return {
    qr_data:      raw.qr_data      || raw.qrData,
    qr_reference: raw.qr_reference || raw.qrReference || raw.reference,
  };
}

async function checkPaymentStatus(shopId, reference, qrReference) {
  const token = await getOrRefreshToken(shopId);
  const raw = await helaPost(
    `${BASE_URL}/merchant/api/helapos/sales/getSaleStatus`,
    { reference, qr_reference: qrReference },
    `Bearer ${token}`
  );
  return {
    payment_status: raw.sale?.payment_status ?? raw.payment_status ?? 0,
    sale:           raw.sale || null,
  };
}

module.exports = { getOrRefreshToken, generateQR, checkPaymentStatus };
