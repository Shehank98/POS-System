import { useState, useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { generateThermalLines, linesToHtml } from '../utils/thermalReceiptUtils';

/**
 * ThermalReceiptPreview
 *
 * Props:
 *   data        – receipt data object (see thermalReceiptUtils.generateThermalLines)
 *   onClose     – callback to close/dismiss the modal
 *   defaultWidth – 32 | 48 (default 48)
 */
export default function ThermalReceiptPreview({ data, onClose, defaultWidth = 48 }) {
  const [charWidth, setCharWidth] = useState(defaultWidth);

  const htmlContent = useMemo(() => {
    if (!data) return '';
    const lines = generateThermalLines(data, { width: charWidth });
    return linesToHtml(lines);
  }, [data, charWidth]);

  const mmWidth    = charWidth === 32 ? '58mm' : '80mm';
  const fontSize   = charWidth === 32 ? '11px' : '12px';
  const paperLabel = charWidth === 32 ? '58mm' : '80mm';

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=520,height=700,noopener');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',Courier,monospace;font-size:${fontSize};width:${mmWidth};margin:0 auto;padding:4mm 3mm;color:#000;}
  pre{white-space:pre;font-family:inherit;font-size:inherit;line-height:1.4;overflow:hidden;}
  @media print{body{margin:0;padding:0;}}
</style>
</head><body>
<pre>${htmlContent}</pre>
<script>window.onload=()=>window.print();<\/script>
</body></html>`);
    win.document.close();
  };

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">Receipt Preview</span>

          <div className="flex items-center gap-2">
            {/* paper size toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs font-medium">
              {[48, 32].map((w) => (
                <button
                  key={w}
                  onClick={() => setCharWidth(w)}
                  className={`px-3 py-1.5 transition-colors ${
                    charWidth === w
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {w === 48 ? '80mm' : '58mm'}
                </button>
              ))}
            </div>

            <button
              onClick={handlePrint}
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

        {/* receipt paper */}
        <div className="p-4 bg-gray-100 flex justify-center">
          <div
            className="bg-white shadow-md"
            style={{
              width: charWidth === 32 ? '200px' : '290px',
              padding: '12px 10px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: fontSize,
              lineHeight: '1.4',
            }}
          >
            <pre
              style={{
                whiteSpace: 'pre',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>

        <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
          {paperLabel} thermal printer · {charWidth} chars/line
        </div>
      </div>
    </div>
  );
}
