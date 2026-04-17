import { useState } from 'react';
import { Camera, Smartphone, Zap, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import CameraScanner from '../CameraScanner';
import PhoneScannerModal from '../PhoneScannerModal';
import usePosScanner from '../../hooks/usePosScanner';

function genBarcode(shopId, productId, size, color) {
  const ts = Date.now().toString(36).toUpperCase();
  const s  = (size  || '').replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'X';
  const c  = (color || '').replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'X';
  return `${shopId}-${productId}-${s}${c}-${ts}`;
}

export default function BarcodeField({ value, onChange, shopId, productId, size, color }) {
  const [showCamera, setShowCamera] = useState(false);
  const [showPhone,  setShowPhone]  = useState(false);

  const phoneScanner = usePosScanner({
    onBarcode: (code) => {
      onChange(code);
      setShowPhone(false);
      toast.success('Barcode scanned from phone');
    },
  });

  function handleGenerate() {
    if (!size || !color) {
      toast.error('Fill in Size and Color first');
      return;
    }
    onChange(genBarcode(shopId || 0, productId || 0, size, color));
  }

  const connected = phoneScanner.state === 'phone_connected';
  const waiting   = phoneScanner.state === 'waiting';

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          type="text"
          className="input flex-1 font-mono text-sm py-1.5"
          placeholder="Scan or type barcode…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* Auto-generate */}
        <button
          type="button"
          onClick={handleGenerate}
          title="Auto-generate barcode from size + color"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200
                     bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold
                     transition-colors shrink-0"
        >
          <Zap className="w-3.5 h-3.5" />
          Generate
        </button>

        {/* Camera scan */}
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          title="Scan barcode with device camera"
          className="p-2 rounded-lg border border-gray-200 text-gray-500
                     hover:bg-gray-50 transition-colors shrink-0"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Phone scan */}
        <button
          type="button"
          onClick={() => { phoneScanner.connect(); setShowPhone(true); }}
          title="Scan barcode using your phone"
          className={`p-2 rounded-lg border text-sm transition-colors shrink-0
            ${connected ? 'border-green-300 bg-green-50 text-green-600'
            : waiting   ? 'border-amber-300 bg-amber-50 text-amber-600'
            :             'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          {connected
            ? <Wifi className="w-4 h-4" />
            : <Smartphone className="w-4 h-4" />}
        </button>
      </div>

      {/* QR preview */}
      {value && (
        <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
          <QRCodeSVG value={value} size={64} level="M" />
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">
              Barcode Preview
            </p>
            <p className="font-mono text-xs text-gray-700 break-all">{value}</p>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraScanner
          scannerId="variant-barcode-cam"
          onScan={(code) => { onChange(code); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showPhone && (
        <PhoneScannerModal
          state={phoneScanner.state}
          code={phoneScanner.code}
          onClose={() => setShowPhone(false)}
          onConnect={phoneScanner.connect}
          onDisconnect={phoneScanner.disconnect}
          hint="Scan a barcode with your phone and it will fill the barcode field."
        />
      )}
    </div>
  );
}
