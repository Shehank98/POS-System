const admin = require('firebase-admin');

// Named app so it doesn't conflict with the default FCM app
const STORAGE_APP_NAME = 'storage';
let storageApp = null;

function initStorage() {
  if (storageApp) return true;
  if (!process.env.FIREBASE_STORAGE_SERVICE_ACCOUNT || !process.env.FIREBASE_STORAGE_BUCKET) return false;

  try {
    // Check if named app already exists (e.g. hot-reload)
    const existing = admin.apps.find((a) => a && a.name === STORAGE_APP_NAME);
    if (existing) {
      storageApp = existing;
    } else {
      const serviceAccount = JSON.parse(process.env.FIREBASE_STORAGE_SERVICE_ACCOUNT);
      storageApp = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount), storageBucket: process.env.FIREBASE_STORAGE_BUCKET },
        STORAGE_APP_NAME,
      );
    }
    return true;
  } catch (e) {
    console.warn('Firebase Storage init failed:', e.message);
    return false;
  }
}

async function uploadBase64(base64Data, contentType, destPath) {
  if (!initStorage()) return null;

  const bucket = storageApp.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const file   = bucket.file(destPath);
  const buffer = Buffer.from(base64Data, 'base64');

  await file.save(buffer, { metadata: { contentType }, public: true });

  return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destPath}`;
}

function parseBase64(dataString) {
  if (!dataString) return null;
  const match = dataString.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { contentType: match[1], base64: match[2] };
  return { contentType: 'application/octet-stream', base64: dataString };
}

async function uploadFile(dataString, destPath, fallbackContentType = 'image/jpeg') {
  if (!dataString) return null;
  const parsed = parseBase64(dataString);
  if (!parsed) return null;

  const url = await uploadBase64(parsed.base64, parsed.contentType || fallbackContentType, destPath);
  return url || dataString;
}

module.exports = { uploadFile, uploadBase64, parseBase64 };
