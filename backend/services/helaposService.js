const axios = require('axios');
const db    = require('../config/database');

const BASE_URL = 'https://helapos.lk/merchant-api';

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
    const res = await axios.post(
      `${BASE_URL}/merchant/api/v1/merchant/auth/refresh`,
      { refresh_token: cfg.refresh_token },
      { headers: { Authorization: `Bearer ${cfg.access_token}` } }
    );
    tokenData = res.data;
  } else {
    const credentials = Buffer.from(`${cfg.app_id}:${cfg.app_secret}`).toString('base64');
    const res = await axios.post(
      `${BASE_URL}/merchant/api/v1/getToken`,
      {},
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    tokenData = res.data;
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
  await db.query(
    `UPDATE shop_helapos_config
     SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
     WHERE shop_id = $4`,
    [tokenData.access_token, tokenData.refresh_token || cfg.refresh_token, expiresAt, shopId]
  );

  return tokenData.access_token;
}

async function generateQR(shopId, businessId, reference, amount) {
  const token = await getOrRefreshToken(shopId);
  const res = await axios.post(
    `${BASE_URL}/merchant/api/helapos/qr/generate`,
    { b: businessId, r: reference, am: amount },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    qr_data:      res.data.qr_data      || res.data.qrData,
    qr_reference: res.data.qr_reference || res.data.qrReference || res.data.ref,
  };
}

async function checkPaymentStatus(shopId, reference, qrReference) {
  const token = await getOrRefreshToken(shopId);
  const res = await axios.post(
    `${BASE_URL}/merchant/api/helapos/sales/getSaleStatus`,
    { reference, qr_reference: qrReference },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    payment_status: res.data.payment_status ?? res.data.paymentStatus ?? 0,
    sale:           res.data.sale || null,
  };
}

module.exports = { getOrRefreshToken, generateQR, checkPaymentStatus };
