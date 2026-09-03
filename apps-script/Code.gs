/**
 * WARP MARKET — Backend (Google Apps Script)
 * ------------------------------------------------------------
 * Convierte una Google Sheet en la base de datos de la tienda.
 * Instrucciones completas de instalación: ver README.md
 *
 * Hoja "Productos" (fila 1 = encabezados, se auto-completan si faltan):
 * id | nombre | categoria | precio | stock | imagen | descripcion | destacado | costo | oculto
 *
 * Hoja "Ventas" (se crea sola, registra cada pedido hecho por WhatsApp):
 * id | fecha | items | itemsJson | total | costoTotal | gananciaTotal | estado | notas
 *
 * Hoja "Gastos" (se crea sola, para llevar el control de costos operativos):
 * id | fecha | concepto | monto | categoria
 * ------------------------------------------------------------
 */

const SHEET_PRODUCTOS = "Productos";
const HEADERS_PRODUCTOS = ["id", "nombre", "categoria", "precio", "stock", "imagen", "descripcion", "destacado", "costo", "oculto"];

const SHEET_VENTAS = "Ventas";
const HEADERS_VENTAS = ["id", "fecha", "items", "itemsJson", "total", "costoTotal", "gananciaTotal", "estado", "notas"];

const SHEET_GASTOS = "Gastos";
const HEADERS_GASTOS = ["id", "fecha", "concepto", "monto", "categoria"];

const SHEET_COMPRAS = "Compras";
const HEADERS_COMPRAS = ["id", "fecha", "producto", "cantidad", "costoUnitario", "costoTotal", "proveedor", "notas"];

const SHEET_HISTORIAL = "Historial";
const HEADERS_HISTORIAL = ["fecha", "ventasTotal", "gananciaBruta", "gastosTotal", "gananciaNeta", "capitalInventario", "comprasTotal"];

const LOW_STOCK_THRESHOLD = 5; // mismo umbral que usa el panel para marcar "stock bajo"

const DEFAULT_MARGEN = 50; // % de ganancia sugerido por defecto
const DEFAULT_SPLIT = 50; // % del reparto que corresponde al dueño de la cuenta (el resto es del socio)

/**
 * IMPORTANTE: la contraseña del panel admin NO se guarda en este código.
 * Se define en Extensiones > Propiedades del proyecto > Propiedades del script
 * con la clave ADMIN_PASSWORD.
 */
function getAdminPassword_() {
  const pass = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!pass) throw new Error("El administrador todavía no configuró ADMIN_PASSWORD en el script.");
  return pass;
}

// ================= Entradas HTTP =================

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "productos") {
      return jsonOut_({ ok: true, data: listProducts_() });
    }
    return jsonOut_({ ok: false, error: "Acción no reconocida." });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    const token = body.token;
    const payload = body.payload;

    // Acciones públicas: no requieren contraseña (las usa la tienda, no el panel).
    if (action === "productos_publico") {
      return jsonOut_({ ok: true, data: listProducts_() });
    }
    if (action === "registrar_pedido") {
      return jsonOut_({ ok: true, data: registrarPedido_(payload) });
    }

    // Todas las demás acciones requieren la contraseña de administrador.
    if (token !== getAdminPassword_()) {
      return jsonOut_({ ok: false, error: "Contraseña incorrecta." });
    }

    let result;
    switch (action) {
      case "login":
        result = { authenticated: true };
        break;
      case "crear":
        result = createProduct_(payload);
        break;
      case "editar":
        result = updateProduct_(payload);
        break;
      case "eliminar":
        result = deleteProduct_(payload);
        break;
      case "carga_masiva":
        result = bulkImport_(payload);
        break;
      case "toggle_visibilidad":
        result = toggleVisibilidad_(payload);
        break;
      case "recalcular_precios":
        result = recalcularPrecios_();
        break;
      case "config_obtener":
        result = getConfig_();
        break;
      case "config_actualizar":
        result = setConfig_(payload);
        break;
      case "ventas_listar":
        result = listVentas_();
        break;
      case "ventas_actualizar_estado":
        result = updateVentaEstado_(payload);
        break;
      case "gastos_listar":
        result = listGastos_();
        break;
      case "gastos_crear":
        result = crearGasto_(payload);
        break;
      case "gastos_eliminar":
        result = eliminarGasto_(payload);
        break;
      case "compras_crear":
        result = crearCompra_(payload);
        break;
      case "compras_listar":
        result = listCompras_();
        break;
      case "compras_eliminar":
        result = eliminarCompra_(payload);
        break;
      case "historial_listar":
        result = listHistorial_();
        break;
      case "historial_generar_ahora":
        result = generarSnapshot_();
        break;
      case "alertas_probar":
        result = chequearStockBajoYAvisar_();
        break;
      case "alertas_listar":
        result = listStockBajo_();
        break;
      default:
        return jsonOut_({ ok: false, error: "Acción no reconocida." });
    }
    return jsonOut_({ ok: true, data: result });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ================= Configuración (margen y reparto) =================

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    margen: Number(props.getProperty("MARGEN_PORCENTAJE")) || DEFAULT_MARGEN,
    splitPropio: Number(props.getProperty("SPLIT_PROPIO")) || DEFAULT_SPLIT,
  };
}

