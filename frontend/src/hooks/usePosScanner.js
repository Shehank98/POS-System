import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for the POS-side WebSocket phone scanner.
 * States: 'idle' | 'connecting' | 'waiting' | 'phone_connected'
 */
export default function usePosScanner({ onBarcode }) {
  const [state, setState] = useState('idle');
  const [code,  setCode]  = useState('');
  const wsRef        = useRef(null);
  const onBarcodeRef = useRef(onBarcode);

  // Keep callback ref current without reconnecting
  useEffect(() => { onBarcodeRef.current = onBarcode; }, [onBarcode]);

  const connect = useCallback(() => {
    if (wsRef.current) return; // already open
    setState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'pos' }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'registered') {
        setCode(msg.code);
        setState('waiting');
      } else if (msg.type === 'phone_connected') {
        setState('phone_connected');
      } else if (msg.type === 'phone_disconnected') {
        setState('waiting');
      } else if (msg.type === 'barcode') {
        onBarcodeRef.current?.(msg.data);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setState('idle');
      setCode('');
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    // onclose handler will reset state
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return { state, code, connect, disconnect };
}
