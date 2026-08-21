/**
 * WARP MARKET — Panel de administración
 */

(() => {
  "use strict";

  const TOKEN_KEY = "wm_admin_token";
  let products = [];
  let bulkRows = [];

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
    fPrecio: $("#f-precio"),
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

    toastHost: $("#toastHost"),
  };

  const money = (n) =>
    new Intl.NumberFormat(CONFIG.LOCALE, { style: "currency", currency: CONFIG.CURRENCY, maximumFractionDigits: 0 }).format(n);

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

  function enterPanel() {
    el.loginScreen.classList.add("is-hidden");
    el.adminShell.classList.remove("is-hidden");
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
      });
    });
  }

  // ---------- Listado de productos ----------
  async function loadProducts() {
    try {
      products = await Api.getProducts(true);
      populateCategoryOptions();
      renderTable();
    } catch (err) {
      toast(err.message, "error");
    }
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
        const stockClass = stock === 0 ? "stock-zero" : stock <= 5 ? "stock-low" : "";
        return `
        <tr data-id="${p.id}">
          <td class="cell-name">${p.nombre}</td>
          <td>${p.categoria || "—"}</td>
          <td>${money(Number(p.precio) || 0)}</td>
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
  function startEdit(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    el.productId.value = p.id;
    el.fNombre.value = p.nombre || "";
    el.fCategoria.value = p.categoria || "";
    el.fPrecio.value = p.precio || "";
    el.fStock.value = p.stock || 0;
    el.fImagen.value = p.imagen || "";
    el.fDescripcion.value = p.descripcion || "";
    el.fDestacado.checked = !!p.destacado;
    el.formTitle.textContent = `Editando: ${p.nombre}`;
    document.querySelector('[data-tab="nuevo"]').click();
  }

  function resetForm() {
    el.productForm.reset();
    el.productId.value = "";
    el.formTitle.textContent = "Nuevo producto";
  }

  async function handleProductSubmit(e) {
    e.preventDefault();
    const payload = {
      id: el.productId.value || undefined,
      nombre: el.fNombre.value.trim(),
      categoria: el.fCategoria.value.trim(),
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
      showFormMsg("Producto guardado correctamente.", "success");
      resetForm();
      loadProducts();
    } catch (err) {
      showFormMsg(err.message, "error");
    } finally {
      el.saveProductBtn.disabled = false;
      el.saveProductBtn.textContent = "Guardar producto";
    }
  }

  function showFormMsg(msg, type) {
    el.formMsg.textContent = msg;
    el.formMsg.className = `form-msg is-${type}`;
    setTimeout(() => el.formMsg.classList.add("is-hidden"), 4000);
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
  const REQUIRED_HEADERS = ["nombre", "categoria", "precio", "stock"];
  const OPTIONAL_HEADERS = ["imagen", "descripcion", "destacado"];

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
      return {
        nombre: obj.nombre,
        categoria: obj.categoria || "Sin categoría",
        precio: Number(obj.precio) || 0,
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
        showBulkMsg(err.message, "error");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function renderBulkPreview() {
    el.bulkCount.textContent = bulkRows.length;
    el.bulkTbody.innerHTML = bulkRows
      .slice(0, 50)
      .map((p) => `<tr><td>${p.nombre}</td><td>${p.categoria}</td><td>${money(p.precio)}</td><td>${p.stock}</td></tr>`)
      .join("");
    el.bulkPreview.classList.remove("is-hidden");
  }

  function showBulkMsg(msg, type) {
    el.bulkMsg.textContent = msg;
    el.bulkMsg.className = `form-msg is-${type}`;
    el.bulkMsg.classList.remove("is-hidden");
  }

  async function confirmBulkImport() {
    el.confirmBulkBtn.disabled = true;
    el.confirmBulkBtn.textContent = "Importando…";
    try {
      const result = await Api.send("carga_masiva", { rows: bulkRows }, getToken());
      showBulkMsg(`Se importaron ${result?.count ?? bulkRows.length} productos correctamente.`, "success");
      toast("Carga masiva completada.", "success");
      bulkRows = [];
      el.bulkPreview.classList.add("is-hidden");
      el.fileInput.value = "";
      loadProducts();
    } catch (err) {
      showBulkMsg(err.message, "error");
    } finally {
      el.confirmBulkBtn.disabled = false;
      el.confirmBulkBtn.textContent = "Confirmar importación";
    }
  }

  function downloadTemplate() {
    const header = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].join(",");
    const example = "Milanesas de soja x4,Platos Listos,3200,25,https://ejemplo.com/img.jpg,Listas para freír,true";
    const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_warp_market.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Init ----------
  function init() {
    el.loginForm.addEventListener("submit", handleLogin);
    el.logoutBtn.addEventListener("click", logout);
    setupTabs();

    el.adminSearch.addEventListener("input", renderTable);
    el.refreshBtn.addEventListener("click", loadProducts);

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

    // Si ya había una sesión activa (misma pestaña), entra directo.
    if (getToken()) enterPanel();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
