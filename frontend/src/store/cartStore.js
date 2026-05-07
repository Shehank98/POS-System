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
  // Clothing variants use `cv-{variant_id}` as the dedup key so two
  // variants of the same parent product are treated as separate rows.
  // Retail items continue to use `p-{product_id}` - fully backward-compatible.
  addItem(product, qty = 1) {
    set((state) => {
      const key = product.clothing_variant_id
        ? `cv-${product.clothing_variant_id}`
        : `p-${product.id}`;

      let items;
      const existing = state.items.find((i) => i._key === key);
      if (existing) {
        const updated = { ...existing, quantity: existing.quantity + qty };
        const updatedItem = { ...updated, ...calcItemTotal(updated) };
        items = [updatedItem, ...state.items.filter((i) => i._key !== key)];
      } else {
        const price = parseFloat(
          product.effective_price ?? product.price ?? product.unit_price ?? 0
        );
        const newItem = {
          _key:                key,
          cartId:              `${key}-${Date.now()}`,
          product_id:          product.clothing_variant_id ? null : product.id,
          clothing_variant_id: product.clothing_variant_id ?? null,
          name:                product.name,
          unit_price:          price,
          quantity:            qty,
          discount_pct:        0,
          tax_rate:            parseFloat(product.tax_rate) || 0,
          unit_type:           product.unit_type || 'unit',
          is_clearance:        product.is_clearance || false,
          discAmt:             0,
          subtotal:            price * qty,
        };
        items = [newItem, ...state.items];
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
