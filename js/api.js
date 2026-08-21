/**
 * WARP MARKET — Capa de datos
 * Toda la comunicación con Google Sheets (vía Apps Script) pasa por acá.
 */

const Api = (() => {
  const CACHE_KEY = "wm_products_cache_v1";
  const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos: evita pegarle a la API en cada navegación

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* almacenamiento lleno o bloqueado: no es crítico, seguimos sin cache */
    }
  }

  /**
   * Trae el catálogo de productos.
   * @param {boolean} force - si es true, ignora la cache local.
   */
  async function getProducts(force = false) {
    if (!force) {
      const cached = readCache();
      if (cached) return cached;
    }

    if (!CONFIG.API_URL || CONFIG.API_URL.includes("PEGA_AQUI")) {
      throw new Error("CONFIG.API_URL no está configurada todavía (ver README.md).");
    }

    const res = await fetch(`${CONFIG.API_URL}?action=productos`, { method: "GET" });
    if (!res.ok) throw new Error(`Error de red (${res.status})`);

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Respuesta inválida del servidor");

    writeCache(json.data);
    return json.data;
  }

  function invalidateCache() {
    sessionStorage.removeItem(CACHE_KEY);
  }

  /**
   * POST genérico autenticado contra el Apps Script (usado por el panel admin).
   * @param {string} action - crear | editar | eliminar | carga_masiva
   * @param {object} payload
   * @param {string} token - contraseña de administrador
   */
  async function send(action, payload, token) {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      // text/plain evita el preflight OPTIONS, que Apps Script Web Apps no maneja bien.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, payload }),
    });

    if (!res.ok) throw new Error(`Error de red (${res.status})`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "El servidor rechazó la operación");
    invalidateCache();
    return json.data;
  }

  return { getProducts, invalidateCache, send };
})();
