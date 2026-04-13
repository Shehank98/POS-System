import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertCircle, Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/client';

const COOLDOWN_MS = 1500;
const fmt = (n) => Number(n || 0).toFixed(2);

// Lightweight beep — reuses a single AudioContext
function playBeep(audioCtx) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type            = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.08);
  } catch { /* ignore */ }
}

export default function PosCameraScanner({ onDone, onClose }) {
  const [camError,     setCamError]     = useState('');
  // scanFlash: '' = idle, non-empty = show ✓ overlay with the code
  const [scanFlash,    setScanFlash]    = useState('');
  const [scannedItems, setScannedItems] = useState([]);

  const lastScanRef  = useRef({ code: '', time: 0 });
  const flashTimerRef = useRef(null);
  const audioCtxRef  = useRef(null);

  useEffect(() => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch { /* not supported */ }
    return () => {
      clearTimeout(flashTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const handleBarcode = useCallback(async (decoded) => {
    // Flash feedback (no separate lookingUp state — fewer renders)
    setScanFlash(decoded);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setScanFlash(''), 500);

    playBeep(audioCtxRef.current);
    try { navigator.vibrate?.(150); } catch { /* ignore */ }

    try {
      const { data } = await productsApi.byBarcode(decoded);
      setScannedItems((prev) => {
        const idx = prev.findIndex((i) => i.product.id === data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { product: data, quantity: 1 }];
      });
    } catch {
      toast.error(`Barcode not found`);
    }
  }, []);

  // Start camera — fps:8 keeps CPU load low on mobile
  useEffect(() => {
    let scanner;
    setCamError('');

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode('pos-multi-cam-view', { verbose: false });
      scanner
        .start(
          { facingMode: 'environment' },
          {
            fps: 8,           // 8fps is enough for barcode scanning, half the CPU of 15fps
            aspectRatio: 1.778, // 16:9 keeps video ~220px tall on a 390px wide phone
            // No qrbox — scan entire frame regardless of where barcode appears
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
          () => { /* per-frame misses are normal */ }
        )
        .catch((err) => {
          const msg = err?.message || '';
          setCamError(
            msg.toLowerCase().includes('permission')
              ? 'Camera permission denied. Tap the lock icon in your browser bar and allow camera access.'
              : 'Could not start camera. Try a different browser or check camera permissions.'
          );
        });
    });

    return () => { scanner?.stop().catch(() => {}); };
  }, [handleBarcode]);

  function handleQtyChange(productId, delta) {
    setScannedItems((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
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
  const flash    = scanFlash !== '';

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-4 h-4" />
          <span className="text-sm font-semibold">Scan Items</span>
          {totalQty > 0 && (
            <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalQty}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera viewfinder — compact, no transition (avoids repaint on flash) */}
      <div
        className={`relative bg-black shrink-0 overflow-hidden
                    ${flash ? 'ring-4 ring-green-400 ring-inset' : ''}`}
        style={{ maxHeight: 200 }}
      >
        <div id="pos-multi-cam-view" className="w-full" />

        {/* Static corner-bracket guide — no animation = no GPU cost */}
        {!flash && !camError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-24">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/70" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/70" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/70" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/70" />
            </div>
          </div>
        )}

        {/* Scan success flash */}
        {flash && (
          <div className="absolute inset-0 flex items-center justify-center
                          pointer-events-none bg-green-500/20">
            <div className="bg-green-500 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-lg">
              ✓ Scanned!
            </div>
          </div>
        )}

        {/* Camera error */}
        {camError && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-gray-900">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-white text-sm leading-relaxed">{camError}</p>
              <button onClick={onClose} className="mt-4 text-xs text-gray-400 underline">Close</button>
            </div>
          </div>
        )}
      </div>

      {/* Hint bar */}
      <div className="px-4 py-1.5 bg-gray-800 border-t border-gray-700 shrink-0">
        <p className="text-gray-400 text-[11px] text-center">
          {scannedItems.length === 0
            ? 'Point camera at any barcode — scans automatically'
            : 'Keep scanning or tap Add to Cart'}
        </p>
      </div>

      {/* Scanned items list */}
      <div className="flex-1 overflow-y-auto bg-white min-h-0">
        {scannedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3 py-8">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">Scanned items will appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {scannedItems.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(product.price)} each</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleQtyChange(product.id, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full
                               border border-gray-200 active:bg-gray-100"
                  >
                    <Minus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQtyChange(product.id, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-full
                               border border-gray-200 active:bg-gray-100"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
                <span className="text-sm font-bold text-primary-700 w-16 text-right shrink-0">
                  {fmt(product.price * quantity)}
                </span>
                <button
                  onClick={() => handleRemove(product.id)}
                  className="text-gray-300 active:text-red-500 shrink-0"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0 safe-area-bottom">
        {scannedItems.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 mb-2 px-0.5">
            <span>{totalQty} item{totalQty !== 1 ? 's' : ''} scanned</span>
            <span className="font-semibold text-gray-700">Total: {fmt(totalAmt)}</span>
          </div>
        )}
        <div className="flex gap-2">
          {scannedItems.length > 0 && (
            <button onClick={() => setScannedItems([])} className="btn-secondary shrink-0 text-sm">
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
