const admin = require('firebase-admin');
const path  = require('path');

let storageInitialized = false;

function initStorage() {
  if (storageInitialized) return true;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_STORAGE_BUCKET) return false;

  try {
    // Reuse existing app if already initialized (by FCM), else init with storageBucket
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    } else {
      // App already initialized (FCM), storage bucket may not be set — reinit not possible
      // Instead work with the existing app and specify bucket explicitly
    }
    storageInitialized = true;
    return true;
  } catch (e) {
    console.warn('Firebase Storage init failed:', e.message);
    return false;
  }
}

/**
 * Upload a base64-encoded file to Firebase Storage.
 * Returns the public download URL, or null if storage is not configured.
 *
 * @param {string} base64Data  - raw base64 string (no data URI prefix)
 * @param {string} contentType - MIME type, e.g. 'image/jpeg'
 * @param {string} destPath    - storage path, e.g. 'agents/1/nic_front.jpg'
 */
async function uploadBase64(base64Data, contentType, destPath) {
  if (!initStorage()) return null;

  const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
  const file   = bucket.file(destPath);
  const buffer = Buffer.from(base64Data, 'base64');

  await file.save(buffer, {
    metadata: { contentType },
    public: true,
  });

  return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destPath}`;
}

/**
 * Strip data URI prefix if present and return { base64, contentType }.
 * Accepts either raw base64 or a full data URI like 'data:image/jpeg;base64,...'
 */
function parseBase64(dataString) {
  if (!dataString) return null;
  const match = dataString.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { contentType: match[1], base64: match[2] };
  return { contentType: 'application/octet-stream', base64: dataString };
}

/**
 * Helper: upload a file sent as a data URI or raw base64.
 * Falls back to returning the original data string if Firebase Storage is not configured.
 */
async function uploadFile(dataString, destPath, fallbackContentType = 'image/jpeg') {
  if (!dataString) return null;
  const parsed = parseBase64(dataString);
  if (!parsed) return null;

  const url = await uploadBase64(parsed.base64, parsed.contentType || fallbackContentType, destPath);
  // If Firebase not configured, store the raw data URI so nothing is lost
  return url || dataString;
}

module.exports = { uploadFile, uploadBase64, parseBase64 };
