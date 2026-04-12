import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { syncPending, isSyncing } from '../utils/syncService';

/**
 * Compact status badge shown in the Layout sidebar footer.
 *
 * States:
 *   🟢 Online, nothing pending          — green
 *   🟡 Online, pending transactions     — yellow (with sync button)
 *   🔵 Syncing…                         — blue spinner
 *   🔴 Offline                          — red
 */
export default function ConnectionStatus() {
  const { isOnline, pendingCount, refreshPending } = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  // Auto-sync when we come back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      handleSync(true); // silent auto-sync
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function handleSync(silent = false) {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const result = await syncPending();
      await refreshPending();
      if (!silent && result.total > 0) {
        if (result.synced > 0) {
          toast.success(`Synced ${result.synced} transaction${result.synced > 1 ? 's' : ''}`);
        }
        if (result.failed > 0) {
          toast.error(`${result.failed} transaction${result.failed > 1 ? 's' : ''} failed to sync`);
        }
      } else if (!silent && result.total === 0) {
        toast('Nothing to sync', { icon: '✓' });
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }

  // ── Offline ───────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-medium">Offline</span>
        {pendingCount > 0 && (
          <span className="ml-auto text-xs bg-red-200 text-red-700 rounded-full px-1.5 py-0.5 font-bold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // ── Syncing ───────────────────────────────────────────────
  if (syncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600">
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span className="text-xs font-medium">Syncing…</span>
      </div>
    );
  }

  // ── Online, pending ───────────────────────────────────────
  if (pendingCount > 0) {
    return (
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-50
                   text-yellow-700 hover:bg-yellow-100 transition-colors w-full text-left"
        onClick={() => handleSync(false)}
        title="Click to sync pending transactions"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-medium">Sync pending</span>
        <span className="ml-auto text-xs bg-yellow-200 text-yellow-800 rounded-full
                         px-1.5 py-0.5 font-bold">
          {pendingCount}
        </span>
      </button>
    );
  }

  // ── Online, all synced ────────────────────────────────────
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-600">
      <Wifi className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-medium">Online</span>
      <CheckCircle2 className="w-3 h-3 ml-auto" />
    </div>
  );
}

/**
 * Compact dot indicator for the mobile top bar (3px circle only).
 */
export function ConnectionDot() {
  const { isOnline, pendingCount } = useOnlineStatus();

  if (!isOnline)        return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Offline" />;
  if (pendingCount > 0) return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" title={`${pendingCount} pending`} />;
  return                       <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online" />;
}
