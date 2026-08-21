/**
 * WARP MARKET — Carrito
 * Maneja el estado del carrito en localStorage y expone helpers puros.
 * No toca el DOM: eso es responsabilidad de store.js
 */

const Cart = (() => {
  const KEY = "wm_cart_v1";
  let items = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(items));
    listeners.forEach((fn) => fn(getState()));
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function add(product, qty = 1) {
    const current = items[product.id]?.qty || 0;
    const max = product.stock ?? Infinity;
    const nextQty = Math.min(current + qty, max);
    items[product.id] = { ...product, qty: nextQty };
    persist();
  }

  function setQty(id, qty) {
    if (!items[id]) return;
    if (qty <= 0) {
      remove(id);
      return;
    }
    const max = items[id].stock ?? Infinity;
    items[id].qty = Math.min(qty, max);
    persist();
  }

  function remove(id) {
    delete items[id];
    persist();
  }

  function clear() {
    items = {};
    persist();
  }

  function getState() {
    return Object.values(items);
  }

  function getCount() {
    return getState().reduce((sum, it) => sum + it.qty, 0);
  }

  function getTotal() {
    return getState().reduce((sum, it) => sum + it.qty * it.precio, 0);
  }

  return { add, setQty, remove, clear, getState, getCount, getTotal, onChange };
})();
