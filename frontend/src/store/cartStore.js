import { create } from 'zustand';

function calcItemTotal(item) {
  const base     = item.unit_price * item.quantity;
  const discAmt  = item.discount_type === 'pct'
    ? base * (item.discount_pct / 100)
    : 0;
  const subtotal = Math.max(0, base - discAmt);
  return { discAmt, subtotal };
}

const useCartStore = create((set, get) => ({
  items: [],   // { cartId, product_id, name, unit_price, quantity, discount_pct, tax_rate, discAmt, subtotal }
  orderDiscount: 0,  // flat order-level discount

  // ── Add product (or increment qty if already in cart) ──────
  addItem(product, qty = 1) {
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) => {
            if (i.product_id !== product.id) return i;
            const updated = { ...i, quantity: i.quantity + qty };
            return { ...updated, ...calcItemTotal(updated) };
          }),
        };
      }
      const newItem = {
        cartId:        `${product.id}-${Date.now()}`,
        product_id:    product.id,
        name:          product.name,
        unit_price:    parseFloat(product.price),
        quantity:      qty,
        discount_pct:  0,
        tax_rate:      parseFloat(product.tax_rate) || 0,
        discAmt:       0,
        subtotal:      parseFloat(product.price) * qty,
      };
      return { items: [...state.items, newItem] };
    });
  },

  // ── Set quantity directly ──────────────────────────────────
  setQty(cartId, qty) {
    if (qty <= 0) { get().removeItem(cartId); return; }
    set((state) => ({
      items: state.items.map((i) => {
        if (i.cartId !== cartId) return i;
        const updated = { ...i, quantity: qty };
        return { ...updated, ...calcItemTotal(updated) };
      }),
    }));
  },

  // ── Set per-item discount (%) ───────────────────────────────
  setItemDiscount(cartId, pct) {
    const p = Math.min(100, Math.max(0, parseFloat(pct) || 0));
    set((state) => ({
      items: state.items.map((i) => {
        if (i.cartId !== cartId) return i;
        const updated = { ...i, discount_pct: p };
        return { ...updated, ...calcItemTotal(updated) };
      }),
    }));
  },

  removeItem(cartId) {
    set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) }));
  },

  setOrderDiscount(amt) {
    set({ orderDiscount: Math.max(0, parseFloat(amt) || 0) });
  },

  clearCart() {
    set({ items: [], orderDiscount: 0 });
  },

  // ── Computed totals ────────────────────────────────────────
  get totals() {
    const items         = get().items;
    const orderDiscount = get().orderDiscount;

    const itemsSubtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const itemsDiscount = items.reduce((s, i) => s + i.discAmt,  0);
    const taxAmount     = items.reduce((s, i) => s + (i.subtotal * i.tax_rate / 100), 0);
    const totalDiscount = itemsDiscount + orderDiscount;
    const grandTotal    = Math.max(0, itemsSubtotal + taxAmount - orderDiscount);

    return {
      itemsSubtotal,   // sum of (unit_price * qty) before item discounts
      itemsDiscount,   // sum of all item discount amounts
      orderDiscount,
      totalDiscount,
      taxAmount,
      grandTotal,
    };
  },
}));

export default useCartStore;
