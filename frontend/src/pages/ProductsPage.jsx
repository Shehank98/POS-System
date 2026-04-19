import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Barcode, Pencil, Trash2,
  ChevronLeft, ChevronRight, Upload, RefreshCw, X, AlertTriangle,
  ChevronDown, ChevronUp, Tag, Package, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi, clothingApi } from '../api/client';
import useAuthStore from '../store/authStore';
import ProductForm from '../components/ProductForm';
import BulkImport from '../components/BulkImport';
import ConfirmDialog from '../components/ConfirmDialog';
import ClothingProductsPanel from '../components/clothing/ClothingProductsPanel';

const LIMIT = 50;

function formatCurrency(val) {
  return Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = !user?.read_only && ['owner', 'manager'].includes(user?.role);

  // Clothing shops get their own dedicated panel
  if (user?.shop_type === 'clothing') {
    return <ClothingProductsPanel canEdit={canEdit} />;
  }

  const [products,   setProducts]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [lowStock,   setLowStock]   = useState(false);
  const [categories, setCategories] = useState([]);

  // UI state
  const [showForm,    setShowForm]    = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showImport,  setShowImport]  = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);

  const searchRef = useRef();

  async function load(overrides = {}) {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, search, category, low_stock: lowStock, ...overrides };
      const { data } = await productsApi.list(params);
      setProducts(data.products);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, category, lowStock]); // eslint-disable-line

  useEffect(() => {
    productsApi.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load({ page: 1, search }); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function openAdd()    { setEditProduct(null); setShowForm(true); }
  function openEdit(p)  { setEditProduct(p);    setShowForm(true); }
  function closeForm()  { setShowForm(false); setEditProduct(null); }

  async function handleSaved() {
    closeForm();
    await load();
    productsApi.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }

  async function confirmDelete() {
    try {
      await productsApi.delete(deleteId);
      toast.success('Product deleted');
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900 shrink-0">Products</h1>
        {canEdit && (
          <div className="flex gap-2">
            <button
              className="btn-secondary px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={() => setShowImport(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import Excel</span>
              <span className="sm:hidden">Import</span>
            </button>
            <button
              className="btn-primary px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={openAdd}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        )}
      </div>

      {/* Read-only banner */}
      {user?.read_only && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200
                        text-yellow-800 rounded-lg px-4 py-2 text-sm">
          ⚠️ Read-only mode - subscription expired. Contact admin to renew.
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder="Search by name or barcode…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => { setSearch(''); setPage(1); load({ page: 1, search: '' }); }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <select
            className="input sm:w-48"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Low stock filter */}
          <button
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium
                        shrink-0 transition-colors
                        ${lowStock
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            onClick={() => { setLowStock((v) => !v); setPage(1); }}
            title="Show only low / out-of-stock items"
          >
            <AlertTriangle className="w-4 h-4" />
            Low stock
          </button>

          <button
            className="btn-secondary shrink-0"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                  <span className="flex items-center gap-1"><Barcode className="w-3.5 h-3.5" />Barcode</span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Tax %</th>
                {canEdit && (
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-12 text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-12 text-gray-400">
                    No products found.{canEdit && ' Click "Add Product" to get started.'}
                  </td>
                </tr>
              ) : products.map((p) => {
                const qty = parseFloat(p.stock_quantity) || 0;
                const outOfStock  = p.has_inventory && qty <= 0;
                const lowStockRow = p.has_inventory && qty > 0 && qty <= 10;
                return (
                <tr key={p.id}
                    className={`transition-colors
                      ${outOfStock  ? 'bg-red-50 hover:bg-red-100'
                      : lowStockRow ? 'bg-orange-50 hover:bg-orange-100'
                      : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {outOfStock  && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">OUT</span>}
                      {lowStockRow && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded shrink-0">LOW</span>}
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">
                    {p.barcode || <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {p.category || <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(p.price)}
                    {p.unit_type === 'kg' && <span className="text-xs text-gray-400 ml-0.5">/kg</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.has_inventory
                      ? <span className={
                          outOfStock  ? 'font-bold text-red-600'
                        : lowStockRow ? 'font-bold text-orange-600'
                        : 'text-gray-700'
                        }>
                          {p.unit_type === 'kg'
                            ? `${parseFloat(p.stock_quantity)} KG`
                            : Math.round(parseFloat(p.stock_quantity))}
                        </span>
                      : <span className="text-gray-400 text-xs">Unlimited</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 hidden lg:table-cell">
                    {p.tax_rate > 0 ? `${p.tax_rate}%` : '-'}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500
                                     hover:text-primary-600 transition-colors"
                          onClick={() => openEdit(p)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500
                                     hover:text-red-600 transition-colors"
                          onClick={() => setDeleteId(p.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100
                          bg-gray-50">
            <span className="text-sm text-gray-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                className="btn-secondary px-2 py-1"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="btn-secondary px-2 py-1"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onSaved={handleSaved}
          onClose={closeForm}
        />
      )}

      {showImport && (
        <BulkImport
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load(); }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          message="This product will be permanently deleted and cannot be recovered."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