function setConfig_(payload) {
  const margen = Number(payload && payload.margen);
  const split = Number(payload && payload.splitPropio);
  if (isNaN(margen) || margen < 0) throw new Error("Margen inválido.");
  if (isNaN(split) || split < 0 || split > 100) throw new Error("El reparto debe estar entre 0 y 100.");
  const props = PropertiesService.getScriptProperties();
  props.setProperty("MARGEN_PORCENTAJE", String(margen));
  props.setProperty("SPLIT_PROPIO", String(split));
  return getConfig_();
}

// ================= Acceso a hojas =================

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PRODUCTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PRODUCTOS);
    sheet.appendRow(HEADERS_PRODUCTOS);
  } else {
    ensureHeaders_(sheet, HEADERS_PRODUCTOS);
  }
  return sheet;
}

function getVentasSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_VENTAS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_VENTAS);
    sheet.appendRow(HEADERS_VENTAS);
  } else {
    ensureHeaders_(sheet, HEADERS_VENTAS);
  }
  return sheet;
}

function getGastosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_GASTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_GASTOS);
    sheet.appendRow(HEADERS_GASTOS);
  } else {
    ensureHeaders_(sheet, HEADERS_GASTOS);
  }
  return sheet;
}

function getComprasSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_COMPRAS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_COMPRAS);
    sheet.appendRow(HEADERS_COMPRAS);
  } else {
    ensureHeaders_(sheet, HEADERS_COMPRAS);
  }
  return sheet;
}

function getHistorialSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_HISTORIAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL);
    sheet.appendRow(HEADERS_HISTORIAL);
  } else {
    ensureHeaders_(sheet, HEADERS_HISTORIAL);
  }
  return sheet;
}

/**
 * Agrega, al final de la hoja, cualquier columna de "headers" que todavía no
 * exista — nunca reordena ni toca las columnas que ya están cargadas.
 * (Compara siempre en minúsculas: antes esto tenía un bug que duplicaba
 * columnas con nombres en camelCase como "costoTotal" en cada llamada.)
 */
function ensureHeaders_(sheet, headers) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim().toLowerCase());
  headers.forEach((h) => {
    const hLower = String(h).trim().toLowerCase();
    if (current.indexOf(hLower) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      current.push(hLower);
    }
  });
}

function getHeaderRow_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((h) => String(h).trim().toLowerCase());
}

function listProducts_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  const idCol = headers.indexOf("id");
  return values.slice(1)
    .filter((row) => row[idCol] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.precio = Number(obj.precio) || 0;
      obj.costo = Number(obj.costo) || 0;
      obj.stock = Number(obj.stock) || 0;
      obj.destacado = obj.destacado === true || String(obj.destacado).toLowerCase() === "true";
      obj.oculto = obj.oculto === true || String(obj.oculto).toLowerCase() === "true";
      return obj;
    });
}

function findRowById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // fila real (1-indexed, +1 por encabezado)
  }
  return -1;
}

function buildRow_(headers, data) {
  return headers.map((h) => {
    if (h === "destacado" || h === "oculto") return !!data[h];
    if (h === "precio" || h === "costo" || h === "stock") return Number(data[h]) || 0;
    return data[h] || "";
  });
}

