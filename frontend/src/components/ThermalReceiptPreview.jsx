import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Printer, X } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { generateThermalLines, linesToHtml } from '../utils/thermalReceiptUtils';

/**
 * ThermalReceiptPreview
 *
 * Props:
 *   data         – receipt data object
 *   onClose      – callback to close the modal
 *   defaultWidth – 32 | 48 (from getThermalWidth())
 *   qrUrl        – URL to encode in the footer QR code
 *   autoPrint    – open the print dialog automatically on mount
 */
export default function ThermalReceiptPreview({ data, onClose, defaultWidth = 48, qrUrl, autoPrint = false }) {
  const [charWidth, setCharWidth] = useState(defaultWidth);

  // Hidden canvas - sole purpose is generating a PNG data URL for the print window
  const qrCanvasContainerRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const autoPrinted = useRef(false);

  useEffect(() => {
    if (!qrUrl) return;
    const id = setTimeout(() => {
      const canvas = qrCanvasContainerRef.current?.querySelector('canvas');
      if (canvas) setQrDataUrl(canvas.toDataURL('image/png'));
    }, 250);
    return () => clearTimeout(id);
  }, [qrUrl, charWidth]);

  const { beforeHtml, afterHtml, hasQR } = useMemo(() => {
    if (!data) return { beforeHtml: '', afterHtml: '', hasQR: false };
    const lines = generateThermalLines(data, { width: charWidth });
    const qrIdx = lines.findIndex((l) => l.startsWith('##QR##'));
    const has   = qrIdx >= 0;
    return {
      beforeHtml: linesToHtml(has ? lines.slice(0, qrIdx) : lines),
      afterHtml:  linesToHtml(has ? lines.slice(qrIdx + 1) : []),
      hasQR: has,
    };
  }, [data, charWidth]);

  const fontSize   = charWidth === 32 ? '11px' : '12px';
  const mmWidth    = charWidth === 32 ? '58mm'  : '80mm';
  const paperLabel = mmWidth;

  // ── Print ───────────────────────────────────────────────────
  const handlePrint = useCallback((overrideDataUrl) => {
    const qrDU = overrideDataUrl !== undefined ? overrideDataUrl : qrDataUrl;

    const qrBlock = hasQR
      ? qrDU
        ? `<div style="text-align:center;padding:4px 0 2px;"><img src="${qrDU}" width="90" height="90" alt="QR" style="display:block;margin:0 auto 2px;"/><span style="font-size:0.8em;color:#555;">Scan to pre-order</span></div>`
        : `<div style="text-align:center;padding:4px 0;font-family:'Courier New',Courier,monospace;">[ QR CODE HERE ]</div>`
      : '';

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',Courier,monospace;font-size:${fontSize};width:${charWidth}ch;margin:0 auto;padding:4mm 0;color:#000;}
  pre{white-space:pre;font-family:inherit;font-size:inherit;line-height:1.4;margin:0;}
  @media print{body{width:${mmWidth};margin:0;padding:2mm 0;}}
</style>
</head><body>
<pre>${beforeHtml}</pre>
${qrBlock}
<pre>${afterHtml}</pre>
<script>window.onload=function(){window.focus();window.print();};<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [hasQR, qrDataUrl, beforeHtml, afterHtml, charWidth, fontSize, mmWidth]);

  // Auto-print: fire once QR data URL is ready (skip wait if no qrUrl needed)
  useEffect(() => {
    if (!autoPrint || autoPrinted.current) return;
    if (qrUrl && !qrDataUrl) return; // wait for the canvas to be captured
    autoPrinted.current = true;
    handlePrint();
  }, [autoPrint, qrUrl, qrDataUrl, handlePrint]);

  if (!data) return null;

  const preStyle = {
    whiteSpace: 'pre',
    fontFamily: 'inherit',
    fontSize:   'inherit',
    lineHeight: '1.4',
    margin:     0,
    width:      `${charWidth}ch`,
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-6">

      {/* Off-screen canvas - only used to generate the PNG data URL for printing */}
      <div
        ref={qrCanvasContainerRef}
        style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', opacity: 0 }}
        aria-hidden="true"
      >
        {qrUrl && <QRCodeCanvas value={qrUrl} size={90} />}
      </div>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">Receipt Preview</span>

          <div className="flex items-center gap-2">
            {/* Width toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs font-medium">
              {[48, 32].map((w) => (
                <button
                  key={w}
                  onClick={() => setCharWidth(w)}
                  className={`px-3 py-1.5 transition-colors ${
                    charWidth === w ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {w === 48 ? '80mm' : '58mm'}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer size={14} />
              Print
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Receipt paper - width driven by ch units so every character fits */}
        <div className="p-4 bg-gray-100 flex justify-center overflow-x-auto">
          <div
            className="bg-white shadow-md"
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize,
              lineHeight: '1.4',
              padding:    '12px 0',
              width:      'max-content',
            }}
          >
            <pre style={preStyle} dangerouslySetInnerHTML={{ __html: beforeHtml }} />

            {/* QR section - flexbox centres the SVG correctly (textAlign won't work on SVG) */}
            {hasQR && (
              <div style={{
                width:         `${charWidth}ch`,
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                padding:       '6px 0 2px',
              }}>
                {qrUrl
                  ? <>
                      <QRCodeSVG value={qrUrl} size={90} />
                      <div style={{ fontSize: '0.8em', color: '#555', marginTop: '2px' }}>
                        Scan to pre-order
                      </div>
                    </>
                  : <span style={{ fontFamily: 'inherit' }}>[ QR CODE HERE ]</span>
                }
              </div>
            )}

            <pre style={preStyle} dangerouslySetInnerHTML={{ __html: afterHtml }} />
          </div>
        </div>

        <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
          {paperLabel} thermal printer · {charWidth} chars/line
        </div>
      </div>
    </div>
  );
}
