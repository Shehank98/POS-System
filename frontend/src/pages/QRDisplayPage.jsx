import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { qrPaymentsApi } from '../api/client';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function countdown(expiresAt) {
  const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
  const m    = Math.floor(diff / 60);
  const s    = diff % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QRDisplayPage() {
  const [params]    = useSearchParams();
  const reference   = params.get('ref');

  const [status, setStatus]   = useState('loading'); // loading | waiting | success | failed | expired | error
  const [session, setSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  function stopAll() {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    if (!reference) { setStatus('error'); return; }

    async function init() {
      try {
        const { data } = await qrPaymentsApi.displayStatus(reference);
        if (data.payment_status === 2) { setSession(data); setStatus('success'); return; }
        if (data.payment_status === -1) { setStatus('failed'); return; }
        if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

        setSession(data);
        setStatus('waiting');
        setTimeLeft(countdown(data.expires_at));

        // Countdown timer
        timerRef.current = setInterval(() => {
          const left = Math.max(0, Math.floor((new Date(data.expires_at) - Date.now()) / 1000));
          setTimeLeft(countdown(data.expires_at));
          if (left === 0) { stopAll(); setStatus('expired'); }
        }, 1000);

        // Poll every 3 s
        pollRef.current = setInterval(async () => {
          try {
            const { data: s } = await qrPaymentsApi.displayStatus(reference);
            if (s.payment_status === 2)  { stopAll(); setStatus('success'); }
            if (s.payment_status === -1) { stopAll(); setStatus('failed');  }
          } catch {}
        }, 3000);
      } catch {
        setStatus('error');
      }
    }

    init();
    return stopAll;
  }, [reference]);

  // ── Render states ─────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={40} className="text-primary-500 animate-spin" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <XCircle size={56} className="text-red-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-700">Invalid or expired QR session.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 gap-6 p-6">
        <CheckCircle2 size={100} className="text-green-500" />
        <p className="text-3xl font-black text-green-700">Payment Received!</p>
        {session && (
          <p className="text-xl font-semibold text-green-600">Rs {fmt(session.amount)}</p>
        )}
        <p className="text-gray-500 text-sm">Thank you for your payment.</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 gap-6 p-6">
        <XCircle size={80} className="text-red-400" />
        <p className="text-2xl font-bold text-red-600">Payment Failed</p>
        <p className="text-gray-500 text-sm text-center">Please inform the cashier to try again.</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-6 p-6">
        <XCircle size={80} className="text-gray-400" />
        <p className="text-2xl font-bold text-gray-600">QR Code Expired</p>
        <p className="text-gray-500 text-sm text-center">Ask the cashier to generate a new QR code.</p>
      </div>
    );
  }

  // Waiting state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-5 p-6 select-none">
      {/* Header */}
      <p className="text-lg font-bold text-gray-700">Scan with HelaPay or any LankaQR app</p>

      {/* Amount */}
      {session && (
        <p className="text-4xl font-black text-gray-900">Rs {fmt(session.amount)}</p>
      )}

      {/* QR Code */}
      {session?.qr_data && (
        <div className="bg-white p-4 rounded-3xl border-4 border-primary-100 shadow-lg">
          <QRCodeSVG value={session.qr_data} size={280} level="M" />
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
        Waiting for payment…
      </div>

      {/* Countdown */}
      <p className="text-xs text-gray-400">Expires in <strong>{timeLeft}</strong></p>
    </div>
  );
}