// ================= Productos (con lock para evitar condiciones de carrera) =================

function createProduct_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    validateProduct_(p);
    const sheet = getSheet_();
    const headers = getHeaderRow_(sheet);
    const id = Utilities.getUuid();
    sheet.appendRow(buildRow_(headers, Object.assign({}, p, { id: id })));
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function updateProduct_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!p.id) throw new Error("Falta el id del producto a editar.");
    validateProduct_(p);
    const sheet = getSheet_();
    const headers = getHeaderRow_(sheet);
    const row = findRowById_(sheet, p.id);
    if (row === -1) throw new Error("El producto no existe (puede haber sido eliminado).");
    // Preserva el estado "oculto" actual si el llamador no lo manda explícitamente.
    const existing = {};
    if (!("oculto" in p)) {
      const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
      const ocultoIdx = headers.indexOf("oculto");
      if (ocultoIdx !== -1) existing.oculto = values[ocultoIdx];
    }
    sheet.getRange(row, 1, 1, headers.length).setValues([buildRow_(headers, Object.assign({}, existing, p))]);
    return { id: p.id };
  } finally {
    lock.releaseLock();
  }
}

function deleteProduct_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!p.id) throw new Error("Falta el id del producto a eliminar.");
    const sheet = getSheet_();
    const row = findRowById_(sheet, p.id);
    if (row === -1) throw new Error("El producto no existe o ya fue eliminado.");
    sheet.deleteRow(row);
    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

function bulkImport_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = payload && payload.rows;
    if (!Array.isArray(rows) || !rows.length) throw new Error("No se recibieron productos para importar.");

    const sheet = getSheet_();
    const headers = getHeaderRow_(sheet);
    const toAppend = rows.map((p) => {
      validateProduct_(p);
      return buildRow_(headers, Object.assign({}, p, { id: Utilities.getUuid() }));
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
    return { count: toAppend.length };
  } finally {
    lock.releaseLock();
  }
}

function toggleVisibilidad_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = payload && payload.id;
    if (!id) throw new Error("Falta el id del producto.");
    const sheet = getSheet_();
    const headers = getHeaderRow_(sheet);
    const row = findRowById_(sheet, id);
    if (row === -1) throw new Error("El producto no existe.");
    const col = headers.indexOf("oculto") + 1;
    const actual = sheet.getRange(row, col).getValue();
    const ocultoActual = actual === true || String(actual).toLowerCase() === "true";
    const nuevo = !ocultoActual;
    sheet.getRange(row, col).setValue(nuevo);
    return { id: id, oculto: nuevo };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Recalcula el precio de venta de TODOS los productos que tengan costo
 * cargado, usando el margen configurado actualmente. Así, si cambiás el
 * margen general, no hace falta editar producto por producto.
 */
function recalcularPrecios_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const config = getConfig_();
    const sheet = getSheet_();
    const headers = getHeaderRow_(sheet);
    const costoCol = headers.indexOf("costo");
    const precioCol = headers.indexOf("precio");
    const idCol = headers.indexOf("id");
    if (costoCol === -1 || precioCol === -1) throw new Error("Faltan columnas de costo/precio en la hoja.");

    const data = sheet.getDataRange().getValues();
    let actualizados = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === "") continue;
      const costo = Number(data[i][costoCol]) || 0;
      if (costo > 0) {
        const nuevoPrecio = Math.ceil((costo * (1 + config.margen / 100)) / 100) * 100;
        sheet.getRange(i + 1, precioCol + 1).setValue(nuevoPrecio);
        actualizados++;
      }
    }
    return { actualizados: actualizados };
  } finally {
    lock.releaseLock();
  }
}

function validateProduct_(p) {
  if (!p || !p.nombre || !String(p.nombre).trim()) throw new Error("El producto necesita un nombre.");
  if (!p.categoria || !String(p.categoria).trim()) throw new Error("El producto necesita una categoría.");
  if (isNaN(Number(p.precio)) || Number(p.precio) < 0) throw new Error('Precio inválido para "' + p.nombre + '".');
  if (isNaN(Number(p.stock)) || Number(p.stock) < 0) throw new Error('Stock inválido para "' + p.nombre + '".');
}

