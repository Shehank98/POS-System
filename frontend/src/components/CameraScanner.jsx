import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';

const COOLDOWN_MS = 1500;

/**
 * CameraScanner
 * Modal overlay that opens the device camera and decodes barcodes.
 *
 * Props:
 *   onScan(code)  — called every time a new barcode is decoded
 *   onClose()     — called when the user dismisses the modal
 *   scannerId     — unique DOM id for the html5-qrcode container
 *                   (default "cam-scanner-view"; change when two
 *                    instances might mount at once)
 */
export default function CameraScanner({ onScan, onClose, scannerId = 'cam-scanner-view' }) {
  const [camError, setCamError] = useState('');
  const [flash,    setFlash]    = useState(false);
  const [lastScan, setLastScan] = useState('');

  const scannerRef  = useRef(null);
  const lastScanRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    let scanner;
    setCamError('');

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode(scannerId, { verbose: false });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 260, height: 130 } },
          (decoded) => {
            // Debounce — html5-qrcode fires the callback on every frame
            const now = Date.now();
            if (
              decoded === lastScanRef.current.code &&
              now - lastScanRef.current.time < COOLDOWN_MS
            ) return;
            lastScanRef.current = { code: decoded, time: now };

            try { navigator.vibrate?.([150, 80, 150]); } catch { /* ignore */ }
            setLastScan(decoded);
            setFlash(true);
            setTimeout(() => setFlash(false), 600);
            onScan(decoded);
          },
          () => { /* per-frame decode errors are normal */ }
        )
        .catch((err) => {
          const msg = err?.message || '';
          setCamError(
            msg.toLowerCase().includes('permission')
              ? 'Camera permission denied. Tap the camera icon in your browser bar and allow access, then try again.'
              : msg.toLowerCase().includes('https') || msg.toLowerCase().includes('secure')
              ? 'Camera requires a secure connection (HTTPS). Please open this page over HTTPS.'
              : 'Could not start camera. Try a different browser or check camera permissions.'
          );
        });
    });

    return () => {
      scanner?.stop().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-gray-900">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
          <div className="flex items-center gap-2 text-white">
            <Camera className="w-4 h-4" />
            <span className="text-sm font-semibold">Scan Barcode</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder */}
        <div
          className={`relative transition-colors duration-150 bg-black
                      ${flash ? 'ring-4 ring-green-400 ring-inset' : ''}`}
          style={{ minHeight: 230 }}
        >
          <div id={scannerId} className="w-full" />

          {/* Success flash */}
          {flash && (
            <div className="absolute inset-0 flex flex-col items-center justify-center
                            pointer-events-none gap-2 bg-green-500/20">
              <div className="bg-green-500 text-white text-base font-bold px-6 py-2.5
                              rounded-xl shadow-lg">
                ✓ Scanned!
              </div>
              {lastScan && (
                <p className="text-white font-mono text-xs bg-black/50 px-3 py-1 rounded-lg
                               max-w-[90%] truncate text-center">
                  {lastScan}
                </p>
              )}
            </div>
          )}

          {/* Camera error */}
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center p-5 bg-gray-900">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-white text-sm leading-relaxed">{camError}</p>
                <button
                  onClick={onClose}
                  className="mt-4 text-xs text-gray-400 underline"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Last scanned */}
        {lastScan && !flash && (
          <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last scanned</p>
            <p className="text-white font-mono text-xs mt-0.5 truncate">{lastScan}</p>
          </div>
        )}

        {/* Hint */}
        <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
          <p className="text-gray-500 text-xs text-center">
            Point camera at a barcode — it scans automatically
          </p>
        </div>
      </div>
    </div>
  );
}
