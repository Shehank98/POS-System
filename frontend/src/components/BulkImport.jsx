import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/client';

const TEMPLATE_HEADERS = [
  'name', 'barcode', 'price', 'cost_price',
  'stock_quantity', 'has_inventory', 'category', 'tax_rate',
];

const TEMPLATE_EXAMPLE = [
  ['Coca-Cola 330ml', '5000112611871', 1.50, 0.90, 100, true,  'Beverages', 0],
  ['Lay\'s Chips',    '5060073774617', 1.20, 0.70, 50,  true,  'Snacks',    0],
  ['Coffee (cup)',   '',              2.50, 1.00, 0,   false, 'Beverages', 5],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]);
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'products_import_template.xlsx');
}

function parseRows(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return raw.map((row, i) => {
    const name = String(row['name'] || row['Name'] || '').trim();
    const price = parseFloat(row['price'] || row['Price']) || 0;
    return {
      _row: i + 2,
      name,
      barcode:        String(row['barcode']        || row['Barcode']        || '').trim() || null,
      price,
      cost_price:     parseFloat(row['cost_price']     || row['Cost Price']     || 0) || 0,
      stock_quantity: parseInt(row['stock_quantity']   || row['Stock Quantity'] || 0, 10) || 0,
      has_inventory:  String(row['has_inventory'] || row['Has Inventory'] || 'true')
                        .toLowerCase() !== 'false',
      category:       String(row['category'] || row['Category'] || '').trim() || null,
      tax_rate:       parseFloat(row['tax_rate'] || row['Tax Rate'] || 0) || 0,
      _valid:         name !== '' && price >= 0,
      _error:         name === '' ? 'Name required' : price < 0 ? 'Price must be ≥ 0' : null,
    };
  });
}

export default function BulkImport({ onClose, onDone }) {
  const fileRef = useRef();
  const [rows,     setRows]     = useState([]);
  const [fileName, setFileName] = useState('');
  const [status,   setStatus]   = useState('idle'); // idle | preview | importing | done

  const validRows   = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb    = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(sheet);
        setRows(parsed);
        setStatus('preview');
      } catch {
        toast.error('Could not read file. Is it a valid Excel (.xlsx) file?');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setStatus('importing');
    let success = 0;
    let failed  = 0;
    for (const row of validRows) {
      try {
        // eslint-disable-next-line no-unused-vars
        const { _row, _valid, _error, ...payload } = row;
        await productsApi.create(payload);
        success++;
      } catch {
        failed++;
      }
    }
    toast.success(`Imported ${success} product${success !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`);
    setStatus('done');
    onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Bulk Import Products</h2>
          <button className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Step 1: Download template */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800">Step 1 - Download the template</p>
            <p className="text-xs text-blue-600">
              Fill in the Excel template with your products, then upload it below.
              Column <code>has_inventory</code>: use <code>true</code> / <code>false</code>.
            </p>
            <button className="btn-secondary text-xs" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
            </button>
          </div>

          {/* Step 2: Upload */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Step 2 - Upload your filled file</p>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2
                              border-dashed border-gray-300 rounded-lg cursor-pointer
                              hover:border-primary-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-6 h-6 text-gray-400 mb-1" />
              <span className="text-sm text-gray-500">
                {fileName || 'Click to choose Excel file…'}
              </span>
              <span className="text-xs text-gray-400">.xlsx or .xls</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>

          {/* Preview */}
          {status === 'preview' && rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {validRows.length} valid
                </span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {invalidRows.length} will be skipped
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-gray-500">Row</th>
                      <th className="px-3 py-2 text-left text-gray-500">Name</th>
                      <th className="px-3 py-2 text-right text-gray-500">Price</th>
                      <th className="px-3 py-2 text-left text-gray-500">Category</th>
                      <th className="px-3 py-2 text-right text-gray-500">Stock</th>
                      <th className="px-3 py-2 text-left text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 100).map((r) => (
                      <tr key={r._row} className={r._valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-1.5 text-gray-400">{r._row}</td>
                        <td className="px-3 py-1.5 font-medium">{r.name || '-'}</td>
                        <td className="px-3 py-1.5 text-right">{r.price}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.category || '-'}</td>
                        <td className="px-3 py-1.5 text-right">
                          {r.has_inventory ? r.stock_quantity : 'N/A'}
                        </td>
                        <td className="px-3 py-1.5">
                          {r._valid
                            ? <span className="text-green-600">✓</span>
                            : <span className="text-red-600">{r._error}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            {status === 'preview' && validRows.length > 0 && (
              <button className="btn-primary" onClick={handleImport}>
                <Upload className="w-4 h-4" />
                Import {validRows.length} Products
              </button>
            )}
            {status === 'importing' && (
              <button className="btn-primary" disabled>
                <Loader2 className="w-4 h-4 animate-spin" /> Importing…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
