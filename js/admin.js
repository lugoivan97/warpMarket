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
    recalcularBtn: $("#recalcularBtn"),
    recalcularMsg: $("#recalcularMsg"),

    gastoForm: $("#gastoForm"),
    gConcepto: $("#g-concepto"),
    gMonto: $("#g-monto"),
    gCategoria: $("#g-categoria"),
    saveGastoBtn: $("#saveGastoBtn"),
    gastoMsg: $("#gastoMsg"),
    gastosStats: $("#gastosStats"),
    gastosTbody: $("#gastosTbody"),
    gastosEmpty: $("#gastosEmpty"),

    compraForm: $("#compraForm"),
    coProducto: $("#co-producto"),
    coProveedor: $("#co-proveedor"),
    coCantidad: $("#co-cantidad"),
    coCostoUnitario: $("#co-costo-unitario"),
    compraTotalHint: $("#compraTotalHint"),
    coNotas: $("#co-notas"),
    saveCompraBtn: $("#saveCompraBtn"),
    compraMsg: $("#compraMsg"),
    comprasStats: $("#comprasStats"),
    comprasTbody: $("#comprasTbody"),
    comprasEmpty: $("#comprasEmpty"),

    generarSnapshotBtn: $("#generarSnapshotBtn"),
    historialMsg: $("#historialMsg"),
    historialChart: $("#historialChart"),
    historialTbody: $("#historialTbody"),
    historialEmpty: $("#historialEmpty"),

    probarAlertaBtn: $("#probarAlertaBtn"),
    alertasMsg: $("#alertasMsg"),
    alertasTbody: $("#alertasTbody"),
    alertasEmpty: $("#alertasEmpty"),

    toastHost: $("#toastHost"),
  };

  let gastos = [];
  let compras = [];
  let historial = [];
  let historialChartInstance = null;

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
        if (tab.dataset.tab === "ventas" || tab.dataset.tab === "gastos") refreshFinancials();
        if (tab.dataset.tab === "compras") loadCompras();
        if (tab.dataset.tab === "historial") loadHistorial();
        if (tab.dataset.tab === "alertas") loadAlertas();
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
      if (ventas.length || gastos.length) renderVentasStats(); // el reparto también depende del split
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
        <tr data-id="${p.id}" class="${p.oculto ? "row-hidden" : ""}">
          <td class="cell-name">${p.nombre}</td>
          <td>${p.categoria || "—"}</td>
          <td>${costo > 0 ? money(costo) : "—"}</td>
          <td>${money(precio)}</td>
          <td>${margen}</td>
          <td class="${stockClass}">${stock}</td>
          <td>${p.destacado ? "Sí" : "—"}</td>
          <td>
            <button class="visibility-btn ${p.oculto ? "is-hidden-state" : ""}" data-toggle-visible="${p.id}">
              ${p.oculto ? "Oculto" : "Visible"}
            </button>
          </td>
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
    el.productsTbody.querySelectorAll("[data-toggle-visible]").forEach((b) =>
      b.addEventListener("click", () => toggleVisibility(b.dataset.toggleVisible))
    );
  }

  async function toggleVisibility(id) {
    try {
      const result = await Api.send("toggle_visibilidad", { id }, getToken());
      const p = products.find((x) => String(x.id) === String(id));
      if (p) p.oculto = result.oculto;
      renderTable();
      toast(result.oculto ? "Producto ocultado de la tienda." : "Producto visible en la tienda.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
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
  async function refreshFinancials() {
    await Promise.all([loadVentas(false), loadGastos(false)]);
    renderVentasStats();
    renderGastosStats();
  }

  async function loadVentas(renderAfter = true) {
    if (renderAfter) el.ventasTbody.innerHTML = `<tr><td colspan="6">Cargando…</td></tr>`;
    try {
      ventas = await Api.send("ventas_listar", {}, getToken());
      if (renderAfter) {
        renderVentasStats();
        renderVentasTable();
      }
    } catch (err) {
      toast(err.message, "error");
      if (renderAfter) el.ventasTbody.innerHTML = "";
    }
  }

  function renderVentasStats() {
    const confirmadas = ventas.filter((v) => v.estado === "Confirmado");
    const total = confirmadas.reduce((s, v) => s + v.total, 0);
    const gananciaBruta = confirmadas.reduce((s, v) => s + v.gananciatotal, 0);
    const totalGastos = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const gananciaNeta = gananciaBruta - totalGastos;
    const propio = gananciaNeta * (adminConfig.splitPropio / 100);
    const socio = gananciaNeta - propio;
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
        <p class="stat-card__label">Ganancia bruta</p>
        <p class="stat-card__value">${money(gananciaBruta)}</p>
      </div>
      <div class="stat-card ${totalGastos ? "stat-card--danger" : ""}">
        <p class="stat-card__label">Gastos</p>
        <p class="stat-card__value">${money(totalGastos)}</p>
      </div>
      <div class="stat-card stat-card--success">
        <p class="stat-card__label">Ganancia neta</p>
        <p class="stat-card__value">${money(gananciaNeta)}</p>
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
      loadProducts(); // el stock puede haberse restaurado/descontado según el nuevo estado
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

  // ---------- Gastos ----------
  async function loadGastos(renderAfter = true) {
    try {
      gastos = await Api.send("gastos_listar", {}, getToken());
      if (renderAfter) {
        renderGastosStats();
        renderGastosTable();
      }
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function renderGastosStats() {
    const total = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    el.gastosStats.innerHTML = `
      <div class="stat-card">
        <p class="stat-card__label">Gastos registrados</p>
        <p class="stat-card__value">${gastos.length}</p>
      </div>
      <div class="stat-card stat-card--danger">
        <p class="stat-card__label">Total gastado</p>
        <p class="stat-card__value">${money(total)}</p>
      </div>`;
  }

  function renderGastosTable() {
    el.gastosEmpty.classList.toggle("is-hidden", gastos.length > 0);
    el.gastosTbody.innerHTML = gastos
      .map((g) => {
        const fecha = g.fecha ? new Date(g.fecha).toLocaleDateString(CONFIG.LOCALE) : "—";
        return `
        <tr data-id="${g.id}">
          <td>${fecha}</td>
          <td class="cell-name">${g.concepto || "—"}</td>
          <td>${g.categoria || "General"}</td>
          <td>${money(g.monto)}</td>
          <td><div class="row-actions"><button class="delete-btn" data-delete-gasto="${g.id}">Eliminar</button></div></td>
        </tr>`;
      })
      .join("");
    el.gastosTbody.querySelectorAll("[data-delete-gasto]").forEach((b) =>
      b.addEventListener("click", () => deleteGasto(b.dataset.deleteGasto))
    );
  }

  async function handleGastoSubmit(e) {
    e.preventDefault();
    el.saveGastoBtn.disabled = true;
    try {
      await Api.send(
        "gastos_crear",
        { concepto: el.gConcepto.value.trim(), monto: Number(el.gMonto.value), categoria: el.gCategoria.value.trim() || "General" },
        getToken()
      );
      showMsg(el.gastoMsg, "Gasto agregado.", "success");
      el.gastoForm.reset();
      await loadGastos();
      renderVentasStats(); // el resumen de Ventas también depende de los gastos
    } catch (err) {
      showMsg(el.gastoMsg, err.message, "error");
    } finally {
      el.saveGastoBtn.disabled = false;
    }
  }

  async function deleteGasto(id) {
    if (!confirm("¿Eliminar este gasto?")) return;
    try {
      await Api.send("gastos_eliminar", { id }, getToken());
      toast("Gasto eliminado.", "success");
      await loadGastos();
      renderVentasStats();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Compras / reposición ----------
  function updateCompraTotalHint() {
    const cantidad = Number(el.coCantidad.value) || 0;
    const costoUnitario = Number(el.coCostoUnitario.value) || 0;
    el.compraTotalHint.textContent = cantidad && costoUnitario
      ? `Total de esta compra: ${money(cantidad * costoUnitario)}`
      : "Completá cantidad y costo unitario para ver el total.";
  }

  async function loadCompras() {
    try {
      compras = await Api.send("compras_listar", {}, getToken());
      renderComprasStats();
      renderComprasTable();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function renderComprasStats() {
    const totalHistorico = compras.reduce((s, c) => s + c.costototal, 0);
    const ultimos30 = compras
      .filter((c) => c.fecha && new Date(c.fecha) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .reduce((s, c) => s + c.costototal, 0);
    el.comprasStats.innerHTML = `
      <div class="stat-card">
        <p class="stat-card__label">Compras registradas</p>
        <p class="stat-card__value">${compras.length}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Invertido últimos 30 días</p>
        <p class="stat-card__value">${money(ultimos30)}</p>
      </div>
      <div class="stat-card stat-card--danger">
        <p class="stat-card__label">Invertido histórico total</p>
        <p class="stat-card__value">${money(totalHistorico)}</p>
      </div>`;
  }

  function renderComprasTable() {
    el.comprasEmpty.classList.toggle("is-hidden", compras.length > 0);
    el.comprasTbody.innerHTML = compras
      .map((c) => {
        const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString(CONFIG.LOCALE) : "—";
        return `
        <tr data-id="${c.id}">
          <td>${fecha}</td>
          <td class="cell-name">${c.producto || "—"}</td>
          <td>${c.cantidad}</td>
          <td>${money(c.costounitario)}</td>
          <td>${money(c.costototal)}</td>
          <td>${c.proveedor || "—"}</td>
          <td><div class="row-actions"><button class="delete-btn" data-delete-compra="${c.id}">Eliminar</button></div></td>
        </tr>`;
      })
      .join("");
    el.comprasTbody.querySelectorAll("[data-delete-compra]").forEach((b) =>
      b.addEventListener("click", () => deleteCompra(b.dataset.deleteCompra))
    );
  }

  async function handleCompraSubmit(e) {
    e.preventDefault();
    el.saveCompraBtn.disabled = true;
    try {
      await Api.send(
        "compras_crear",
        {
          producto: el.coProducto.value.trim(),
          cantidad: Number(el.coCantidad.value),
          costoUnitario: Number(el.coCostoUnitario.value),
          proveedor: el.coProveedor.value.trim(),
          notas: el.coNotas.value.trim(),
        },
        getToken()
      );
      showMsg(el.compraMsg, "Compra registrada.", "success");
      el.compraForm.reset();
      updateCompraTotalHint();
      await loadCompras();
    } catch (err) {
      showMsg(el.compraMsg, err.message, "error");
    } finally {
      el.saveCompraBtn.disabled = false;
    }
  }

  async function deleteCompra(id) {
    if (!confirm("¿Eliminar este registro de compra?")) return;
    try {
      await Api.send("compras_eliminar", { id }, getToken());
      toast("Compra eliminada.", "success");
      await loadCompras();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Historial semanal ----------
  async function loadHistorial() {
    try {
      historial = await Api.send("historial_listar", {}, getToken());
      renderHistorialTable();
      renderHistorialChart();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function renderHistorialTable() {
    el.historialEmpty.classList.toggle("is-hidden", historial.length > 0);
    el.historialTbody.innerHTML = [...historial]
      .reverse()
      .map((h) => {
        const fecha = h.fecha ? new Date(h.fecha).toLocaleDateString(CONFIG.LOCALE) : "—";
        return `
        <tr>
          <td>${fecha}</td>
          <td>${money(h.ventastotal)}</td>
          <td>${money(h.gananciabruta)}</td>
          <td>${money(h.gastostotal)}</td>
          <td>${money(h.ganancianeta)}</td>
          <td>${money(h.capitalinventario)}</td>
          <td>${money(h.comprastotal)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderHistorialChart() {
    if (typeof Chart === "undefined" || !el.historialChart) return;
    const labels = historial.map((h) => (h.fecha ? new Date(h.fecha).toLocaleDateString(CONFIG.LOCALE) : "—"));
    const ventasData = historial.map((h) => h.ventastotal);
    const gananciaData = historial.map((h) => h.ganancianeta);

    if (historialChartInstance) historialChartInstance.destroy();
    historialChartInstance = new Chart(el.historialChart.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Ventas", data: ventasData, borderColor: "#3399cc", backgroundColor: "rgba(51,153,204,0.15)", tension: 0.25, fill: true },
          { label: "Ganancia neta", data: gananciaData, borderColor: "#33cc99", backgroundColor: "rgba(51,204,153,0.15)", tension: 0.25, fill: true },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#8fa0b5", font: { family: "IBM Plex Mono" } } } },
        scales: {
          x: { ticks: { color: "#52637a" }, grid: { color: "#232d42" } },
          y: { ticks: { color: "#52637a" }, grid: { color: "#232d42" } },
        },
      },
    });
  }

  async function handleGenerarSnapshot() {
    el.generarSnapshotBtn.disabled = true;
    el.generarSnapshotBtn.textContent = "Generando…";
    try {
      await Api.send("historial_generar_ahora", {}, getToken());
      showMsg(el.historialMsg, "Snapshot generado con los datos de los últimos 7 días.", "success");
      await loadHistorial();
    } catch (err) {
      showMsg(el.historialMsg, err.message, "error");
    } finally {
      el.generarSnapshotBtn.disabled = false;
      el.generarSnapshotBtn.textContent = "Generar snapshot ahora";
    }
  }

  // ---------- Alertas de stock bajo ----------
  async function loadAlertas() {
    try {
      const productos = await Api.send("alertas_listar", {}, getToken());
      renderAlertasTable(productos);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function renderAlertasTable(productos) {
    el.alertasEmpty.classList.toggle("is-hidden", productos.length > 0);
    el.alertasTbody.innerHTML = productos
      .map((p) => `<tr><td class="cell-name">${p.nombre}</td><td class="${p.stock === 0 ? "stock-zero" : "stock-low"}">${p.stock}</td></tr>`)
      .join("");
  }

  async function handleProbarAlerta() {
    el.probarAlertaBtn.disabled = true;
    try {
      const result = await Api.send("alertas_probar", {}, getToken());
      renderAlertasTable(result.productos);
      showMsg(
        el.alertasMsg,
        result.enviado ? `Mail enviado — ${result.productos.length} producto(s) con stock bajo.` : "No hay productos con stock bajo, no se envió nada.",
        result.enviado ? "success" : "success"
      );
    } catch (err) {
      showMsg(el.alertasMsg, err.message, "error");
    } finally {
      el.probarAlertaBtn.disabled = false;
    }
  }

  // ---------- Recalcular precios masivo ----------
  async function handleRecalcular() {
    if (!confirm(`Esto va a actualizar el precio de venta de todos los productos con costo cargado, usando el margen actual (${adminConfig.margen}%). ¿Continuar?`)) return;
    el.recalcularBtn.disabled = true;
    el.recalcularBtn.textContent = "Recalculando…";
    try {
      const result = await Api.send("recalcular_precios", {}, getToken());
      showMsg(el.recalcularMsg, `Se actualizaron ${result.actualizados} productos.`, "success");
      toast("Precios recalculados.", "success");
      loadProducts();
    } catch (err) {
      showMsg(el.recalcularMsg, err.message, "error");
    } finally {
      el.recalcularBtn.disabled = false;
      el.recalcularBtn.textContent = "Recalcular todos los precios ahora";
    }
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
    el.refreshVentasBtn.addEventListener("click", () => refreshFinancials().then(renderVentasTable));
    el.exportVentasBtn.addEventListener("click", exportVentasCsv);

    el.gastoForm.addEventListener("submit", handleGastoSubmit);

    el.compraForm.addEventListener("submit", handleCompraSubmit);
    el.coCantidad.addEventListener("input", updateCompraTotalHint);
    el.coCostoUnitario.addEventListener("input", updateCompraTotalHint);

    el.generarSnapshotBtn.addEventListener("click", handleGenerarSnapshot);
    el.probarAlertaBtn.addEventListener("click", handleProbarAlerta);

    el.configForm.addEventListener("submit", handleConfigSubmit);
    el.cSplit.addEventListener("input", updateSplitHint);
    el.recalcularBtn.addEventListener("click", handleRecalcular);

    // Si ya había una sesión activa (misma pestaña), entra directo.
    if (getToken()) enterPanel();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