// ================= Stock: ajuste compartido por ventas/cancelaciones =================

/**
 * Suma (sign=+1) o resta (sign=-1) la cantidad de cada item al stock del
 * producto correspondiente. Nunca deja el stock negativo.
 */
function adjustStock_(items, sign) {
  if (!items || !items.length) return;
  const sheet = getSheet_();
  const headers = getHeaderRow_(sheet);
  const idCol = headers.indexOf("id");
  const stockCol = headers.indexOf("stock");
  if (idCol === -1 || stockCol === -1) return;

  const data = sheet.getDataRange().getValues();
  items.forEach((it) => {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(it.id)) {
        const actual = Number(data[i][stockCol]) || 0;
        const nuevo = Math.max(0, actual + sign * (Number(it.cantidad) || 0));
        sheet.getRange(i + 1, stockCol + 1).setValue(nuevo);
        data[i][stockCol] = nuevo; // por si el mismo producto aparece más de una vez en el pedido
        break;
      }
    }
  });
}

// ================= Ventas / pedidos =================

/**
 * Acción PÚBLICA (sin contraseña): la llama la tienda cuando un cliente
 * confirma el pedido y se abre WhatsApp. Registra el pedido como
 * "Pendiente" y DESCUENTA el stock al instante (para que dos clientes no
 * puedan "comprar" lo último que queda al mismo tiempo). Si después
 * marcás el pedido como Cancelado, el stock se devuelve solo.
 */
function registrarPedido_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rawItems = payload && payload.items;
    if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("El pedido no tiene productos.");
    if (rawItems.length > 200) throw new Error("Pedido inválido.");

    const items = rawItems.map((it) => ({
      id: it.id,
      nombre: String(it.nombre || "Producto").slice(0, 60),
      cantidad: Math.max(1, Math.min(9999, Number(it.cantidad) || 1)),
      precio: Math.max(0, Number(it.precio) || 0),
      costo: Math.max(0, Number(it.costo) || 0),
    }));

    let total = 0;
    let costoTotal = 0;
    const resumen = items
      .map((it) => {
        total += it.precio * it.cantidad;
        costoTotal += it.costo * it.cantidad;
        return it.cantidad + "x " + it.nombre;
      })
      .join(" | ");

    const sheet = getVentasSheet_();
    const headers = getHeaderRow_(sheet);
    const id = Utilities.getUuid();
    const row = {
      id: id,
      fecha: new Date(),
      items: resumen,
      itemsjson: JSON.stringify(items),
      total: total,
      costototal: costoTotal,
      gananciatotal: total - costoTotal,
      estado: "Pendiente",
      notas: "",
    };
    sheet.appendRow(headers.map((h) => (row[h] !== undefined ? row[h] : "")));

    adjustStock_(items, -1);

    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function listVentas_() {
  const sheet = getVentasSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  const idCol = headers.indexOf("id");
  return values.slice(1)
    .filter((row) => row[idCol] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.total = Number(obj.total) || 0;
      obj.costototal = Number(obj.costototal) || 0;
      obj.gananciatotal = Number(obj.gananciatotal) || 0;
      obj.fecha = obj.fecha instanceof Date ? obj.fecha.toISOString() : obj.fecha;
      delete obj.itemsjson; // uso interno solo, no hace falta mandarlo al panel
      return obj;
    })
    .reverse(); // más recientes primero
}

