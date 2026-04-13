import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertCircle, Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/client';

const COOLDOWN_MS = 1500;
const fmt = (n) => Number(n || 0).toFixed(2);

// Play a short beep using Web Audio API
function playBeep(audioCtx) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type            = 'sine';
    osc.frequency.value = 1200; // Hz — short high beep
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
  } catch { /* ignore */ }
}

/**
 * PosCameraScanner
 * Full-screen camera scanner that stays open across multiple scans.
 * Scanned items appear in a mini-cart below the compact viewfinder.
 * Tapping "Add to Cart" commits all items to the main cart via onDone().
 *
 * Props:
 *   onDone(items)  — called with [{product, quantity}] when user taps Add
 *   onClose()      — called to dismiss the modal
 */
export default function PosCameraScanner({ onDone, onClose }) {
  const [camError,     setCamError]     = useState('');
  const [flash,        setFlash]        = useState(false);
  const [lastScanCode, setLastScanCode] = useState('');
  const [scannedItems, setScannedItems] = useState([]); // [{product, quantity}]
  const [lookingUp,    setLookingUp]    = useState(false);

  const lastScanRef = useRef({ code: '', time: 0 });
  const audioCtxRef = useRef(null);

  // Create AudioContext on mount — component mounts inside a user-gesture (button click)
  useEffect(() => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch { /* browser doesn't support Web Audio */ }
    return () => { audioCtxRef.current?.close().catch(() => {}); };
  }, []);

  // Stable barcode handler
  const handleBarcode = useCallback(async (decoded) => {
    setLastScanCode(decoded);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);

    // Feedback: beep + vibration
    playBeep(audioCtxRef.current);
    try { navigator.vibrate?.(180); } catch { /* ignore */ }

    setLookingUp(true);
    try {
      const { data } = await productsApi.byBarcode(decoded);
      setScannedItems((prev) => {
        const idx = prev.findIndex((i) => i.product.id === data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
          return updated;
        }
        return [...prev, { product: data, quantity: 1 }];
      });
    } catch {
      toast.error(`Barcode "${decoded}" not found`);
    } finally {
      setLookingUp(false);
    }
  }, []);

  // Start camera
  useEffect(() => {
    let scanner;
    setCamError('');

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode('pos-multi-cam-view', { verbose: false });

      scanner
        .start(
          { facingMode: 'environment' },
          {
            fps: 12,
            // aspectRatio > 1 = wider than tall → shorter video on mobile
            aspectRatio: 2.4,
            qrbox: { width: 220, height: 80 },
          },
          (decoded) => {
            const now = Date.now();
            if (
              decoded === lastScanRef.current.code &&
              now - lastScanRef.current.time < COOLDOWN_MS
            ) return;
            lastScanRef.current = { code: decoded, time: now };
            handleBarcode(decoded);
          },
          () => { /* per-frame decode errors are normal */ }
        )
        .catch((err) => {
          const msg = err?.message || '';
          setCamError(
            msg.toLowerCase().includes('permission')
              ? 'Camera permission denied. Tap the lock icon in your browser bar and allow camera access.'
              : msg.toLowerCase().includes('https') || msg.toLowerCase().includes('secure')
              ? 'Camera requires a secure HTTPS connection.'
              : 'Could not start camera. Try a different browser or check camera permissions.'
          );
        });
    });

    return () => { scanner?.stop().catch(() => {}); };
  }, [handleBarcode]);

  function handleQtyChange(productId, delta) {
    setScannedItems((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function handleRemove(productId) {
    setScannedItems((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function handleDone() {
    onDone(scannedItems);
    onClose();
  }

  const totalQty = scannedItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmt = scannedItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-4 h-4" />
          <span className="text-sm font-semibold">Scan Items</span>
          {totalQty > 0 && (
            <span className="bg-primary-600 text-white text-xs font-bold
                             px-2 py-0.5 rounded-full">
              {totalQty}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Camera viewfinder ──────────────────────────────────── */}
      {/*
        overflow-hidden clips the video the html5-qrcode library injects
        (the library overrides container height via JS; we clamp it here).
        Max height ~160px keeps plenty of room for the scanned items list.
      */}
      <div
        className={`relative bg-black shrink-0 overflow-hidden transition-colors duration-150
                    ${flash ? 'ring-4 ring-green-400 ring-inset' : ''}`}
        style={{ maxHeight: 160 }}
      >
        <div id="pos-multi-cam-view" className="w-full" />

        {/* Scan flash overlay */}
        {flash && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          pointer-events-none gap-1.5 bg-green-500/20">
            <div className="bg-green-500 text-white text-sm font-bold
                            px-5 py-2 rounded-xl shadow-lg">
              ✓ Scanned!
            </div>
            {lastScanCode && (
              <p className="text-white font-mono text-[11px] bg-black/50 px-3 py-0.5
                             rounded-lg max-w-[90%] truncate text-center">
                {lastScanCode}
              </p>
            )}
          </div>
        )}

        {/* Looking up spinner */}
        {lookingUp && !flash && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white
                          text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-white border-t-transparent
                             rounded-full animate-spin inline-block" />
            Looking up…
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

      {/* ── Hint bar ───────────────────────────────────────────── */}
      <div className="px-4 py-1.5 bg-gray-800 border-t border-gray-700 shrink-0">
        <p className="text-gray-400 text-[11px] text-center">
          {scannedItems.length === 0
            ? 'Point camera at a barcode — scans automatically'
            : 'Keep scanning or tap Add to Cart below'}
        </p>
      </div>

      {/* ── Scanned items mini-cart ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-white min-h-0">
        {scannedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full
                          text-gray-300 gap-3 py-8">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">Scanned items will appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {scannedItems.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(product.price)} each
                  </p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleQtyChange(product.id, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full
                               border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQtyChange(product.id, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full
                               border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>

                {/* Line total */}
                <span className="text-sm font-bold text-primary-700 w-16 text-right shrink-0">
                  {fmt(product.price * quantity)}
                </span>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(product.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  aria-label="Remove item"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0 safe-area-bottom">
        {scannedItems.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 mb-2 px-0.5">
            <span>{totalQty} item{totalQty !== 1 ? 's' : ''} scanned</span>
            <span className="font-semibold text-gray-700">Total: {fmt(totalAmt)}</span>
          </div>
        )}
        <div className="flex gap-2">
          {scannedItems.length > 0 && (
            <button
              onClick={() => setScannedItems([])}
              className="btn-secondary shrink-0 text-sm"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleDone}
            disabled={scannedItems.length === 0}
            className="btn-primary flex-1 justify-center text-sm"
          >
            <Check className="w-4 h-4" />
            {scannedItems.length === 0
              ? 'Add to Cart'
              : `Add ${totalQty} item${totalQty !== 1 ? 's' : ''} to Cart`}
          </button>
        </div>
      </div>
    </div>
  );
}
