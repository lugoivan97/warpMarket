/**
 * WARP MARKET — Backend (Google Apps Script)
 * ------------------------------------------------------------
 * Convierte una Google Sheet en la base de datos de la tienda.
 * Instrucciones completas de instalación: ver README.md
 *
 * Columnas esperadas en la hoja "Productos" (fila 1 = encabezados):
 * id | nombre | categoria | precio | stock | imagen | descripcion | destacado
 * ------------------------------------------------------------
 */

const SHEET_NAME = "Productos";
const HEADERS = ["id", "nombre", "categoria", "precio", "stock", "imagen", "descripcion", "destacado"];

/**
 * IMPORTANTE: la contraseña del panel admin NO se guarda en este código.
 * Se define en Extensiones > Propiedades del proyecto > Propiedades del script
 * con la clave ADMIN_PASSWORD. Así evitás dejarla expuesta si compartís el código.
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
    const { action, token, payload } = body;

    if (action === "productos_publico") {
      return jsonOut_({ ok: true, data: listProducts_() });
    }

    // Todas las demás acciones requieren autenticación.
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

// ================= Acceso a la hoja =================

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function listProducts_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim().toLowerCase());
  return values.slice(1)
    .filter((row) => row[headers.indexOf("id")] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      obj.precio = Number(obj.precio) || 0;
      obj.stock = Number(obj.stock) || 0;
      obj.destacado = obj.destacado === true || String(obj.destacado).toLowerCase() === "true";
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

// ================= Operaciones (con lock para evitar condiciones de carrera) =================

function createProduct_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    validateProduct_(p);
    const sheet = getSheet_();
    const id = Utilities.getUuid();
    sheet.appendRow([id, p.nombre, p.categoria, p.precio, p.stock, p.imagen || "", p.descripcion || "", !!p.destacado]);
    return { id };
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
    const row = findRowById_(sheet, p.id);
    if (row === -1) throw new Error("El producto no existe (puede haber sido eliminado).");
    sheet.getRange(row, 2, 1, HEADERS.length - 1).setValues([[
      p.nombre, p.categoria, p.precio, p.stock, p.imagen || "", p.descripcion || "", !!p.destacado,
    ]]);
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
    const toAppend = rows.map((p) => {
      validateProduct_(p);
      return [Utilities.getUuid(), p.nombre, p.categoria, p.precio, p.stock, p.imagen || "", p.descripcion || "", !!p.destacado];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, HEADERS.length).setValues(toAppend);
    return { count: toAppend.length };
  } finally {
    lock.releaseLock();
  }
}

function validateProduct_(p) {
  if (!p || !p.nombre || !String(p.nombre).trim()) throw new Error("El producto necesita un nombre.");
  if (!p.categoria || !String(p.categoria).trim()) throw new Error("El producto necesita una categoría.");
  if (isNaN(Number(p.precio)) || Number(p.precio) < 0) throw new Error(`Precio inválido para "${p.nombre}".`);
  if (isNaN(Number(p.stock)) || Number(p.stock) < 0) throw new Error(`Stock inválido para "${p.nombre}".`);
}