function updateVentaEstado_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = payload && payload.id;
    const estado = payload && payload.estado;
    const permitidos = ["Pendiente", "Confirmado", "Cancelado"];
    if (!id) throw new Error("Falta el id de la venta.");
    if (permitidos.indexOf(estado) === -1) throw new Error("Estado inválido.");

    const sheet = getVentasSheet_();
    const headers = getHeaderRow_(sheet);
    const row = findRowById_(sheet, id);
    if (row === -1) throw new Error("La venta no existe.");

    const estadoCol = headers.indexOf("estado") + 1;
    const itemsJsonCol = headers.indexOf("itemsjson") + 1;
    const estadoAnterior = sheet.getRange(row, estadoCol).getValue();

    let items = [];
    if (itemsJsonCol > 0) {
      try {
        items = JSON.parse(sheet.getRange(row, itemsJsonCol).getValue() || "[]");
      } catch (e) {
        items = [];
      }
    }

    const eraCancelado = estadoAnterior === "Cancelado";
    const seraCancelado = estado === "Cancelado";
    if (!eraCancelado && seraCancelado) adjustStock_(items, +1); // se cancela: devolver stock
    if (eraCancelado && !seraCancelado) adjustStock_(items, -1); // se reabre: descontar de nuevo

    sheet.getRange(row, estadoCol).setValue(estado);
    return { id: id, estado: estado };
  } finally {
    lock.releaseLock();
  }
}

// ================= Gastos =================

function crearGasto_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const concepto = payload && payload.concepto;
    const monto = Number(payload && payload.monto);
    if (!concepto || !String(concepto).trim()) throw new Error("El gasto necesita una descripción.");
    if (isNaN(monto) || monto <= 0) throw new Error("El monto no es válido.");
    const sheet = getGastosSheet_();
    const id = Utilities.getUuid();
    sheet.appendRow([id, new Date(), concepto, monto, (payload && payload.categoria) || "General"]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function listGastos_() {
  const sheet = getGastosSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  const idCol = headers.indexOf("id");
  return values.slice(1)
    .filter((row) => row[idCol] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.monto = Number(obj.monto) || 0;
      obj.fecha = obj.fecha instanceof Date ? obj.fecha.toISOString() : obj.fecha;
      return obj;
    })
    .reverse();
}

function eliminarGasto_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = payload && payload.id;
    if (!id) throw new Error("Falta el id del gasto.");
    const sheet = getGastosSheet_();
    const row = findRowById_(sheet, id);
    if (row === -1) throw new Error("El gasto no existe.");
    sheet.deleteRow(row);
    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

// ================= Compras / reposición de mercadería =================
// Registro separado de "Gastos": acá se asienta cada vez que se repone
// stock, con costo unitario y proveedor. Es la base del capital histórico
// invertido en mercadería (distinto del valor de inventario actual, que
// solo mira lo que queda sin vender).

function crearCompra_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const producto = payload && payload.producto;
    const cantidad = Number(payload && payload.cantidad);
    const costoUnitario = Number(payload && payload.costoUnitario);
    if (!producto || !String(producto).trim()) throw new Error("La compra necesita un producto/concepto.");
    if (isNaN(cantidad) || cantidad <= 0) throw new Error("La cantidad no es válida.");
    if (isNaN(costoUnitario) || costoUnitario < 0) throw new Error("El costo unitario no es válido.");

    const costoTotal = cantidad * costoUnitario;
    const sheet = getComprasSheet_();
    const id = Utilities.getUuid();
    sheet.appendRow([
      id,
      new Date(),
      producto,
      cantidad,
      costoUnitario,
      costoTotal,
      (payload && payload.proveedor) || "",
      (payload && payload.notas) || "",
    ]);
    return { id: id, costoTotal: costoTotal };
  } finally {
    lock.releaseLock();
  }
}

function listCompras_() {
  const sheet = getComprasSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  const idCol = headers.indexOf("id");
  return values.slice(1)
    .filter((row) => row[idCol] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.cantidad = Number(obj.cantidad) || 0;
      obj.costounitario = Number(obj.costounitario) || 0;
      obj.costototal = Number(obj.costototal) || 0;
      obj.fecha = obj.fecha instanceof Date ? obj.fecha.toISOString() : obj.fecha;
      return obj;
    })
    .reverse();
}

function eliminarCompra_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = payload && payload.id;
    if (!id) throw new Error("Falta el id de la compra.");
    const sheet = getComprasSheet_();
    const row = findRowById_(sheet, id);
    if (row === -1) throw new Error("La compra no existe.");
    sheet.deleteRow(row);
    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

// ================= Historial semanal (snapshot automático) =================
// Cada vez que corre (manual o por trigger), calcula los totales de los
// últimos 7 días y los guarda como una fila nueva en "Historial". Con el
// tiempo, esto arma una serie histórica real para ver tendencias — sin
// tener que sumar todo a mano cada vez.

