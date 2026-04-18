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
    await admin.messaging().send({
      topic,
      notification: { title, body },
      data,
      android: { priority: 'high' },
    });
  } catch (e) {
    console.warn('FCM send failed:', e.message);
  }
}

module.exports = { sendToTopic };
