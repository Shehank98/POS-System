/**
 * IndexedDB wrapper for offline POS functionality.
 *
 * Database:  pos_saas_offline  (version 2)
 * Stores:
 *   offline_transactions  – sales made while disconnected
 *   cache_meta            – subscription status, last sync time, etc.
 */

const DB_NAME    = 'pos_saas_offline';
const DB_VERSION = 2;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('offline_transactions')) {
        const store = db.createObjectStore('offline_transactions', { keyPath: 'client_id' });
        store.createIndex('status',     'status',     { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('cache_meta')) {
        db.createObjectStore('cache_meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Generic helpers ───────────────────────────────────────────
function tx(storeName, mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store       = transaction.objectStore(storeName);
      const req         = fn(store);
      if (req && typeof req.onsuccess === 'undefined') {
        // req is a raw value (e.g. already resolved promise)
        resolve(req);
        return;
      }
      if (req) {
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
      } else {
        transaction.oncomplete = () => resolve();
        transaction.onerror    = (e) => reject(e.target.error);
      }
    });
  });
}

function getAll(storeName, indexName, query) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store       = transaction.objectStore(storeName);
    const target      = indexName ? store.index(indexName) : store;
    const req         = query ? target.getAll(query) : target.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  }));
}

// ── Offline Transactions ──────────────────────────────────────

/**
 * @typedef {Object} OfflineTxn
 * @property {string}  client_id        – UUID generated on device
 * @property {number}  shop_id
 * @property {number}  user_id
 * @property {Array}   items
 * @property {string}  payment_method
 * @property {number}  discount_amount
 * @property {number}  total_amount
 * @property {string}  created_at       – ISO timestamp of when sale happened
 * @property {'pending'|'synced'|'failed'} status
 * @property {string}  [error]
 * @property {number}  [server_id]      – set after successful sync
 */

export async function queueTransaction(txnData) {
  const record = {
    ...txnData,
    status:     'pending',
    created_at: txnData.created_at || new Date().toISOString(),
  };
  return tx('offline_transactions', 'readwrite', (store) => store.put(record));
}

export async function getPendingTransactions() {
  return getAll('offline_transactions', 'status', 'pending');
}

export async function getAllOfflineTransactions() {
  return getAll('offline_transactions');
}

export async function markSynced(clientId, serverId, transactionNumber) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t    = db.transaction('offline_transactions', 'readwrite');
    const store = t.objectStore('offline_transactions');
    const req   = store.get(clientId);
    req.onsuccess = (e) => {
      const rec = e.target.result;
      if (!rec) { resolve(); return; }
      rec.status             = 'synced';
      rec.server_id          = serverId;
      rec.transaction_number = transactionNumber;
      store.put(rec);
    };
    req.onerror    = (e) => reject(e.target.error);
    t.oncomplete   = () => resolve();
  }));
}

export async function markFailed(clientId, error) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t    = db.transaction('offline_transactions', 'readwrite');
    const store = t.objectStore('offline_transactions');
    const req   = store.get(clientId);
    req.onsuccess = (e) => {
      const rec = e.target.result;
      if (!rec) { resolve(); return; }
      rec.status = 'failed';
      rec.error  = error;
      store.put(rec);
    };
    req.onerror   = (e) => reject(e.target.error);
    t.oncomplete  = () => resolve();
  }));
}

export async function countPending() {
  const pending = await getAll('offline_transactions', 'status', 'pending');
  return pending.length;
}

// ── Cache Meta ────────────────────────────────────────────────
export async function setMeta(key, value) {
  return tx('cache_meta', 'readwrite',
    (store) => store.put({ key, value, updated_at: new Date().toISOString() })
  );
}

export async function getMeta(key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t    = db.transaction('cache_meta', 'readonly');
    const req  = t.objectStore('cache_meta').get(key);
    req.onsuccess = (e) => resolve(e.target.result?.value ?? null);
    req.onerror   = (e) => reject(e.target.error);
  }));
}

export async function cacheSubscription(subscriptionData) {
  return setMeta('subscription', subscriptionData);
}

export async function getCachedSubscription() {
  return getMeta('subscription');
}

/**
 * Returns true if the subscription allows new offline transactions.
 * Blocks if: status === 'suspended', OR end_date > 5 days ago (past grace period)
 */
export async function isOfflineAllowed() {
  const sub = await getCachedSubscription();
  if (!sub) return true; // no cached data → allow (first use)

  if (sub.subscription_status === 'suspended') return false;

  if (sub.subscription_end_date) {
    const msPerDay    = 86_400_000;
    const daysOverdue = (Date.now() - new Date(sub.subscription_end_date).getTime()) / msPerDay;
    if (daysOverdue > 5) return false; // past 5-day grace period
  } else if (sub.subscription_status === 'expired') {
    return false; // no end_date + expired → fully locked
  }
  return true;
}

// ── Anti-tamper + online-verification tracking ────────────────
export const setLastVerifiedOnline = (ts) => setMeta('last_verified_online', ts);
export const getLastVerifiedOnline = ()   => getMeta('last_verified_online');
export const setLastRunTimestamp   = (ts) => setMeta('last_run_timestamp', ts);
export const getLastRunTimestamp   = ()   => getMeta('last_run_timestamp');
export const setTampered           = (v)  => setMeta('time_tampered', v);
export const getTampered           = ()   => getMeta('time_tampered');
