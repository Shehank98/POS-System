const admin = require('firebase-admin');

let initialized = false;
let initAttempted = false;

function initFirebase() {
  if (initialized || initAttempted) return;
  initAttempted = true;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.info('[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('[FCM] FIREBASE_SERVICE_ACCOUNT is not valid JSON — push notifications disabled:', e.message);
    return;
  }

  // Validate minimum required fields before calling Firebase SDK
  const requiredFields = ['project_id', 'private_key', 'client_email'];
  const missing = requiredFields.filter((f) => !serviceAccount[f]);
  if (missing.length > 0) {
    console.error(`[FCM] FIREBASE_SERVICE_ACCOUNT missing fields: ${missing.join(', ')} — push notifications disabled`);
    return;
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.info('[FCM] Firebase Admin SDK initialized successfully');
  } catch (e) {
    console.error('[FCM] Firebase Admin SDK init failed:', e.message);
  }
}

// Eagerly validate at module load time so misconfiguration is visible in startup logs
initFirebase();

// Returns true if message was sent, false if FCM is not configured, throws on FCM error.
async function sendToTopic(topic, title, body, data = {}) {
  if (!initialized) return false;

  // Data-only payload — no 'notification' field — prevents Android from
  // auto-showing a system notification while the background handler also
  // shows one, which would result in two notifications per message.
  const stringData = {};
  for (const [k, v] of Object.entries({ title, body, ...data })) {
    stringData[k] = String(v);
  }
  await admin.messaging().send({
    topic,
    data: stringData,
    android: { priority: 'high' },
  });
  return true;
}

module.exports = { sendToTopic };
