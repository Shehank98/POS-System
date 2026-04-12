import { useState, useEffect, useCallback } from 'react';
import { countPending } from '../utils/offlineDB';

/**
 * Returns real-time online/offline status and pending offline txn count.
 *
 * @returns {{ isOnline: boolean, pendingCount: number, refreshPending: () => void }}
 */
export function useOnlineStatus() {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const count = await countPending();
      setPendingCount(count);
    } catch {
      // IndexedDB unavailable (e.g. private browsing) – ignore
    }
  }, []);

  useEffect(() => {
    refreshPending();

    const handleOnline  = () => { setIsOnline(true);  refreshPending(); };
    const handleOffline = () => { setIsOnline(false); refreshPending(); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll pending count every 10 s so it stays accurate after syncs
    const interval = setInterval(refreshPending, 10_000);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPending]);

  return { isOnline, pendingCount, refreshPending };
}
