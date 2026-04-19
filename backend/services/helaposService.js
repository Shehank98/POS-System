const axios = require('axios');
const db    = require('../config/database');

const BASE_URL = 'https://helapos.lk/merchant-api';

async function getConfig(shopId) {
  const { rows } = await db.query(
    'SELECT * FROM shop_helapos_config WHERE shop_id = $1',
    [shopId]
  );
  return rows[0] || null;
}

async function saveTokens(shopId, { accessToken, refreshToken, expiresInSeconds = 3600 }) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await db.query(
    `UPDATE shop_helapos_config
        SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
      WHERE shop_id = $4`,
    [accessToken, refreshToken, expiresAt, shopId]
  );
}

// Fetch a brand-new token pair using client_credentials grant
async function fetchNewToken(shopId, appId, appSecret) {
  const authCode = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const res = await axios.post(
    `${BASE_URL}/merchant/api/v1/getToken`,
    { grant_type: 'client_credentials' },
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${authCode}`,
      },
      timeout: 15000,
    }
  );
  return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
}

// Refresh using the stored refresh token
async function refreshToken(refreshTok) {
  const res = await axios.post(
    `${BASE_URL}/merchant/api/v1/merchant/auth/refresh`,
    { refreshToken: refreshTok },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  const d = res.data.data?.[0] || res.data;
  return { accessToken: d.accessToken, refreshToken: d.refreshToken };
}

// Returns a valid access token, refreshing or re-fetching as needed
async function getOrRefreshToken(shopId) {
  const cfg = await getConfig(shopId);
  if (!cfg) throw new Error('HelaPOS not configured for this shop');

  const now         = Date.now();
  const expiresAt   = cfg.token_expires_at ? new Date(cfg.token_expires_at).getTime() : 0;
  const aboutToExp  = expiresAt - now < 60_000; // within 60 s

  let tokens;
  if (cfg.access_token && !aboutToExp) {
    return cfg.access_token;
  } else if (cfg.refresh_token) {
    try {
      tokens = await refreshToken(cfg.refresh_token);
    } catch {
      tokens = await fetchNewToken(shopId, cfg.app_id, cfg.app_secret);
    }
  } else {
    tokens = await fetchNewToken(shopId, cfg.app_id, cfg.app_secret);
  }

  await saveTokens(shopId, tokens);
  return tokens.accessToken;
}

async function generateQR(shopId, businessId, reference, amount) {
  const token = await getOrRefreshToken(shopId);
  const res = await axios.post(
    `${BASE_URL}/merchant/api/helapos/qr/generate`,
    { b: businessId, r: reference, am: amount },
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      timeout: 15000,
    }
  );
  if (res.data.statusCode !== '200') {
    throw new Error(res.data.statusMessage || 'QR generation failed');
  }
  return { qr_data: res.data.qr_data, qr_reference: res.data.qr_reference };
}

async function checkPaymentStatus(shopId, reference, qrReference) {
  const token = await getOrRefreshToken(shopId);
  const body  = {};
  if (reference)   body.reference    = reference;
  if (qrReference) body.qr_reference = qrReference;

  const res = await axios.post(
    `${BASE_URL}/merchant/api/helapos/sales/getSaleStatus`,
    body,
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      timeout: 15000,
    }
  );
  return res.data;
}

module.exports = { getConfig, getOrRefreshToken, generateQR, checkPaymentStatus };
