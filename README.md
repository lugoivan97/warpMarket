# Warp Market — Tienda de congelados

Tienda estática (HTML/CSS/JS, sin frameworks) con carrito, checkout por
WhatsApp, panel de administración oculto y Google Sheets como base de datos.

Seguí estos pasos en orden. En total son ~15 minutos y queda lista para
vender.

---

## 1. Crear la Google Sheet

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una hoja nueva.
2. Ponele el nombre que quieras (ej: "Warp Market — Base de datos").
3. **No hace falta que armes las columnas a mano** — el backend las crea
   solas la primera vez que se conecta. Si preferís armarlas vos, la hoja
   se debe llamar exactamente `Productos` y llevar estos encabezados en la
   fila 1: `id | nombre | categoria | precio | stock | imagen | descripcion | destacado`

## 2. Conectar Apps Script a la hoja

1. En la misma Sheet: **Extensiones → Apps Script**.
2. Borrá el contenido de `Código.gs` que aparece por defecto.
3. Pegá ahí todo el contenido del archivo `apps-script/Code.gs` de esta
   carpeta.
4. Guardá el proyecto (ícono de disquete o Ctrl+S). Ponele un nombre, ej.
   "Warp Market API".

## 3. Configurar la contraseña del panel admin

1. En el editor de Apps Script: **Configuración del proyecto** (ícono de
   engranaje, panel izquierdo) → bajá hasta **Propiedades del script**.
2. Agregá una propiedad:
   - Propiedad: `ADMIN_PASSWORD`
   - Valor: la contraseña que quieras usar para entrar al panel (elegí
     algo que no sea obvio; es la única barrera de seguridad del panel).
3. Guardá.

## 4. Publicar como Web App

1. En el editor de Apps Script: botón **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier usuario**
4. Hacé clic en **Implementar** y autorizá los permisos que pida Google
   (te va a avisar que es un script no verificado — es normal, es tu
   propio script; hacé clic en "Ir a Warp Market API (no seguro)" → Permitir).
5. Copiá la **URL de la aplicación web** que te da. Termina en `/exec`.

> Si en el futuro modificás `Code.gs`, tenés que hacer **Implementar →
> Administrar implementaciones → ✏️ → Nueva versión → Implementar** para
> que los cambios se reflejen en la URL publicada.

## 5. Conectar el sitio con tu backend

Abrí `js/config.js` y completá:

```js
API_URL: "https://script.google.com/macros/s/TU_ID_AQUI/exec",
```

pegando la URL que copiaste en el paso anterior. Ahí mismo también podés
revisar/ajustar:

- `WHATSAPP_NUMBER` (ya está cargado con el número que me pasaste:
  `5493484698036`. Para cambiarlo, poné solo números con código de país,
  sin espacios ni signos: `codigo_pais + numero`).
- `STORE_NAME`, `TAGLINE`, `CATEGORIES`, moneda, etc.

## 6. Cargar tus primeros productos

1. Abrí `index.html` en el navegador (local) o subilo ya a tu hosting
   (paso 7) y abrilo desde ahí.
2. Tocá **3 veces seguidas** el nombre "Warp Market" en el encabezado
   (o hacé 3 clics rápidos si estás en desktop). Te lleva a `admin.html`.
3. Ingresá la contraseña que configuraste en el paso 3.
4. Cargá productos uno por uno desde la pestaña **Agregar producto**, o
   todos juntos desde **Carga masiva** subiendo un CSV (bajá la plantilla
   con el botón "Descargar plantilla CSV" para ver el formato exacto).

## 7. Publicar el sitio en tu dominio

Esto es un sitio 100% estático: cualquier hosting sirve (GitHub Pages,
Netlify, Vercel, tu propio hosting por FTP, etc.). Solo tenés que subir
**toda la carpeta tal cual está** (no hace falta build ni instalar nada).

Si usás GitHub Pages (como con Beat & Home): subí estos archivos al repo,
activá GitHub Pages apuntando a la rama/carpeta correspondiente, y listo.

---

## Estructura de archivos

```
index.html          → tienda pública
admin.html           → panel de administración (acceso oculto)
css/style.css        → estilos de la tienda
css/admin.css         → estilos del panel admin
js/config.js          → ⚙️ único archivo que hay que editar para configurar
js/api.js             → comunicación con Google Sheets (Apps Script)
js/cart.js            → lógica del carrito
js/store.js           → lógica de la tienda pública
js/admin.js           → lógica del panel admin
apps-script/Code.gs    → backend (se pega en Apps Script, no se sube al hosting)
manifest.json / assets/favicon.svg → íconos y "instalar como app"
```

## Cómo funciona cada pieza (por si necesitás tocar algo)

- **Catálogo**: `store.js` le pide los productos a `api.js`, que llama a
  tu Apps Script (`?action=productos`) y guarda una copia en caché por
  2 minutos para que la tienda cargue rápido incluso con conexión lenta.
- **Carrito**: vive en `cart.js`, se guarda en `localStorage` del
  navegador (persiste si el cliente cierra la pestaña y vuelve).
- **Checkout**: al tocar "Pedir por WhatsApp" se arma un mensaje con el
  detalle de productos, cantidades y el total, y se abre
  `wa.me/<tu número>` con el mensaje precargado.
- **Acceso oculto al admin**: 3 clics/toques en el nombre de la tienda en
  menos de un segundo redirigen a `admin.html` (ver `setupHiddenAdminAccess`
  en `store.js`).
- **Autenticación del panel**: la contraseña se manda junto a cada pedido
  de escritura (crear/editar/eliminar/carga masiva) y Apps Script la
  valida contra `ADMIN_PASSWORD`. No hay usuarios múltiples: es una sola
  contraseña compartida, pensada para un negocio chico con un solo
  administrador.
- **Carga masiva**: `admin.js` lee el CSV en el navegador (sin subir el
  archivo a ningún lado más que a tu propia base de datos), lo valida,
  te muestra una vista previa, y recién al confirmar lo manda a la Sheet.

## Checklist antes de "abrir al público"

- [ ] `API_URL` en `js/config.js` apunta a tu Web App (`.../exec`)
- [ ] `WHATSAPP_NUMBER` es el número correcto, sin espacios ni "+"
- [ ] `ADMIN_PASSWORD` configurada en Apps Script y probada en el panel
- [ ] Cargaste al menos algunos productos con imagen, precio y stock
- [ ] Probaste un pedido completo de punta a punta (agregar al carrito →
      WhatsApp → mensaje llega correcto con el total)
- [ ] Probaste el acceso oculto al panel desde el celular real (3 toques)

## Notas de seguridad

- El panel usa una sola contraseña compartida vía Apps Script. Es
  suficiente para un negocio chico, pero **no la compartas** ni la subas
  a ningún repositorio público dentro del código (por eso vive en
  Propiedades del script, no en `Code.gs`).
- El link a `admin.html` no aparece en ningún menú ni buscador (además
  tiene `noindex` para buscadores), pero cualquiera que conozca la URL
  exacta puede llegar a la pantalla de login — lo que lo protege es la
  contraseña, no la URL oculta. Si en algún momento necesitás algo con
  más seguridad (varios usuarios, roles, etc.), avisame y lo escalamos.
