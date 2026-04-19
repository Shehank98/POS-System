const { WebSocketServer } = require('ws');
const jwt                 = require('jsonwebtoken');

// Active pairing sessions: code -> { pos: ws, phone: ws | null }
const sessions = new Map();

// Shop-level subscriptions for QR payment events: shopId -> Set<ws>
const shopSubscriptions = new Map();

function subscribeShop(ws, shopId) {
  if (!shopSubscriptions.has(shopId)) shopSubscriptions.set(shopId, new Set());
  shopSubscriptions.get(shopId).add(ws);
  ws._shopId = shopId;
}

function unsubscribeShop(ws) {
  if (ws._shopId && shopSubscriptions.has(ws._shopId)) {
    shopSubscriptions.get(ws._shopId).delete(ws);
  }
}

function notifyShopQRPayment(shopId, data) {
  const subs = shopSubscriptions.get(String(shopId));
  if (!subs) return;
  const msg = JSON.stringify({ type: 'qr_payment_update', ...data });
  subs.forEach((ws) => {
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch {}
    }
  });
}

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions.has(code));
  return code;
}

function safeSend(ws, data) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(data)); } catch {}
  }
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws._sessionCode = null;
    ws._role = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // ── POS registers and receives a 6-digit pairing code ────
      if (msg.type === 'register' && msg.role === 'pos') {
        // Clean up any previous session this socket held
        if (ws._sessionCode) sessions.delete(ws._sessionCode);

        const code = generateCode();
        sessions.set(code, { pos: ws, phone: null });
        ws._sessionCode = code;
        ws._role = 'pos';
        safeSend(ws, { type: 'registered', code });
        console.log(`[WS] POS registered  code=${code}`);

      // ── Phone pairs using the 6-digit code ──────────────────
      } else if (msg.type === 'pair' && msg.role === 'phone') {
        const code = (msg.code || '').trim();
        const session = sessions.get(code);

        if (!session || !session.pos || session.pos.readyState !== 1) {
          safeSend(ws, { type: 'error', message: 'Invalid or expired pairing code' });
          return;
        }
        // Replace existing phone if any
        if (session.phone) {
          try { session.phone.close(); } catch {}
        }
        session.phone = ws;
        ws._sessionCode = code;
        ws._role = 'phone';
        safeSend(ws, { type: 'paired' });
        safeSend(session.pos, { type: 'phone_connected' });
        console.log(`[WS] Phone paired    code=${code}`);

      // ── Phone sends a scanned barcode to POS ─────────────────
      } else if (msg.type === 'barcode' && ws._role === 'phone') {
        const session = sessions.get(ws._sessionCode);
        if (session) safeSend(session.pos, { type: 'barcode', data: msg.data });

      // ── POS subscribes to shop-level QR payment events ───────
      } else if (msg.type === 'subscribe_shop' && msg.token) {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
          const shopId  = String(payload.shopId || payload.shop_id);
          if (shopId) {
            subscribeShop(ws, shopId);
            safeSend(ws, { type: 'shop_subscribed', shopId });
          }
        } catch { /* invalid token — ignore */ }
      }
    });

    ws.on('close', () => {
      unsubscribeShop(ws);

      const code = ws._sessionCode;
      if (!code) return;
      const session = sessions.get(code);
      if (!session) return;

      if (ws._role === 'pos') {
        safeSend(session.phone, { type: 'pos_disconnected' });
        sessions.delete(code);
        console.log(`[WS] POS disconnected code=${code} - session removed`);
      } else if (ws._role === 'phone') {
        session.phone = null;
        safeSend(session.pos, { type: 'phone_disconnected' });
        console.log(`[WS] Phone disconnected code=${code}`);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] socket error:', err.message);
    });
  });

  console.log('[WS] WebSocket server ready at /ws');
}

module.exports = { setupWebSocket, notifyShopQRPayment };
