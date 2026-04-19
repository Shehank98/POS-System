import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { qrPaymentsApi } from '../api/client';

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });

function useCountdown(expiresAt) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setSecs(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return { secs, label: `${m}:${s}` };
}

export default function QRDisplayPage() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  const [data,    setData]    = useState(null);
  const [status,  setStatus]  = useState('loading'); // loading | waiting | success | expired | error
  const pollRef = useRef(null);
  const { secs, label: countdown } = useCountdown(data?.expires_at);

  useEffect(() => {
    if (!ref) { setStatus('error'); return; }
    qrPaymentsApi.getDisplay(ref)
      .then(({ data: d }) => {
        setData(d);
        if (d.payment_status === 2) setStatus('success');
        else if (new Date(d.expires_at) < new Date()) setStatus('expired');
        else setStatus('waiting');
      })
      .catch(() => setStatus('error'));
  }, [ref]);

  // Poll
  useEffect(() => {
    if (status !== 'waiting' || !ref) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data: d } = await qrPaymentsApi.getDisplay(ref);
        if (d.payment_status === 2) {
          clearInterval(pollRef.current);
          setStatus('success');
        } else if (new Date(d.expires_at) < new Date()) {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [status, ref]);

  // Expire via countdown
  useEffect(() => {
    if (status === 'waiting' && secs === 0 && data?.expires_at) {
      clearInterval(pollRef.current);
      setStatus('expired');
    }
  }, [status, secs, data]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <p className="text-white text-center text-lg">QR code not found or has expired.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-white text-center space-y-3">
          <div className="text-8xl">✓</div>
          <h1 className="text-3xl font-bold">Payment Received!</h1>
          <p className="text-xl opacity-90">Rs. {fmt(data?.amount)}</p>
          <p className="text-sm opacity-70">Thank you for your payment</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-white text-center space-y-3">
          <div className="text-6xl">⏱</div>
          <h1 className="text-2xl font-bold">QR Code Expired</h1>
          <p className="text-gray-300">Please ask the cashier to generate a new QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-6 p-6">
      {/* Header */}
      <div className="text-center text-white space-y-1">
        <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">HelaPay / LankaQR</p>
        <p className="text-4xl font-bold">Rs. {fmt(data?.amount)}</p>
      </div>

      {/* QR */}
      <div className="bg-white p-4 rounded-2xl shadow-2xl">
        {data?.qr_data ? (
          <QRCodeSVG value={data.qr_data} size={300} level="M" />
        ) : (
          <div className="w-[300px] h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400" />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="text-center text-white space-y-2">
        <p className="text-base text-gray-300">Scan with any LankaQR app</p>
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Waiting for payment…
        </div>
      </div>

      {/* Countdown */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Expires in</span>
          <span className={secs < 60 ? 'text-red-400 font-semibold' : 'text-gray-400'}>{countdown}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-primary-500 h-1.5 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, (secs / 600) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
