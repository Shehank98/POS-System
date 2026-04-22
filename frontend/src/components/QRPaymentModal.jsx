import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { qrPaymentsApi } from '../api/client';
import useAuthStore from '../store/authStore';

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

export default function QRPaymentModal({ amount, sessionType = 'pos', preOrderId, onClose, onSuccess }) {
  const [phase,      setPhase]      = useState('generating'); // generating | waiting | success | failed | expired
  const [session,    setSession]    = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const pollRef = useRef(null);
  const wsRef   = useRef(null);
  const user    = useAuthStore((s) => s.user);
  const { secs, label: countdown } = useCountdown(session?.expires_at);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  // Generate QR on mount
  useEffect(() => {
    let cancelled = false;
    qrPaymentsApi.generate({ amount, session_type: sessionType, pre_order_id: preOrderId })
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data);
        setPhase('waiting');
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.error || 'Failed to generate QR');
        setPhase('failed');
      });
    return () => { cancelled = true; };
  }, [amount, sessionType, preOrderId]);

  // Poll for payment status
  useEffect(() => {
    if (phase !== 'waiting' || !session?.reference) return;
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await qrPaymentsApi.checkStatus(session.reference);
        if (data.payment_status === 2) {
          stopPolling();
          setPhase('success');
          setTimeout(() => onSuccess({ reference: session.reference }), 1500);
        } else if (data.payment_status === -1) {
          stopPolling();
          setPhase('failed');
        }
      } catch {}
    }, 2000);
    return stopPolling;
  }, [phase, session, stopPolling, onSuccess]);

  // WebSocket — instant payment confirmation without waiting for next poll cycle
  useEffect(() => {
    if (phase !== 'waiting' || !session?.reference || !user?.shop_id) return;
    closeWs();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe_shop', shopId: user.shop_id }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'qr_payment_update' || msg.reference !== session.reference) return;
        if (msg.payment_status === 2) {
          stopPolling();
          closeWs();
          setPhase('success');
          setTimeout(() => onSuccess({ reference: session.reference }), 1500);
        } else if (msg.payment_status === -1) {
          stopPolling();
          closeWs();
          setPhase('failed');
        }
      } catch {}
    };
    return closeWs;
  }, [phase, session, user, stopPolling, closeWs, onSuccess]);

  // Handle expiry via countdown
  useEffect(() => {
    if (phase === 'waiting' && secs === 0 && session?.expires_at) {
      stopPolling();
      closeWs();
      setPhase('expired');
    }
  }, [phase, secs, session, stopPolling, closeWs]);

  async function handleRetry() {
    stopPolling();
    closeWs();
    setSession(null);
    setShowMobile(false);
    setPhase('generating');
    try {
      const { data } = await qrPaymentsApi.generate({ amount, session_type: sessionType, pre_order_id: preOrderId });
      setSession(data);
      setPhase('waiting');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR');
      setPhase('failed');
    }
  }

  const mobileUrl = session ? `${window.location.origin}/qr-display?ref=${session.reference}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">QR Payment</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Amount */}
          <div className="text-center bg-primary-50 rounded-xl py-3">
            <p className="text-xs text-primary-500 uppercase tracking-wide mb-1">Amount</p>
            <p className="text-3xl font-bold text-primary-700">Rs. {fmt(amount)}</p>
          </div>

          {/* Generating */}
          {phase === 'generating' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              <p className="text-sm text-gray-500">Generating QR code…</p>
            </div>
          )}

          {/* Waiting — show QR */}
          {phase === 'waiting' && session && (
            <>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scan to Pay with LankaQR</p>
                <div className="p-3 bg-white border-2 border-gray-100 rounded-xl shadow-sm">
                  <QRCodeSVG value={session.qr_data} size={260} level="M" />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-xs text-gray-400">Ref: {session.reference.slice(0, 8).toUpperCase()}</p>
                  <p className={`text-sm font-semibold ${secs < 60 ? 'text-red-500' : 'text-gray-600'}`}>
                    Expires in: {countdown}
                  </p>
                </div>
              </div>

              {/* Show on Phone toggle */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setShowMobile((v) => !v)}
                  className="flex items-center gap-2 text-xs text-primary-600 hover:text-primary-800 font-medium mx-auto"
                >
                  <Smartphone className="w-4 h-4" />
                  {showMobile ? 'Hide phone display' : 'Show on phone'}
                </button>
                {showMobile && (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-400 text-center">
                      Cashier: scan this with your phone to show full-screen to customer
                    </p>
                    <div className="p-2 bg-white border border-gray-200 rounded-lg">
                      <QRCodeSVG value={mobileUrl} size={130} level="M" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <p className="text-lg font-bold text-green-700">Payment Received!</p>
            </div>
          )}

          {/* Failed */}
          {phase === 'failed' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle className="w-14 h-14 text-red-400" />
              <p className="text-base font-semibold text-red-600">Payment Failed</p>
              <button onClick={handleRetry} className="btn-primary text-sm flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          )}

          {/* Expired */}
          {phase === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle className="w-14 h-14 text-yellow-400" />
              <p className="text-base font-semibold text-yellow-600">QR Code Expired</p>
              <button onClick={handleRetry} className="btn-primary text-sm flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> Generate New QR
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'waiting' || phase === 'generating') && (
          <div className="px-5 pb-5">
            <button className="btn-secondary w-full" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
