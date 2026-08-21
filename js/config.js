/**
 * WARP MARKET — Configuración central
 * ------------------------------------------------------------
 * Este es el ÚNICO archivo que necesitás tocar para poner la
 * tienda en marcha. Todo lo demás funciona solo.
 * ------------------------------------------------------------
 */

const CONFIG = {
  // Nombre de la tienda (aparece en el header, título de pestaña y mensajes)
  STORE_NAME: "Warp Market",

  // Lema corto que aparece debajo del nombre
  TAGLINE: "Provisiones congeladas para toda la tripulación",

  // Número de WhatsApp de destino, SOLO números, con código de país.
  // Ejemplo Argentina: 54 9 348 469-8036  ->  5493484698036
  WHATSAPP_NUMBER: "5493484698036",

  // URL del Google Apps Script publicado como "Web App" (ver README.md).
  // Se ve así: https://script.google.com/macros/s/AKfycb.../exec
  API_URL: "PEGA_AQUI_LA_URL_DE_TU_APPS_SCRIPT",

  // Moneda usada para formatear precios
  CURRENCY: "ARS",
  LOCALE: "es-AR",

  // Costo de envío informativo (0 = no se muestra / a coordinar por WhatsApp)
  SHOW_SHIPPING_NOTE: true,
  SHIPPING_NOTE: "El costo de envío se coordina por WhatsApp según tu zona.",

  // Categorías fijas que se muestran en el filtro, en este orden.
  // Deben coincidir (sin importar mayúsculas) con la columna "categoria"
  // de la Google Sheet. Si cargás una categoría nueva en la planilla,
  // el sitio la agrega sola al final del filtro.
  CATEGORIES: ["Platos Listos", "Carnes", "Vegetales", "Panificados", "Postres"],

  // Cada cuánto se refresca el catálogo en segundo plano (milisegundos)
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,
};
