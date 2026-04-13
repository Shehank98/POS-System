import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wifi, WifiOff, Camera, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Standalone phone camera scanner page — no auth required.
 * Opens at /scanner (public route).
 * Pairs with a POS terminal via 6-digit code, then streams
 * scanned barcodes over WebSocket.
 */
export default function ScannerPage() {
  const [searchParams]  = useSearchParams();
  const [codeInput,  setCodeInput]  = useState(searchParams.get('code') || '');
  const [wsState,    setWsState]    = useState('idle');  // idle | connecting | paired | disconnected
  const [error,      setError]      = useState('');
  const [lastScan,   setLastScan]   = useState('');
  const [flash,      setFlash]      = useState(false);
  const [camError,   setCamError]   = useState('');

  const wsRef        = useRef(null);
  const scannerRef   = useRef(null);
  const lastScanRef  = useRef({ code: '', time: 0 });
  const COOLDOWN_MS  = 2000;

  // ── WebSocket connect ───────────────────────────────────────
  function connect(codeOverride) {
    const code = (codeOverride ?? codeInput).trim();
    if (!code) { setError('Enter the 6-digit pairing code'); return; }
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setError('Code must be 6 digits');
      return;
    }
    setError('');
    setWsState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'pair', role: 'phone', code }));
    };

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'paired') {
        setWsState('paired');
      } else if (msg.type === 'error') {
        setError(msg.message);
        setWsState('idle');
        ws.close();
      } else if (msg.type === 'pos_disconnected') {
        setWsState('disconnected');
        stopCamera();
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setWsState((prev) => prev !== 'idle' ? 'disconnected' : prev);
    };

    ws.onerror = () => ws.close();
  }

  function disconnect() {
    stopCamera();
    wsRef.current?.close();
    setWsState('idle');
  }

  // ── Camera scanner lifecycle ────────────────────────────────
  function stopCamera() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  }

  useEffect(() => {
    if (wsState !== 'paired') return;

    let qrScanner;
    setCamError('');

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      qrScanner = new Html5Qrcode('qr-reader-phone', { verbose: false });
      scannerRef.current = qrScanner;

      qrScanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 280, height: 150 } },
        (decoded) => {
          // Debounce: ignore same barcode fired repeatedly by html5-qrcode
          const now = Date.now();
          if (
            decoded === lastScanRef.current.code &&
            now - lastScanRef.current.time < COOLDOWN_MS
          ) return;
          lastScanRef.current = { code: decoded, time: now };

          // Forward barcode to POS
          if (wsRef.current?.readyState === 1) {
            wsRef.current.send(JSON.stringify({ type: 'barcode', data: decoded }));
          }
          // Haptic feedback (Android; iOS blocks vibration)
          try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
          setLastScan(decoded);
          setFlash(true);
          setTimeout(() => setFlash(false), 700);
        },
        () => { /* scan-frame errors are normal, ignore */ }
      ).catch((err) => {
        setCamError(
          err?.message?.includes('permission')
            ? 'Camera permission denied. Please allow camera access and reload.'
            : 'Could not start camera. Make sure HTTPS is used or try a different browser.'
        );
      });
    });

    return () => { qrScanner?.stop().catch(() => {}); };
  }, [wsState]);

  // Auto-connect when code is in URL
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) setTimeout(() => connect(urlCode), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────
  const isIdle = wsState === 'idle' || wsState === 'disconnected';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200
                     ${flash ? 'bg-green-400' : 'bg-gray-900'}`}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">POS Phone Scanner</span>
        </div>
        <div className="flex items-center gap-1.5">
          {wsState === 'paired'
            ? <><Wifi    className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-xs font-medium">Connected</span></>
            : wsState === 'connecting'
            ? <><Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-blue-400 text-xs">Connecting...</span></>
            : <><WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-xs font-medium">
                  {wsState === 'disconnected' ? 'POS disconnected' : 'Not connected'}
                </span></>
          }
        </div>
      </div>

      {/* Pairing screen */}
      {isIdle && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
          {wsState === 'disconnected' && (
            <div className="flex items-start gap-2 bg-red-900/50 border border-red-700
                            rounded-xl px-4 py-3 text-red-300 text-sm max-w-xs w-full">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>POS disconnected. Enter a new code to reconnect.</span>
            </div>
          )}

          <div className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                6-Digit Pairing Code
              </label>
              <input
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                           text-white text-center text-3xl font-mono tracking-[0.3em]
                           focus:outline-none focus:border-primary-400
                           placeholder:text-gray-600 placeholder:tracking-widest"
                placeholder="000000"
                maxLength={6}
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, '')); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && connect()}
                inputMode="numeric"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
            </div>
            <button
              onClick={() => connect()}
              disabled={wsState === 'connecting'}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                         text-white font-semibold rounded-xl py-3 text-base
                         transition-colors disabled:opacity-50"
            >
              {wsState === 'connecting' ? 'Connecting...' : 'Connect to POS'}
            </button>
          </div>

          <p className="text-gray-500 text-xs text-center max-w-xs">
            Open the POS terminal on your computer, click "Connect Phone Scanner",
            and enter the 6-digit code shown there.
          </p>
        </div>
      )}

      {/* Scanner screen */}
      {wsState === 'paired' && (
        <div className="flex-1 flex flex-col">
          {/* Camera viewfinder — no overflow:hidden, no h-full; library controls sizing */}
          <div className="flex-1 relative bg-black">
            <div id="qr-reader-phone" className="w-full" />

            {/* Green flash overlay — strong visual feedback (especially for iOS) */}
            {flash && (
              <div className="absolute inset-0 bg-green-500/60 flex flex-col items-center
                              justify-center pointer-events-none gap-3">
                <div className="bg-green-500 text-white text-2xl font-bold px-10 py-5
                                rounded-2xl shadow-2xl border-2 border-green-300">
                  ✓ Scanned!
                </div>
                {lastScan && (
                  <p className="text-white font-mono text-sm bg-black/40 px-4 py-1 rounded-lg
                                max-w-xs text-center truncate">
                    {lastScan}
                  </p>
                )}
              </div>
            )}

            {/* Camera error */}
            {camError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-gray-800/90 rounded-2xl p-5 text-center max-w-xs">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <p className="text-white text-sm">{camError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Last scanned code */}
          {lastScan && (
            <div className="px-4 py-3 bg-gray-800 text-center shrink-0">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Last scanned</p>
              <p className="text-white font-mono text-sm mt-0.5 truncate">{lastScan}</p>
            </div>
          )}

          {/* Disconnect button */}
          <div className="px-4 py-4 bg-gray-800 shrink-0">
            <button
              onClick={disconnect}
              className="w-full border border-gray-600 text-gray-300 rounded-xl py-2.5 text-sm
                         hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