function generarSnapshot_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const ventas = listVentas_().filter((v) => v.estado === "Confirmado" && new Date(v.fecha) >= desde);
    const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);
    const gananciaBruta = ventas.reduce((s, v) => s + v.gananciatotal, 0);

    const gastos = listGastos_().filter((g) => new Date(g.fecha) >= desde);
    const gastosTotal = gastos.reduce((s, g) => s + g.monto, 0);

    const compras = listCompras_().filter((c) => new Date(c.fecha) >= desde);
    const comprasTotal = compras.reduce((s, c) => s + c.costototal, 0);

    const productos = listProducts_();
    const capitalInventario = productos.reduce((s, p) => s + p.costo * p.stock, 0);

    const gananciaNeta = gananciaBruta - gastosTotal;

    const sheet = getHistorialSheet_();
    sheet.appendRow([new Date(), ventasTotal, gananciaBruta, gastosTotal, gananciaNeta, capitalInventario, comprasTotal]);

    return {
      fecha: new Date().toISOString(),
      ventasTotal: ventasTotal,
      gananciaBruta: gananciaBruta,
      gastosTotal: gastosTotal,
      gananciaNeta: gananciaNeta,
      capitalInventario: capitalInventario,
      comprasTotal: comprasTotal,
    };
  } finally {
    lock.releaseLock();
  }
}

function listHistorial_() {
  const sheet = getHistorialSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  return values.slice(1)
    .filter((row) => row[0] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.fecha = obj.fecha instanceof Date ? obj.fecha.toISOString() : obj.fecha;
      obj.ventastotal = Number(obj.ventastotal) || 0;
      obj.gananciabruta = Number(obj.gananciabruta) || 0;
      obj.gastostotal = Number(obj.gastostotal) || 0;
      obj.ganancianeta = Number(obj.ganancianeta) || 0;
      obj.capitalinventario = Number(obj.capitalinventario) || 0;
      obj.comprastotal = Number(obj.comprastotal) || 0;
      return obj;
    });
}

/**
 * Wrapper que ejecuta el trigger de tiempo semanal (Domingo a la noche).
 * NO se llama desde el panel: la instala una vez el dueño del script,
 * corriendo manualmente instalarTriggerSnapshotSemanal() en el editor.
 */
function generarSnapshotAutomatico() {
  generarSnapshot_();
}

function instalarTriggerSnapshotSemanal() {
  // Evita duplicar el trigger si ya estaba instalado.
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "generarSnapshotAutomatico") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("generarSnapshotAutomatico")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(22)
    .create();
}

// ================= Alerta de stock bajo (mail) =================

function listStockBajo_() {
  return listProducts_()
    .filter((p) => !p.oculto && p.stock <= LOW_STOCK_THRESHOLD)
    .map((p) => ({ nombre: p.nombre, stock: p.stock }));
}

function chequearStockBajoYAvisar_() {
  const productos = listProducts_().filter((p) => !p.oculto && p.stock <= LOW_STOCK_THRESHOLD);
  if (!productos.length) return { enviado: false, productos: [] };

  const destinatario = Session.getEffectiveUser().getEmail();
  const lista = productos
    .map((p) => `- ${p.nombre}: quedan ${p.stock} unidad(es)${p.stock === 0 ? " (SIN STOCK)" : ""}`)
    .join("\n");

  MailApp.sendEmail({
    to: destinatario,
    subject: `⚠️ Warp Market — ${productos.length} producto(s) con stock bajo`,
    body: `Estos productos están en o por debajo de ${LOW_STOCK_THRESHOLD} unidades:\n\n${lista}\n\nEntrá al panel para reponerlos.`,
  });

  return { enviado: true, productos: productos.map((p) => ({ nombre: p.nombre, stock: p.stock })) };
}

/**
 * Wrapper del trigger diario. Igual que el snapshot semanal, se instala
 * una sola vez corriendo instalarTriggerAlertaStock() manualmente.
 */
function alertaStockDiaria() {
  chequearStockBajoYAvisar_();
}

function instalarTriggerAlertaStock() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "alertaStockDiaria") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("alertaStockDiaria")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}
