/**
 * POSScannerSection
 *
 * Live barcode scanner for the mobile POS home screen.
 * Takes the top 45 vh of the viewport and provides:
 *   • ZXing multi-format live camera decode
 *   • Green corner-marker frame + animated scan line
 *   • Flashlight (torch) toggle — appears only when device supports it
 *   • "Search manually" fallback — shown on demand or auto-shown on
 *     permission-denied / camera-unavailable errors
 *
 * Props
 *   onItemScanned(barcode: string) — called for every unique scan
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Search, X, Zap, ZapOff, CameraOff, Barcode,
} from 'lucide-react';

/* How long (ms) the same code must be held away before re-triggering */
const DEBOUNCE_MS = 1_500;

/* ─────────────────────────────────────────────────────────────────────
   Sub-component: the four corner markers drawn around the scan zone
   ───────────────────────────────────────────────────────────────────── */
function ScanCorners({ active }) {
  const base   = 'absolute w-6 h-6 transition-colors duration-300';
  const colour = active ? 'border-green-400' : 'border-white/80';
  return (
    <>
      <span className={`${base} top-0 left-0   border-t-[3px] border-l-[3px] rounded-tl-sm ${colour}`} />
      <span className={`${base} top-0 right-0  border-t-[3px] border-r-[3px] rounded-tr-sm ${colour}`} />
      <span className={`${base} bottom-0 left-0  border-b-[3px] border-l-[3px] rounded-bl-sm ${colour}`} />
      <span className={`${base} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-sm ${colour}`} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────────────────────────── */
export default function POSScannerSection({ onItemScanned }) {
  /* scanner lifecycle */
  const [status,     setStatus]     = useState('starting'); // 'starting'|'scanning'|'error'
  const [errorKind,  setErrorKind]  = useState('');         // 'permission'|'unavailable'

  /* torch */
  const [torchOn,        setTorchOn]        = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  /* scan feedback */
  const [flash,    setFlash]    = useState(false);
  const [lastCode, setLastCode] = useState('');

  /* manual input */
  const [showManual, setShowManual] = useState(false);
  const [manualVal,  setManualVal]  = useState('');

  /* refs */
  const videoRef    = useRef(null);   // <video> element
  const controlsRef = useRef(null);   // ZXing IScannerControls
  const lastRef     = useRef({ code: '', time: 0 });
  const manualRef   = useRef(null);

  /* ── decode handler (stable ref so useEffect dep-array stays clean) ── */
  const handleDecode = useCallback((code) => {
    const now = Date.now();
    if (
      code === lastRef.current.code &&
      now - lastRef.current.time < DEBOUNCE_MS
    ) return;
    lastRef.current = { code, time: now };

    try { navigator.vibrate?.([100, 50, 100]); } catch (_) { /* ignored */ }
    setLastCode(code);
    setFlash(true);
    setTimeout(() => setFlash(false), 750);
    onItemScanned(code);
  }, [onItemScanned]);

  /* ── start / stop ZXing on mount / unmount ─────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: 'environment',
              width:  { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _err) => {
            if (result && !cancelled) handleDecode(result.getText());
          }
        );

        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;

        /* torch availability — ZXing exposes streamVideoCapabilitiesGet */
        try {
          const caps = controls.streamVideoCapabilitiesGet?.(
            (tracks) => tracks.filter((t) => t.kind === 'video')
          );
          if (caps?.torch) setTorchAvailable(true);
        } catch (_) { /* torch capability check failed — ignore */ }

        setStatus('scanning');
      } catch (err) {
        if (cancelled) return;
        const name = err?.name  ?? '';
        const msg  = (err?.message ?? '').toLowerCase();
        const isDenied =
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg.includes('permission') ||
          msg.includes('denied');

        setErrorKind(isDenied ? 'permission' : 'unavailable');
        setStatus('error');
        if (isDenied) setShowManual(true); // auto-show input on permission error
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [handleDecode]);

  /* ── torch toggle ────────────────────────────────────────────────────── */
  async function toggleTorch() {
    if (!controlsRef.current?.switchTorch) return;
    try {
      const next = !torchOn;
      await controlsRef.current.switchTorch(next);
      setTorchOn(next);
    } catch (_) { /* device rejected torch — silently ignore */ }
  }

  /* ── manual barcode submit ───────────────────────────────────────────── */
  function handleManualSubmit(e) {
    e.preventDefault();
    const val = manualVal.trim();
    if (!val) return;
    setManualVal('');
    onItemScanned(val);
    manualRef.current?.focus();
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */
  return (
    /* Outer shell: 45 vh, dark background, flex-col */
    <div
      className="flex flex-col overflow-hidden bg-gray-950"
      style={{ height: '45vh', minHeight: 200, maxHeight: 340 }}
    >

      {/* ── Camera viewport ─────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden bg-black">

        {/* Live video feed — ZXing writes frames here */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* ── Spinner while camera warms up ─────────────────────────── */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          bg-gray-950 gap-4 animate-fade-in z-10">
            <div className="w-9 h-9 rounded-full border-2 border-white/15
                            border-t-white animate-spin" />
            <p className="text-white/50 text-sm tracking-wide">Starting camera…</p>
          </div>
        )}

        {/* ── Scanning UI: dimmed edges + guide frame ───────────────── */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          pointer-events-none z-10">

            {/* Vignette — darkens the area outside the scan zone */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 75% 55% at 50% 48%, transparent 55%, rgba(0,0,0,0.60) 100%)',
              }}
            />

            {/* Scan-zone frame */}
            <div
              className={`relative z-20 transition-transform duration-150
                          ${flash ? 'scale-[1.04]' : 'scale-100'}`}
              style={{ width: 270, height: 110 }}
            >
              <ScanCorners active={flash} />

              {/* Animated green scan line — only while not flashing */}
              {!flash && (
                <div
                  className="absolute left-2 right-2 h-[2px] rounded-full
                              bg-green-400/85 animate-scan"
                  style={{
                    boxShadow: '0 0 8px 2px rgba(74,222,128,0.65)',
                  }}
                />
              )}

              {/* Flash: success badge centred in frame */}
              {flash && (
                <div className="absolute inset-0 flex flex-col items-center
                                justify-center gap-1.5 animate-fade-in">
                  <div
                    className="bg-green-500 text-white font-bold px-5 py-1.5
                                rounded-lg shadow-xl text-sm tracking-wide"
                    style={{ boxShadow: '0 0 20px rgba(34,197,94,0.5)' }}
                  >
                    ✓ Scanned!
                  </div>
                  {lastCode && (
                    <p className="text-white/80 font-mono text-[10px]
                                  bg-black/55 px-2.5 py-0.5 rounded-md
                                  max-w-[88%] truncate">
                      {lastCode}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hint text below frame */}
            <p className="text-white/45 text-[11px] mt-4 z-20 tracking-wider uppercase">
              Point camera at barcode
            </p>
          </div>
        )}

        {/* ── Error: camera permission denied ───────────────────────── */}
        {status === 'error' && errorKind === 'permission' && !showManual && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          bg-gray-950 gap-4 p-6 z-10 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center
                            justify-center border border-red-500/30">
              <CameraOff className="w-7 h-7 text-red-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-sm">Camera access denied</p>
              <p className="text-white/45 text-xs leading-relaxed max-w-[240px]">
                Tap the camera icon in your browser's address bar and allow access,
                then reload the page.
              </p>
            </div>
            <button
              onClick={() => setShowManual(true)}
              className="text-primary-400 text-sm font-medium underline
                         underline-offset-2 active:opacity-60"
            >
              Use manual search instead
            </button>
          </div>
        )}

        {/* ── Error: no camera / other ───────────────────────────────── */}
        {status === 'error' && errorKind === 'unavailable' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          bg-gray-950 gap-3 p-6 z-10 animate-fade-in">
            <CameraOff className="w-9 h-9 text-gray-500" />
            <div className="text-center">
              <p className="text-white/70 text-sm">Camera unavailable</p>
              <p className="text-white/35 text-xs mt-0.5">
                No camera found on this device
              </p>
            </div>
          </div>
        )}

        {/* ── Torch toggle button ────────────────────────────────────── */}
        {status === 'scanning' && torchAvailable && (
          <button
            onClick={toggleTorch}
            aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
            className={`absolute top-3 right-3 z-30 w-11 h-11 rounded-full
                        flex items-center justify-center border transition-all
                        duration-200 active:scale-90 backdrop-blur-sm
                        ${torchOn
                          ? 'bg-yellow-400/90 border-yellow-300 text-gray-900 shadow-[0_0_16px_rgba(250,204,21,0.55)]'
                          : 'bg-black/50 border-white/20 text-white/75 hover:bg-black/70'}`}
          >
            {torchOn
              ? <Zap    className="w-4 h-4" fill="currentColor" />
              : <ZapOff className="w-4 h-4" />
            }
          </button>
        )}
      </div>
      {/* ── End camera viewport ───────────────────────────────────────── */}

      {/* ── Bottom bar: manual search toggle / input ────────────────── */}
      {!showManual ? (
        /* ── "Search manually" ghost pill ───────────────────────────── */
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center justify-center gap-2 py-2.5 bg-gray-900
                     border-t border-white/8 text-white/55 text-[13px] font-medium
                     hover:text-white/80 hover:bg-gray-800 transition-colors
                     active:bg-gray-700 shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          Search manually
        </button>
      ) : (
        /* ── Manual barcode / product-name input form ────────────────── */
        <form
          onSubmit={handleManualSubmit}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-900
                     border-t border-white/8 shrink-0"
        >
          <Barcode className="w-4 h-4 text-gray-500 shrink-0" />

          <input
            ref={manualRef}
            autoFocus
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg
                       px-3 py-2 border border-gray-700 placeholder-gray-500
                       focus:border-primary-500 focus:outline-none
                       focus:ring-2 focus:ring-primary-500/25 transition-colors"
            placeholder="Barcode or product name…"
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <button
            type="submit"
            disabled={!manualVal.trim()}
            className="shrink-0 px-3.5 py-2 bg-primary-600 text-white text-xs
                       font-semibold rounded-lg active:bg-primary-700
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            Add
          </button>

          {/* Only show close/back-to-camera when the camera is actually working */}
          {status === 'scanning' && (
            <button
              type="button"
              aria-label="Back to camera"
              onClick={() => { setShowManual(false); setManualVal(''); }}
              className="shrink-0 w-9 h-9 flex items-center justify-center
                         rounded-lg text-gray-500 hover:text-white
                         hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
