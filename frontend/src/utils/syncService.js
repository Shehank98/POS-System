/**
 * syncService.js
 *
 * Handles syncing pending offline transactions to the backend
 * when the device comes back online.
 *
 * Call `syncPending()` on:
 *   - App mount (if online)
 *   - window 'online' event
 *   - User taps "Sync now" button
 */

import { transactionsApi } from '../api/client';
import {
  getPendingTransactions,
  markSynced,
  markFailed,
  cacheSubscription,
} from './offlineDB';

let _isSyncing = false;

/**
 * Sync all pending offline transactions.
 * @param {Function} [onProgress] – called after each result with (results_so_far)
 * @returns {{ synced: number, failed: number, total: number }}
 */
export async function syncPending(onProgress) {
  if (_isSyncing) return { synced: 0, failed: 0, total: 0, skipped: true };
  _isSyncing = true;

  try {
    const pending = await getPendingTransactions();
    if (pending.length === 0) return { synced: 0, failed: 0, total: 0 };

    let synced = 0;
    let failed = 0;

    // Send in batches of 20 to avoid huge payloads
    const BATCH = 20;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);

      let results;
      try {
        const { data } = await transactionsApi.sync(batch);
        results = data.results || [];
      } catch (networkErr) {
        // Network still down mid-sync – mark nothing, try again later
        console.warn('Sync network error:', networkErr.message);
        break;
      }

      for (const result of results) {
        if (result.status === 'synced' || result.status === 'duplicate') {
          await markSynced(result.client_id, result.server_id, result.transaction_number);
          synced++;
        } else if (result.status === 'failed') {
          await markFailed(result.client_id, result.error);
          failed++;
        }
      }

      if (onProgress) onProgress({ synced, failed, total: pending.length });
    }

    return { synced, failed, total: pending.length };
  } finally {
    _isSyncing = false;
  }
}

export function isSyncing() { return _isSyncing; }

/**
 * Cache the current user's subscription details in IndexedDB
 * so offline mode can enforce the expiry rule.
 */
export async function cacheUserSubscription(user) {
  if (!user) return;
  await cacheSubscription({
    subscription_status:   user.subscription_status,
    subscription_end_date: user.subscription_end_date,
    cached_at:             new Date().toISOString(),
  });
}
