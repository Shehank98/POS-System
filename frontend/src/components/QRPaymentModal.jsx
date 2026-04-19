import { useState, useEffect, useRef, useCallback } from 'react';
import { X, QrCode, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { qrPaymentsApi } from '../api/client';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function countdown(expiresAt) {
  const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
  const m    = Math.floor(diff / 60);
  const s    = diff % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QRPaymentModal({ amount, sessionType = 'pos', preOrderId, onClose, onSuccess }) {
  const [state,      setState]      = useState('generating'); // generating | waiting | success | failed | expired
  const [session,    setSession]    = useState(null);         // { reference, qr_data, qr_reference, expires_at }
  const [timeLeft,   setTimeLeft]   = useState('10:00');
  const [showPhone,  setShowPhone]  = useState(false);

  const pollRef    = useRef(null);
  const timerRef   = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startPolling = useCallback((ref, expiresAt) => {
    // Countdown timer
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(countdown(expiresAt));
      if (left === 0) {
        stopPolling();
        setState('expired');
      }
    }, 1000);

    // Status polling every 3 s
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await qrPaymentsApi.checkStatus(ref);
        if (data.payment_status === 2) {
          stopPolling();
          setState('success');
          setTimeout(() => onSuccess({ reference: ref }), 1200);
        } else if (data.payment_status === -1) {
          stopPolling();
          setState('failed');
        }
      } catch { /* network blip — keep polling */ }
    }, 3000);
  }, [stopPolling, onSuccess]);

  const generate = useCallback(async () => {
    setState('generating');
    setShowPhone(false);
    try {
      const { data } = await qrPaymentsApi.generate({
        amount,
        session_type: sessionType,
        pre_order_id: preOrderId || undefined,
      });
      setSession(data);
      setTimeLeft(countdown(data.expires_at));
      setState('waiting');
      startPolling(data.reference, data.expires_at);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR. Please try again.');
      onClose();
    }
  }, [amount, sessionType, preOrderId, startPolling, onClose]);

  useEffect(() => {
    generate();
    return stopPolling;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket: listen for real-time confirmation
  useEffect(() => {
    const token = localStorage.getItem('pos_token');
    if (!token || !window.WebSocket) return;

    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
    const ws    = new WebSocket(wsUrl);

    ws.onopen  = () => ws.send(JSON.stringify({ type: 'subscribe_shop', token }));
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'qr_payment_update' && session && msg.reference === session.reference) {
          if (msg.payment_status === 2) {
            stopPolling();
            setState('success');
            setTimeout(() => onSuccess({ reference: session.reference }), 1200);
          } else if (msg.payment_status === -1) {
            stopPolling();
            setState('failed');
          }
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [session, stopPolling, onSuccess]);

  const displayUrl = session
    ? `${window.location.origin}/qr-display?ref=${session.reference}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-primary-600" />
            <span className="font-semibold text-gray-800">QR Payment</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-5 py-6 gap-4">

          {/* Amount */}
          <p className="text-3xl font-black text-gray-900">Rs {fmt(amount)}</p>

          {/* QR area */}
          {state === 'generating' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Generating QR code…</p>
            </div>
          )}

          {state === 'waiting' && session && (
            <>
              <div className="bg-white p-3 rounded-2xl border-2 border-primary-100 shadow-sm">
                <QRCodeSVG value={session.qr_data} size={220} level="M" />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Scan with <strong>HelaPay</strong> or any LankaQR app
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Waiting for payment… expires in <strong className="text-gray-600">{timeLeft}</strong>
              </div>

              {/* Show on Phone toggle */}
              <button
                onClick={() => setShowPhone((v) => !v)}
                className="flex items-center gap-2 text-xs text-primary-600 hover:underline mt-1"
              >
                <Smartphone size={14} />
                {showPhone ? 'Hide' : 'Show on cashier phone'}
              </button>

              {showPhone && displayUrl && (
                <div className="flex flex-col items-center gap-2 border border-dashed border-gray-200 rounded-xl p-3 w-full">
                  <p className="text-xs text-gray-400 text-center">Scan this with your phone to open full-screen QR</p>
                  <div className="bg-white p-1.5 rounded-lg border border-gray-100">
                    <QRCodeSVG value={displayUrl} size={110} level="M" />
                  </div>
                </div>
              )}
            </>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 size={64} className="text-green-500" />
              <p className="text-xl font-bold text-green-700">Payment Received!</p>
              <p className="text-sm text-gray-500">Completing transaction…</p>
            </div>
          )}

          {state === 'failed' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle size={64} className="text-red-400" />
              <p className="text-xl font-bold text-red-600">Payment Failed</p>
              <p className="text-sm text-gray-500">Please try again or use a different method.</p>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          )}

          {state === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle size={64} className="text-gray-400" />
              <p className="text-xl font-bold text-gray-600">QR Expired</p>
              <p className="text-sm text-gray-500">The QR code has expired. Generate a new one.</p>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
              >
                <RefreshCw size={14} /> New QR Code
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(state === 'waiting' || state === 'generating') && (
          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
