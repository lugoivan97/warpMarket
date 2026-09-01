/**
 * WARP MARKET — Panel de administración
 */

(() => {
  "use strict";

  const TOKEN_KEY = "wm_admin_token";
  let products = [];
  let ventas = [];
  let bulkRows = [];
  let adminConfig = { margen: 50, splitPropio: 50 };
  let precioEditadoManualmente = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    loginScreen: $("#loginScreen"),
    loginForm: $("#loginForm"),
    passwordInput: $("#passwordInput"),
    loginBtn: $("#loginBtn"),
    loginError: $("#loginError"),
    adminShell: $("#adminShell"),
    logoutBtn: $("#logoutBtn"),
    tabs: $$(".admin-tab"),
    panels: $$("[data-tab-panel]"),

    productStats: $("#productStats"),
    adminSearch: $("#adminSearch"),
    refreshBtn: $("#refreshBtn"),
    productsTbody: $("#productsTbody"),
    productsEmpty: $("#productsEmpty"),

    productForm: $("#productForm"),
    productId: $("#productId"),
    formTitle: $("#formTitle"),
    fNombre: $("#f-nombre"),
    fCategoria: $("#f-categoria"),
    categoriaOptions: $("#categoriaOptions"),
    fCosto: $("#f-costo"),
    fPrecio: $("#f-precio"),
    marginHint: $("#marginHint"),
    fStock: $("#f-stock"),
    fImagen: $("#f-imagen"),
    fDescripcion: $("#f-descripcion"),
    fDestacado: $("#f-destacado"),
    cancelEditBtn: $("#cancelEditBtn"),
    saveProductBtn: $("#saveProductBtn"),
    formMsg: $("#formMsg"),

    downloadTemplateBtn: $("#downloadTemplateBtn"),
    dropzone: $("#dropzone"),
    fileInput: $("#fileInput"),
    bulkPreview: $("#bulkPreview"),
    bulkCount: $("#bulkCount"),
    bulkTbody: $("#bulkTbody"),
    cancelBulkBtn: $("#cancelBulkBtn"),
    confirmBulkBtn: $("#confirmBulkBtn"),
    bulkMsg: $("#bulkMsg"),

    ventasStats: $("#ventasStats"),
    ventasFiltro: $("#ventasFiltro"),
    refreshVentasBtn: $("#refreshVentasBtn"),
    exportVentasBtn: $("#exportVentasBtn"),
    ventasTbody: $("#ventasTbody"),
    ventasEmpty: $("#ventasEmpty"),

    configForm: $("#configForm"),
    cMargen: $("#c-margen"),
    cSplit: $("#c-split"),
    splitHint: $("#splitHint"),
    saveConfigBtn: $("#saveConfigBtn"),
    configMsg: $("#configMsg"),

    toastHost: $("#toastHost"),
  };

  const money = (n) =>
    new Intl.NumberFormat(CONFIG.LOCALE, { style: "currency", currency: CONFIG.CURRENCY, maximumFractionDigits: 0 }).format(n);

  const roundUpTo100 = (n) => Math.ceil((Number(n) || 0) / 100) * 100;
  const suggestedPrice = (costo) => roundUpTo100(Number(costo) * (1 + adminConfig.margen / 100));

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

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  // ---------- Login ----------
  async function handleLogin(e) {
    e.preventDefault();
    el.loginError.classList.add("is-hidden");
    el.loginBtn.disabled = true;
    el.loginBtn.textContent = "Verificando…";

    const password = el.passwordInput.value;
    try {
      await Api.send("login", {}, password);
      sessionStorage.setItem(TOKEN_KEY, password);
      enterPanel();
    } catch (err) {
      el.loginError.textContent = err.message.includes("API_URL")
        ? "El panel todavía no está conectado a la base de datos (ver README.md)."
        : "Contraseña incorrecta.";
      el.loginError.classList.remove("is-hidden");
    } finally {
      el.loginBtn.disabled = false;
      el.loginBtn.textContent = "Ingresar";
    }
  }

  async function enterPanel() {
    el.loginScreen.classList.add("is-hidden");
    el.adminShell.classList.remove("is-hidden");
    await loadConfig();
    loadProducts();
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  }

  // ---------- Tabs ----------
  function setupTabs() {
    el.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        el.tabs.forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        el.panels.forEach((p) => p.classList.add("is-hidden"));
        $(`#tab-${tab.dataset.tab}`).classList.remove("is-hidden");
        if (tab.dataset.tab === "ventas" && !ventas.length) loadVentas();
      });
    });
  }

  // ---------- Configuración (margen / reparto) ----------
  async function loadConfig() {
    try {
      adminConfig = await Api.send("config_obtener", {}, getToken());
      el.cMargen.value = adminConfig.margen;
      el.cSplit.value = adminConfig.splitPropio;
      updateSplitHint();
    } catch (err) {
      toast(`No se pudo cargar la configuración: ${err.message}`, "error");
    }
  }

  function updateSplitHint() {
    const propio = Number(el.cSplit.value) || 0;
    el.splitHint.textContent = `Con este valor: vos te quedás con ${propio}% de la ganancia y tu socio con ${100 - propio}%.`;
  }

  async function handleConfigSubmit(e) {
    e.preventDefault();
    el.saveConfigBtn.disabled = true;
    try {
      adminConfig = await Api.send(
        "config_actualizar",
        { margen: Number(el.cMargen.value), splitPropio: Number(el.cSplit.value) },
        getToken()
      );
      showMsg(el.configMsg, "Configuración guardada.", "success");
      renderTable(); // recalcula la columna "Margen" con el nuevo valor
    } catch (err) {
      showMsg(el.configMsg, err.message, "error");
    } finally {
      el.saveConfigBtn.disabled = false;
    }
  }

  // ---------- Listado de productos ----------
  async function loadProducts() {
    try {
      products = await Api.getProducts(true);
      populateCategoryOptions();
      renderStats();
      renderTable();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function renderStats() {
    const sinStock = products.filter((p) => Number(p.stock) <= 0).length;
    const valorInventarioCosto = products.reduce((sum, p) => sum + (Number(p.costo) || 0) * (Number(p.stock) || 0), 0);
    el.productStats.innerHTML = `
      <div class="stat-card">
        <p class="stat-card__label">Productos</p>
        <p class="stat-card__value">${products.length}</p>
      </div>
      <div class="stat-card ${sinStock ? "stat-card--danger" : ""}">
        <p class="stat-card__label">Sin stock</p>
        <p class="stat-card__value">${sinStock}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Valor de inventario (costo)</p>
        <p class="stat-card__value">${money(valorInventarioCosto)}</p>
      </div>`;
  }

  function populateCategoryOptions() {
    const cats = new Set([...CONFIG.CATEGORIES, ...products.map((p) => p.categoria).filter(Boolean)]);
    el.categoriaOptions.innerHTML = [...cats].map((c) => `<option value="${c}"></option>`).join("");
  }

  function renderTable() {
    const term = (el.adminSearch.value || "").toLowerCase().trim();
    const filtered = products.filter((p) => !term || (p.nombre || "").toLowerCase().includes(term));

    el.productsEmpty.classList.toggle("is-hidden", filtered.length > 0);

    el.productsTbody.innerHTML = filtered
      .map((p) => {
        const stock = Number(p.stock) || 0;
        const costo = Number(p.costo) || 0;
        const precio = Number(p.precio) || 0;
        const stockClass = stock === 0 ? "stock-zero" : stock <= 5 ? "stock-low" : "";
        const margen = costo > 0 ? `${(((precio - costo) / costo) * 100).toFixed(0)}%` : "—";
        return `
        <tr data-id="${p.id}">
          <td class="cell-name">${p.nombre}</td>
          <td>${p.categoria || "—"}</td>
          <td>${costo > 0 ? money(costo) : "—"}</td>
          <td>${money(precio)}</td>
          <td>${margen}</td>
          <td class="${stockClass}">${stock}</td>
          <td>${p.destacado ? "Sí" : "—"}</td>
          <td>
            <div class="row-actions">
              <button class="edit-btn" data-edit="${p.id}">Editar</button>
              <button class="delete-btn" data-delete="${p.id}">Eliminar</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    el.productsTbody.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => startEdit(b.dataset.edit))
    );
    el.productsTbody.querySelectorAll("[data-delete]").forEach((b) =>
      b.addEventListener("click", () => deleteProduct(b.dataset.delete))
    );
  }

  // ---------- Alta / edición ----------
  function updateMarginHint() {
    const costo = Number(el.fCosto.value) || 0;
    if (costo > 0) {
      el.marginHint.textContent = `Con costo ${money(costo)} y margen del ${adminConfig.margen}%, el precio sugerido es ${money(suggestedPrice(costo))}.`;
    } else {
      el.marginHint.textContent = "Cargá el costo y el precio se sugiere solo (siempre lo podés cambiar a mano).";
    }
  }

  function startEdit(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    precioEditadoManualmente = true; // no pisar el precio ya guardado al abrir para editar
    el.productId.value = p.id;
    el.fNombre.value = p.nombre || "";
    el.fCategoria.value = p.categoria || "";
    el.fCosto.value = p.costo || "";
    el.fPrecio.value = p.precio || "";
    el.fStock.value = p.stock || 0;
    el.fImagen.value = p.imagen || "";
    el.fDescripcion.value = p.descripcion || "";
    el.fDestacado.checked = !!p.destacado;
    el.formTitle.textContent = `Editando: ${p.nombre}`;
    updateMarginHint();
    document.querySelector('[data-tab="nuevo"]').click();
  }

  function resetForm() {
    el.productForm.reset();
    el.productId.value = "";
    el.formTitle.textContent = "Nuevo producto";
    precioEditadoManualmente = false;
    updateMarginHint();
  }

  async function handleProductSubmit(e) {
    e.preventDefault();
    const payload = {
      id: el.productId.value || undefined,
      nombre: el.fNombre.value.trim(),
      categoria: el.fCategoria.value.trim(),
      costo: Number(el.fCosto.value) || 0,
      precio: Number(el.fPrecio.value),
      stock: Number(el.fStock.value),
      imagen: el.fImagen.value.trim(),
      descripcion: el.fDescripcion.value.trim(),
      destacado: el.fDestacado.checked,
    };

    el.saveProductBtn.disabled = true;
    el.saveProductBtn.textContent = "Guardando…";
    try {
      const action = payload.id ? "editar" : "crear";
      await Api.send(action, payload, getToken());
      showMsg(el.formMsg, "Producto guardado correctamente.", "success");
      resetForm();
      loadProducts();
    } catch (err) {
      showMsg(el.formMsg, err.message, "error");
    } finally {
      el.saveProductBtn.disabled = false;
      el.saveProductBtn.textContent = "Guardar producto";
    }
  }

  function showMsg(node, msg, type) {
    node.textContent = msg;
    node.className = `form-msg is-${type}`;
    setTimeout(() => node.classList.add("is-hidden"), 4000);
  }

  async function deleteProduct(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await Api.send("eliminar", { id }, getToken());
      toast("Producto eliminado.", "success");
      loadProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Carga masiva (CSV) ----------
  const REQUIRED_HEADERS = ["nombre", "categoria", "stock"];
  const OPTIONAL_HEADERS = ["precio", "imagen", "descripcion", "destacado", "costo"];

  function parseCsv(text) {
    // Parser CSV simple con soporte de comillas y comas dentro de campos citados.
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((f) => f.trim() !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
    return rows;
  }

  function rowsToProducts(rows) {
    if (!rows.length) throw new Error("El archivo está vacío.");
    const headers = rows[0].map((h) => h.trim().toLowerCase());

    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}`);

    return rows.slice(1).map((r, idx) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
      if (!obj.nombre) throw new Error(`Fila ${idx + 2}: falta el nombre.`);

      const costo = Number(obj.costo) || 0;
      const precio = obj.precio ? Number(obj.precio) || 0 : costo > 0 ? suggestedPrice(costo) : 0;

      return {
        nombre: obj.nombre,
        categoria: obj.categoria || "Sin categoría",
        costo,
        precio,
        stock: Number(obj.stock) || 0,
        imagen: obj.imagen || "",
        descripcion: obj.descripcion || "",
        destacado: ["true", "1", "si", "sí"].includes((obj.destacado || "").toLowerCase()),
      };
    });
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(reader.result);
        bulkRows = rowsToProducts(rows);
        renderBulkPreview();
      } catch (err) {
        showMsg(el.bulkMsg, err.message, "error");
        el.bulkMsg.classList.remove("is-hidden");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function renderBulkPreview() {
    el.bulkCount.textContent = bulkRows.length;
    el.bulkTbody.innerHTML = bulkRows
      .slice(0, 50)
      .map((p) => `<tr><td>${p.nombre}</td><td>${p.categoria}</td><td>${p.costo ? money(p.costo) : "—"}</td><td>${money(p.precio)}</td><td>${p.stock}</td></tr>`)
      .join("");
    el.bulkPreview.classList.remove("is-hidden");
  }

  async function confirmBulkImport() {
    el.confirmBulkBtn.disabled = true;
    el.confirmBulkBtn.textContent = "Importando…";
    try {
      const result = await Api.send("carga_masiva", { rows: bulkRows }, getToken());
      showMsg(el.bulkMsg, `Se importaron ${result?.count ?? bulkRows.length} productos correctamente.`, "success");
      el.bulkMsg.classList.remove("is-hidden");
      toast("Carga masiva completada.", "success");
      bulkRows = [];
      el.bulkPreview.classList.add("is-hidden");
      el.fileInput.value = "";
      loadProducts();
    } catch (err) {
      showMsg(el.bulkMsg, err.message, "error");
      el.bulkMsg.classList.remove("is-hidden");
    } finally {
      el.confirmBulkBtn.disabled = false;
      el.confirmBulkBtn.textContent = "Confirmar importación";
    }
  }

  function downloadTemplate() {
    const header = ["nombre", "categoria", "stock", "precio", "costo", "imagen", "descripcion", "destacado"].join(",");
    const example = "Milanesas de soja x4,Platos Listos,25,,2200,https://ejemplo.com/img.jpg,Listas para freír,true";
    const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_warp_market.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Ventas ----------
  async function loadVentas() {
    el.ventasTbody.innerHTML = `<tr><td colspan="6">Cargando…</td></tr>`;
    try {
      ventas = await Api.send("ventas_listar", {}, getToken());
      renderVentasStats();
      renderVentasTable();
    } catch (err) {
      toast(err.message, "error");
      el.ventasTbody.innerHTML = "";
    }
  }

  function renderVentasStats() {
    const confirmadas = ventas.filter((v) => v.estado === "Confirmado");
    const total = confirmadas.reduce((s, v) => s + v.total, 0);
    const ganancia = confirmadas.reduce((s, v) => s + v.gananciatotal, 0);
    const propio = ganancia * (adminConfig.splitPropio / 100);
    const socio = ganancia - propio;
    const pendientes = ventas.filter((v) => v.estado === "Pendiente").length;

    el.ventasStats.innerHTML = `
      <div class="stat-card ${pendientes ? "stat-card--alert" : ""}">
        <p class="stat-card__label">Pedidos pendientes</p>
        <p class="stat-card__value">${pendientes}</p>
      </div>
      <div class="stat-card stat-card--success">
        <p class="stat-card__label">Vendido (confirmado)</p>
        <p class="stat-card__value">${money(total)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Ganancia total</p>
        <p class="stat-card__value">${money(ganancia)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Tu parte (${adminConfig.splitPropio}%)</p>
        <p class="stat-card__value">${money(propio)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Parte del socio (${100 - adminConfig.splitPropio}%)</p>
        <p class="stat-card__value">${money(socio)}</p>
      </div>`;
  }

  function renderVentasTable() {
    const filtro = el.ventasFiltro.value;
    const filtered = filtro === "Todos" ? ventas : ventas.filter((v) => v.estado === filtro);
    el.ventasEmpty.classList.toggle("is-hidden", filtered.length > 0);

    el.ventasTbody.innerHTML = filtered
      .map((v) => {
        const fecha = v.fecha ? new Date(v.fecha).toLocaleString(CONFIG.LOCALE, { dateStyle: "short", timeStyle: "short" }) : "—";
        const badgeClass = `estado-badge--${(v.estado || "pendiente").toLowerCase()}`;
        return `
        <tr data-id="${v.id}">
          <td>${fecha}</td>
          <td class="cell-name">${v.items || "—"}</td>
          <td>${money(v.total)}</td>
          <td>${money(v.gananciatotal)}</td>
          <td><span class="estado-badge ${badgeClass}">${v.estado}</span></td>
          <td>
            <div class="row-actions">
              ${v.estado !== "Confirmado" ? `<button data-estado="Confirmado" data-id-venta="${v.id}">Confirmar</button>` : ""}
              ${v.estado !== "Cancelado" ? `<button class="delete-btn" data-estado="Cancelado" data-id-venta="${v.id}">Cancelar</button>` : ""}
              ${v.estado !== "Pendiente" ? `<button data-estado="Pendiente" data-id-venta="${v.id}">Reabrir</button>` : ""}
            </div>
          </td>
        </tr>`;
      })
      .join("");

    el.ventasTbody.querySelectorAll("[data-estado]").forEach((b) =>
      b.addEventListener("click", () => updateVentaEstado(b.dataset.idVenta, b.dataset.estado))
    );
  }

  async function updateVentaEstado(id, estado) {
    try {
      await Api.send("ventas_actualizar_estado", { id, estado }, getToken());
      const venta = ventas.find((v) => String(v.id) === String(id));
      if (venta) venta.estado = estado;
      renderVentasStats();
      renderVentasTable();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function exportVentasCsv() {
    if (!ventas.length) {
      toast("No hay ventas para exportar.", "error");
      return;
    }
    const header = ["fecha", "items", "total", "costoTotal", "gananciaTotal", "estado"].join(",");
    const rows = ventas.map((v) =>
      [
        v.fecha ? new Date(v.fecha).toLocaleString(CONFIG.LOCALE) : "",
        `"${(v.items || "").replace(/"/g, '""')}"`,
        v.total,
        v.costototal,
        v.gananciatotal,
        v.estado,
      ].join(",")
    );
    const blob = new Blob([`${header}\n${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_warp_market_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Init ----------
  function init() {
    el.loginForm.addEventListener("submit", handleLogin);
    el.logoutBtn.addEventListener("click", logout);
    setupTabs();

    let searchDebounce;
    el.adminSearch.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(renderTable, 150);
    });
    el.refreshBtn.addEventListener("click", loadProducts);

    el.fCosto.addEventListener("input", () => {
      if (!precioEditadoManualmente) {
        const costo = Number(el.fCosto.value) || 0;
        if (costo > 0) el.fPrecio.value = suggestedPrice(costo);
      }
      updateMarginHint();
    });
    el.fPrecio.addEventListener("input", () => {
      precioEditadoManualmente = true;
    });

    el.productForm.addEventListener("submit", handleProductSubmit);
    el.cancelEditBtn.addEventListener("click", resetForm);

    el.downloadTemplateBtn.addEventListener("click", downloadTemplate);
    el.dropzone.addEventListener("click", () => el.fileInput.click());
    el.fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
    ["dragover", "dragleave", "drop"].forEach((evt) =>
      el.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        el.dropzone.classList.toggle("is-dragover", evt === "dragover");
      })
    );
    el.dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
    el.cancelBulkBtn.addEventListener("click", () => {
      bulkRows = [];
      el.bulkPreview.classList.add("is-hidden");
      el.fileInput.value = "";
    });
    el.confirmBulkBtn.addEventListener("click", confirmBulkImport);

    el.ventasFiltro.addEventListener("change", renderVentasTable);
    el.refreshVentasBtn.addEventListener("click", loadVentas);
    el.exportVentasBtn.addEventListener("click", exportVentasCsv);

    el.configForm.addEventListener("submit", handleConfigSubmit);
    el.cSplit.addEventListener("input", updateSplitHint);

    // Si ya había una sesión activa (misma pestaña), entra directo.
    if (getToken()) enterPanel();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
