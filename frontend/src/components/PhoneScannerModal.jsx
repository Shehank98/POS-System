import { useEffect, useState } from 'react';
import { X, Smartphone, Wifi, WifiOff, Loader2, Copy, Check, QrCode } from 'lucide-react';

export default function PhoneScannerModal({ state, code, onClose, onConnect, onDisconnect, hint }) {
  const [qrUrl,  setQrUrl]  = useState('');
  const [copied, setCopied] = useState(false);

  const scannerUrl = code
    ? `${window.location.origin}/scanner?code=${code}`
    : '';

  // Generate QR code data-URL when we have a pairing code
  useEffect(() => {
    if (!scannerUrl) { setQrUrl(''); return; }
    import('qrcode').then((mod) => {
      const QRCode = mod.default;
      QRCode.toDataURL(scannerUrl, {
        width:  220,
        margin: 2,
        color:  { dark: '#1e3a8a', light: '#ffffff' },
      }).then(setQrUrl).catch(() => {});
    });
  }, [scannerUrl]);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const STATUS = {
    idle:            { Icon: WifiOff, text: 'Not connected',        cls: 'text-gray-400'                },
    connecting:      { Icon: Loader2, text: 'Connecting...',         cls: 'text-blue-500 animate-spin'   },
    waiting:         { Icon: Wifi,    text: 'Waiting for phone...',  cls: 'text-yellow-500'              },
    phone_connected: { Icon: Wifi,    text: 'Phone connected',       cls: 'text-green-500'               },
  };
  const si = STATUS[state] || STATUS.idle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Phone Scanner</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-2">
            <si.Icon className={`w-4 h-4 shrink-0 ${si.cls}`} />
            <span className="text-sm text-gray-600">{si.text}</span>
          </div>

          {/* Idle: show connect button */}
          {state === 'idle' && (
            <button onClick={onConnect} className="btn-primary w-full justify-center">
              Connect Phone Scanner
            </button>
          )}

          {/* Waiting / connected: show QR + code */}
          {(state === 'waiting' || state === 'phone_connected') && code && (
            <>
              {/* QR code */}
              <div className="flex justify-center">
                {qrUrl
                  ? <img src={qrUrl} alt="Pairing QR code"
                         className="w-52 h-52 rounded-xl border border-gray-100 shadow-sm" />
                  : <div className="w-52 h-52 rounded-xl bg-gray-50 border border-gray-100
                                    flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                }
              </div>

              {/* 6-digit code */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1.5">Or type this code on your phone:</p>
                <div className="inline-flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
                  <span className="font-mono text-3xl font-bold tracking-[0.2em] text-primary-700">
                    {code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                    title="Copy code"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-green-500" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Open URL hint */}
              <p className="text-center text-xs text-gray-400">
                Open{' '}
                <span className="font-medium text-gray-600">
                  {window.location.origin}/scanner
                </span>{' '}
                on your phone
              </p>

              {/* Phone connected success banner */}
              {state === 'phone_connected' && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-green-700">Phone connected!</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {hint || 'Barcodes scanned on your phone appear in the cart automatically.'}
                  </p>
                </div>
              )}

              <button
                onClick={onDisconnect}
                className="btn-secondary w-full justify-center text-sm"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
