import { create } from 'zustand';

function calcItemTotal(item) {
  const base    = item.unit_price * item.quantity;
  const discAmt = item.discount_pct > 0
    ? base * (item.discount_pct / 100)
    : 0;
  const subtotal = Math.max(0, base - discAmt);
  return { discAmt, subtotal };
}

function calcTotals(items, orderDiscount) {
  const itemsSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const itemsDiscount = items.reduce((s, i) => s + i.discAmt,  0);
  const taxAmount     = items.reduce((s, i) => s + (i.subtotal * i.tax_rate / 100), 0);
  const totalDiscount = itemsDiscount + orderDiscount;
  const grandTotal    = Math.max(0, itemsSubtotal + taxAmount - orderDiscount);
  return { itemsSubtotal, itemsDiscount, orderDiscount, totalDiscount, taxAmount, grandTotal };
}

const EMPTY_TOTALS = calcTotals([], 0);

const useCartStore = create((set, get) => ({
  items:         [],
  orderDiscount: 0,
  totals:        EMPTY_TOTALS,

  // ── Add product (or increment qty if already in cart) ──────
  addItem(product, qty = 1) {
    set((state) => {
      let items;
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        items = state.items.map((i) => {
          if (i.product_id !== product.id) return i;
          const updated = { ...i, quantity: i.quantity + qty };
          return { ...updated, ...calcItemTotal(updated) };
        });
      } else {
        const newItem = {
          cartId:       `${product.id}-${Date.now()}`,
          product_id:   product.id,
          name:         product.name,
          unit_price:   parseFloat(product.price),
          quantity:     qty,
          discount_pct: 0,
          tax_rate:     parseFloat(product.tax_rate) || 0,
          discAmt:      0,
          subtotal:     parseFloat(product.price) * qty,
        };
        items = [...state.items, newItem];
      }
      return { items, totals: calcTotals(items, state.orderDiscount) };
    });
  },

  // ── Set quantity directly ──────────────────────────────────
  setQty(cartId, qty) {
    if (qty <= 0) { get().removeItem(cartId); return; }
    set((state) => {
      const items = state.items.map((i) => {
        if (i.cartId !== cartId) return i;
        const updated = { ...i, quantity: qty };
        return { ...updated, ...calcItemTotal(updated) };
      });
      return { items, totals: calcTotals(items, state.orderDiscount) };
    });
  },

  // ── Set per-item discount (%) ───────────────────────────────
  setItemDiscount(cartId, pct) {
    const p = Math.min(100, Math.max(0, parseFloat(pct) || 0));
    set((state) => {
      const items = state.items.map((i) => {
        if (i.cartId !== cartId) return i;
        const updated = { ...i, discount_pct: p };
        return { ...updated, ...calcItemTotal(updated) };
      });
      return { items, totals: calcTotals(items, state.orderDiscount) };
    });
  },

  removeItem(cartId) {
    set((state) => {
      const items = state.items.filter((i) => i.cartId !== cartId);
      return { items, totals: calcTotals(items, state.orderDiscount) };
    });
  },

  setOrderDiscount(amt) {
    const orderDiscount = Math.max(0, parseFloat(amt) || 0);
    set((state) => ({
      orderDiscount,
      totals: calcTotals(state.items, orderDiscount),
    }));
  },

  clearCart() {
    set({ items: [], orderDiscount: 0, totals: EMPTY_TOTALS });
  },
}));

export default useCartStore;
