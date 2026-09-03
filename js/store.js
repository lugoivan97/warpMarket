/**
 * WARP MARKET — Tienda pública
 */

(() => {
  "use strict";

  // ---------- Estado ----------
  let allProducts = [];
  let activeCategory = "Todos";
  let searchTerm = "";
  let tapCount = 0;
  let tapTimer = null;

  // ---------- Referencias DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    storeName: $("#storeName"),
    tagline: $("#tagline"),
    grid: $("#productGrid"),
    categoryRail: $("#categoryRail"),
    searchInput: $("#searchInput"),
    resultsCount: $("#resultsCount"),
    fabWhatsapp: $("#fabWhatsapp"),
    cartToggle: $("#cartToggle"),
    cartCount: $("#cartCount"),
    cartDrawer: $("#cartDrawer"),
    cartOverlay: $("#cartOverlay"),
    cartClose: $("#cartClose"),
    cartItems: $("#cartItems"),
    cartEmpty: $("#cartEmpty"),
    cartTotal: $("#cartTotal"),
    checkoutBtn: $("#checkoutBtn"),
    toastHost: $("#toastHost"),
    shippingNote: $("#shippingNote"),
    year: $("#year"),

    modalOverlay: $("#productModalOverlay"),
    modal: $("#productModal"),
    modalClose: $("#productModalClose"),
    modalMedia: $("#productModalMedia"),
    modalCategory: $("#productModalCategory"),
    modalTitle: $("#productModalTitle"),
    modalDesc: $("#productModalDesc"),
    modalPrice: $("#productModalPrice"),
    modalControl: $("#productModalControl"),
  };

  let openModalProductId = null;

  // ---------- Utilidades ----------
  const money = (n) =>
    new Intl.NumberFormat(CONFIG.LOCALE, {
      style: "currency",
      currency: CONFIG.CURRENCY,
      maximumFractionDigits: 0,
    }).format(n);

  function toast(msg, type = "info") {
    const node = document.createElement("div");
    node.className = `toast toast--${type}`;
    node.textContent = msg;
    el.toastHost.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    setTimeout(() => {
      node.classList.remove("is-visible");
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str = "") {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- Render: catálogo ----------
  function renderSkeleton() {
    el.grid.innerHTML = Array.from({ length: 8 })
      .map(() => `<div class="card card--skeleton" aria-hidden="true"></div>`)
      .join("");
  }

  function buildCategoryRail() {
    const dynamic = [...new Set(allProducts.map((p) => p.categoria).filter(Boolean))];
    const cats = ["Todos", ...CONFIG.CATEGORIES.filter((c) => dynamic.some((d) => d.toLowerCase() === c.toLowerCase()))];
    dynamic.forEach((c) => {
      if (!cats.some((existing) => existing.toLowerCase() === c.toLowerCase())) cats.push(c);
    });

    el.categoryRail.innerHTML = cats
      .map(
        (c, i) => `
        <button class="rail-segment ${c === activeCategory ? "is-active" : ""}"
                data-cat="${escapeHtml(c)}"
                style="--seg-i:${i}">
          ${escapeHtml(c)}
        </button>`
      )
      .join("");

    el.categoryRail.querySelectorAll(".rail-segment").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        renderCatalog();
        buildCategoryRail();
      });
    });
  }

  function getFiltered() {
    const filtered = allProducts.filter((p) => {
      if (p.oculto) return false; // el administrador lo ocultó de la tienda
      const matchesCat =
        activeCategory === "Todos" || (p.categoria || "").toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch =
        !searchTerm || (p.nombre || "").toLowerCase().includes(searchTerm) ||
        (p.descripcion || "").toLowerCase().includes(searchTerm);
      return matchesCat && matchesSearch;
    });

    // Los productos sin stock se muestran igual (no se ocultan), pero
    // siempre al final de la grilla en vez de mezclados entre los demás.
    return filtered
      .map((p, index) => ({ p, index }))
      .sort((a, b) => {
        const aOut = Number(a.p.stock) <= 0 ? 1 : 0;
        const bOut = Number(b.p.stock) <= 0 ? 1 : 0;
        return aOut - bOut || a.index - b.index;
      })
      .map((entry) => entry.p);
  }

  function cardControlHtml(p, qty, outOfStock) {
    if (outOfStock) {
      return `<button class="btn btn--add" data-add="${p.id}" disabled>Sin stock</button>`;
    }
    if (qty > 0) {
      return `
        <div class="card__qty" data-qty-for="${p.id}">
          <button class="qty-btn" data-card-decr="${p.id}" aria-label="Restar">−</button>
          <span class="card__qty-value">${qty}</span>
          <button class="qty-btn" data-card-incr="${p.id}" aria-label="Sumar" ${p.stock && qty >= Number(p.stock) ? "disabled" : ""}>+</button>
        </div>`;
    }
    return `<button class="btn btn--add" data-add="${p.id}">Agregar</button>`;
  }

  function productCard(p) {
    const outOfStock = Number(p.stock) <= 0;
    const img = p.imagen
      ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy" onerror="this.parentElement.classList.add('img-fallback')">`
      : "";
    const qty = Cart.getState().find((it) => String(it.id) === String(p.id))?.qty || 0;
    const desc = p.descripcion || "";
    const isLong = desc.length > 90;

    return `
      <article class="card ${outOfStock ? "is-out" : ""}" data-id="${p.id}">
        <button class="card__media card__media--btn" data-view="${p.id}" aria-label="Ver detalle de ${escapeHtml(p.nombre)}">
          ${img}
          ${p.destacado ? `<span class="badge badge--warp">Destacado</span>` : ""}
          ${outOfStock ? `<span class="badge badge--out">Sin stock</span>` : ""}
        </button>
        <div class="card__body">
          <p class="card__category">${escapeHtml(p.categoria || "")}</p>
          <button class="card__title card__title--btn" data-view="${p.id}">${escapeHtml(p.nombre)}</button>
          ${desc ? `<p class="card__desc">${escapeHtml(desc)}</p>` : ""}
          ${isLong ? `<button class="card__more" data-view="${p.id}">Ver más</button>` : ""}
        </div>
        <div class="card__footer">
          <span class="card__price">${money(Number(p.precio) || 0)}</span>
          <span class="card__control">${cardControlHtml(p, qty, outOfStock)}</span>
        </div>
      </article>`;
  }

  function bindCardControl(container) {
    container.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const product = allProducts.find((p) => String(p.id) === String(btn.dataset.add));
        if (!product) return;
        Cart.add(product, 1);
        toast(`${product.nombre} agregado al carrito`, "success");
        pulseCart();
      });
    });
    container.querySelectorAll("[data-card-incr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const product = allProducts.find((p) => String(p.id) === String(btn.dataset.cardIncr));
        if (!product) return;
        const current = Cart.getState().find((it) => String(it.id) === String(product.id))?.qty || 0;
        Cart.add(product, 1);
        if (current === 0) pulseCart();
      });
    });
    container.querySelectorAll("[data-card-decr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cardDecr;
        const current = Cart.getState().find((it) => String(it.id) === String(id));
        if (!current) return;
        Cart.setQty(id, current.qty - 1);
      });
    });
  }

  // Sincroniza solo el control de cantidad de cada tarjeta visible,
  // sin re-renderizar toda la grilla (evita parpadeos y pérdida de scroll).
  function syncCardControls() {
    el.grid.querySelectorAll(".card[data-id]").forEach((card) => {
      const id = card.dataset.id;
      const product = allProducts.find((p) => String(p.id) === String(id));
      if (!product) return;
      const outOfStock = Number(product.stock) <= 0;
      const qty = Cart.getState().find((it) => String(it.id) === String(id))?.qty || 0;
      const controlSlot = card.querySelector(".card__control");
      if (!controlSlot) return;
      controlSlot.innerHTML = cardControlHtml(product, qty, outOfStock);
      bindCardControl(controlSlot);
    });

    if (openModalProductId) {
      const product = allProducts.find((p) => String(p.id) === String(openModalProductId));
      if (product) {
        const outOfStock = Number(product.stock) <= 0;
        const qty = Cart.getState().find((it) => String(it.id) === String(product.id))?.qty || 0;
        el.modalControl.innerHTML = cardControlHtml(product, qty, outOfStock);
        bindCardControl(el.modalControl);
      }
    }
  }

  // ---------- Modal de detalle del producto ----------
  function openProductModal(id) {
    const p = allProducts.find((x) => String(x.id) === String(id));
    if (!p) return;
    openModalProductId = id;
    const outOfStock = Number(p.stock) <= 0;
    const qty = Cart.getState().find((it) => String(it.id) === String(p.id))?.qty || 0;

    el.modalMedia.innerHTML = p.imagen
      ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}">`
      : `<div class="card__media img-fallback"></div>`;
    if (p.destacado) el.modalMedia.insertAdjacentHTML("beforeend", `<span class="badge badge--warp">Destacado</span>`);
    if (outOfStock) el.modalMedia.insertAdjacentHTML("beforeend", `<span class="badge badge--out">Sin stock</span>`);

    el.modalCategory.textContent = p.categoria || "";
    el.modalTitle.textContent = p.nombre;
    el.modalDesc.textContent = p.descripcion || "Sin descripción adicional.";
    el.modalPrice.textContent = money(Number(p.precio) || 0);
    el.modalControl.innerHTML = cardControlHtml(p, qty, outOfStock);
    bindCardControl(el.modalControl);

    el.modalOverlay.classList.add("is-open");
    el.modal.classList.add("is-open");
    el.modal.setAttribute("aria-hidden", "false");
  }

  function closeProductModal() {
    openModalProductId = null;
    el.modalOverlay.classList.remove("is-open");
    el.modal.classList.remove("is-open");
    el.modal.setAttribute("aria-hidden", "true");
  }

  function bindCardViewButtons(container) {
    container.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => openProductModal(btn.dataset.view));
    });
  }

  function renderCatalog() {
    const filtered = getFiltered();
    el.resultsCount.textContent = `${filtered.length} producto${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
      el.grid.innerHTML = `
        <div class="empty-state">
          <p>No encontramos productos con esos filtros.</p>
          <button class="btn btn--ghost" id="resetFilters">Ver todo el catálogo</button>
        </div>`;
      $("#resetFilters")?.addEventListener("click", () => {
        activeCategory = "Todos";
        searchTerm = "";
        el.searchInput.value = "";
        buildCategoryRail();
        renderCatalog();
      });
      return;
    }

    el.grid.innerHTML = filtered.map(productCard).join("");
    bindCardControl(el.grid);
    bindCardViewButtons(el.grid);
  }

  function pulseCart() {
    el.cartToggle.classList.remove("pulse");
    void el.cartToggle.offsetWidth; // reinicia la animación
    el.cartToggle.classList.add("pulse");
  }

  // ---------- Render: carrito ----------
  function renderCart() {
    const items = Cart.getState();
    el.cartCount.textContent = Cart.getCount();
    el.cartCount.classList.toggle("is-hidden", Cart.getCount() === 0);

    if (!items.length) {
      el.cartItems.innerHTML = "";
      el.cartEmpty.classList.remove("is-hidden");
      el.checkoutBtn.disabled = true;
    } else {
      el.cartEmpty.classList.add("is-hidden");
      el.checkoutBtn.disabled = false;
      el.cartItems.innerHTML = items
        .map(
          (it) => `
          <li class="cart-item" data-id="${it.id}">
            <div class="cart-item__info">
              <p class="cart-item__name">${escapeHtml(it.nombre)}</p>
              <p class="cart-item__price">${money(it.precio)} c/u</p>
            </div>
            <div class="cart-item__qty">
              <button class="qty-btn" data-decr="${it.id}" aria-label="Restar">−</button>
              <span>${it.qty}</span>
              <button class="qty-btn" data-incr="${it.id}" aria-label="Sumar">+</button>
            </div>
            <button class="cart-item__remove" data-remove="${it.id}" aria-label="Quitar">✕</button>
          </li>`
        )
        .join("");
    }

    el.cartTotal.textContent = money(Cart.getTotal());

    el.cartItems.querySelectorAll("[data-incr]").forEach((b) =>
      b.addEventListener("click", () => {
        const it = items.find((x) => String(x.id) === b.dataset.incr);
        Cart.setQty(it.id, it.qty + 1);
      })
    );
    el.cartItems.querySelectorAll("[data-decr]").forEach((b) =>
      b.addEventListener("click", () => {
        const it = items.find((x) => String(x.id) === b.dataset.decr);
        Cart.setQty(it.id, it.qty - 1);
      })
    );
    el.cartItems.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => Cart.remove(b.dataset.remove))
    );
  }

  // ---------- Carrito: abrir/cerrar ----------
  function openCart() {
    el.cartDrawer.classList.add("is-open");
    el.cartOverlay.classList.add("is-open");
    el.cartDrawer.setAttribute("aria-hidden", "false");
  }
  function closeCart() {
    el.cartDrawer.classList.remove("is-open");
    el.cartOverlay.classList.remove("is-open");
    el.cartDrawer.setAttribute("aria-hidden", "true");
  }

  // ---------- Checkout por WhatsApp ----------
  function buildWhatsAppMessage() {
    const items = Cart.getState();
    const lines = items.map(
      (it) => `• ${it.qty} x ${it.nombre} — ${money(it.precio)} c/u = ${money(it.qty * it.precio)}`
    );
    const stardate = new Date().toLocaleString(CONFIG.LOCALE, {
      dateStyle: "short",
      timeStyle: "short",
    });

    return [
      `🛰️ *Nuevo pedido — ${CONFIG.STORE_NAME}*`,
      `Fecha: ${stardate}`,
      "",
      ...lines,
      "",
      `*Total: ${money(Cart.getTotal())}*`,
      "",
      "Nombre y dirección de entrega:",
    ].join("\n");
  }

  function checkout() {
    if (!Cart.getCount()) return;
    const items = Cart.getState();
    const total = Cart.getTotal();
    const text = encodeURIComponent(buildWhatsAppMessage());
    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`;
    window.open(url, "_blank", "noopener");

    // Registro del pedido en la hoja "Ventas" (para el control de ganancias).
    // No bloquea ni retrasa la apertura de WhatsApp: si falla, el pedido
    // igual llega al vendedor por WhatsApp, solo no queda en el registro.
    Api.send(
      "registrar_pedido",
      {
        items: items.map((it) => ({
          id: it.id,
          nombre: it.nombre,
          cantidad: it.qty,
          precio: it.precio,
          costo: it.costo || 0,
        })),
        total,
      },
      null
    ).catch((err) => console.warn("No se pudo registrar el pedido:", err.message));
  }

  // ---------- Acceso oculto al panel admin (3 toques en el nombre) ----------
  function setupHiddenAdminAccess() {
    el.storeName.addEventListener("click", () => {
      tapCount += 1;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => (tapCount = 0), 900);
      if (tapCount >= 3) {
        tapCount = 0;
        window.location.href = "admin.html";
      }
    });
  }

  // ---------- Carga de datos ----------
  async function loadProducts(force = false) {
    try {
      allProducts = await Api.getProducts(force);
      buildCategoryRail();
      renderCatalog();
    } catch (err) {
      el.grid.innerHTML = `
        <div class="empty-state empty-state--error">
          <p>No pudimos cargar el catálogo. ${err.message.includes("API_URL") ? "El sitio todavía no está conectado a la base de datos." : "Probá de nuevo en un momento."}</p>
          <button class="btn btn--ghost" id="retryLoad">Reintentar</button>
        </div>`;
      $("#retryLoad")?.addEventListener("click", () => {
        renderSkeleton();
        loadProducts(true);
      });
    }
  }

  // ---------- Init ----------
  function init() {
    el.storeName.textContent = CONFIG.STORE_NAME;
    el.tagline.textContent = CONFIG.TAGLINE;
    document.title = CONFIG.STORE_NAME;
    el.year.textContent = new Date().getFullYear();
    if (CONFIG.SHOW_SHIPPING_NOTE) {
      el.shippingNote.textContent = CONFIG.SHIPPING_NOTE;
      el.shippingNote.classList.remove("is-hidden");
    }

    renderSkeleton();
    setupHiddenAdminAccess();

    let searchDebounce;
    el.searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const value = e.target.value;
      searchDebounce = setTimeout(() => {
        searchTerm = value.trim().toLowerCase();
        renderCatalog();
      }, 180);
    });

    el.cartToggle.addEventListener("click", openCart);
    el.cartClose.addEventListener("click", closeCart);
    el.cartOverlay.addEventListener("click", closeCart);
    el.checkoutBtn.addEventListener("click", checkout);
    el.modalClose.addEventListener("click", closeProductModal);
    el.modalOverlay.addEventListener("click", closeProductModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCart();
        closeProductModal();
      }
    });

    Cart.onChange(() => {
      renderCart();
      syncCardControls();
    });
    renderCart();

    if (CONFIG.WHATSAPP_NUMBER) {
      const text = encodeURIComponent(`Hola ${CONFIG.STORE_NAME}, quería hacerles una consulta.`);
      el.fabWhatsapp.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`;
    }

    loadProducts();
    setInterval(() => loadProducts(true), CONFIG.REFRESH_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
