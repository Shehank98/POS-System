const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized || !process.env.FIREBASE_SERVICE_ACCOUNT) return;
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  } catch (e) {
    console.warn('FCM init failed:', e.message);
  }
}

async function sendToTopic(topic, title, body, data = {}) {
  initFirebase();
  if (!initialized) return;
  try {
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
  } catch (e) {
    console.warn('FCM send failed:', e.message);
  }
}

module.exports = { sendToTopic };
