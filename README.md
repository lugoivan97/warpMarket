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

## Novedades de esta versión

- **Costo y margen automático**: en el panel, al cargar el *costo* de un
  producto, el *precio de venta* se sugiere solo (costo + margen configurado,
  redondeado hacia arriba al múltiplo de 100 más cercano). Siempre podés
  pisar el precio sugerido a mano.
- **Margen y reparto configurables**: pestaña **Configuración** del panel —
  cambiás el % de margen y el % que te corresponde a vos del reparto con tu
  socio, sin tocar código.
- **Registro de ventas**: cada pedido confirmado por WhatsApp queda anotado
  automáticamente en una hoja nueva "Ventas" como *Pendiente*. Vos lo marcás
  como *Confirmado* (o *Cancelado*) desde la pestaña **Ventas** del panel, y
  ahí ves los totales de venta, ganancia, y cuánto le corresponde a cada
  socio — con exportación a CSV.
- **Panel con más contexto**: la pestaña Productos ahora muestra tarjetas con
  total de productos, productos sin stock y valor de inventario a costo; la
  tabla suma columnas de costo y margen.
- **Corrección**: el contador de cantidad ya no puede aparecer en el botón de
  WhatsApp bajo ninguna circunstancia (quedó blindado por CSS e ID único), y
  se agregó un stepper de cantidad directamente en cada tarjeta de producto.
- **Cache-busting**: los archivos CSS/JS ahora se cargan con `?v=2`. Si en el
  futuro actualizás estilos o scripts y el navegador sigue mostrando la
  versión vieja, subí ese número (`?v=3`, `?v=4`...) en `index.html` y
  `admin.html`.

## Cómo funciona el registro de ventas (importante)

El sitio es 100% estático: no hay forma de saber si el cliente terminó
pagando o no, porque el pedido se cierra por WhatsApp fuera del sitio. Por
eso cada pedido se guarda como **Pendiente** apenas el cliente toca "Pedir
por WhatsApp" — es un registro de *intención de compra*, no de venta
confirmada. Los totales de ganancia y reparto solo se calculan sobre las
ventas que vos marcás manualmente como **Confirmado** en el panel, así que
conviene revisar la pestaña Ventas todos los días y actualizar los estados.

## Seguridad — qué se revisó

- La contraseña de administrador nunca viaja ni se guarda en el código: vive
  solo en las Propiedades del script de Apps Script, y las acciones de
  escritura (crear, editar, eliminar, carga masiva, ventas, configuración)
  siempre la validan en el servidor.
- `js/config.js` (con la URL del backend) es público porque el sitio es
  estático — esto es normal y esperado; lo que protege tus datos es que las
  escrituras requieren contraseña, no que la URL esté oculta.
- El registro de pedidos (`registrar_pedido`) es una acción pública a
  propósito, porque la usa cualquier cliente al comprar. Tiene validaciones
  básicas (cantidad de ítems, precios no negativos) pero **no** tiene límite
  de frecuencia — Apps Script no ofrece eso nativamente. Si en algún momento
  ves filas basura en "Ventas", es spam automatizado; se puede sumar
  reCAPTCHA más adelante si se vuelve un problema real.
- Cambiá la contraseña de tanto en tanto (Apps Script → Configuración del
  proyecto → Propiedades del script) y no la compartas por chat ni la subas
  al repositorio.

## Rendimiento — qué se revisó

- El catálogo se cachea 2 minutos en el navegador del cliente
  (`sessionStorage`), así que navegar entre categorías o volver a la tienda
  no vuelve a pedir datos a Google innecesariamente.
- El buscador (tienda y panel) tiene *debounce*: espera a que la persona
  termine de tipear antes de filtrar, en vez de recalcular en cada tecla.
- Las imágenes usan `loading="lazy"`: no descargan hasta que están por
  entrar en pantalla.
- Con catálogos grandes (varios cientos de productos), Google Sheets puede
  empezar a notarse más lento que una base de datos real — si en algún
  momento llegás a esa escala, avisame y evaluamos migrar a algo como
  Firebase sin tocar el diseño de la tienda.

## Publicar en tu dominio de Hostinger desde Git

Hostinger ofrece un integrador de Git en el hPanel (disponible en la mayoría
de los planes de hosting web). Así es como se conecta:

1. Entrá a **hPanel** → elegí tu sitio/dominio → buscá **Avanzado → Git**
   (en algunos planes puede estar bajo "Archivos" o llamarse "Git
   deployment" — el nombre exacto varía un poco según el plan).
2. Pegá la URL de tu repositorio: `https://github.com/lugoivan97/warpMarket.git`
3. Rama: `main`.
4. **Directorio de instalación**: apuntalo a `public_html` (o a la subcarpeta
   correspondiente si tu dominio no es el principal de la cuenta). Esto es
   importante: como es un sitio estático, los archivos tienen que quedar
   directamente en la raíz que Hostinger sirve al público, no en una
   subcarpeta con el nombre del repo.
5. Guardá/Desplegá. Hostinger clona el repo y publica el contenido.
6. Cada vez que hagas `git push` a `main` desde tu computadora, entrá al
   mismo panel y usá el botón "Actualizar"/"Deploy" (Hostinger no siempre
   re-despliega solo con cada push; en algunos planes sí, con webhook
   automático — fijate si aparece esa opción al conectar el repo).

**Si tu plan no tiene la opción de Git** (pasa en algunos planes de hosting
compartido básico), la alternativa es simple: descargás el ZIP del repo
desde GitHub (Code → Download ZIP), lo descomprimís, y subís el *contenido*
de la carpeta (no la carpeta en sí) a `public_html` por el Administrador de
archivos de Hostinger o por FTP. Es más manual, pero el resultado final es
idéntico.

Una vez publicado: entrá a tu dominio, probá que cargue el catálogo, y
repetí la prueba de punta a punta (agregar al carrito → WhatsApp → mensaje
correcto) antes de anunciarlo a tus clientes.

## Checklist antes de "abrir al público"

- [ ] `API_URL` en `js/config.js` apunta a tu Web App (`.../exec`)
- [ ] `WHATSAPP_NUMBER` es el número correcto, sin espacios ni "+"
- [ ] `ADMIN_PASSWORD` configurada en Apps Script y probada en el panel
- [ ] Margen y reparto configurados en la pestaña Configuración del panel
- [ ] Cargaste al menos algunos productos con costo, precio, imagen y stock
- [ ] Probaste un pedido completo de punta a punta (agregar al carrito →
      WhatsApp → mensaje llega correcto con el total → aparece en la
      pestaña Ventas como Pendiente)
- [ ] Probaste el acceso oculto al panel desde el celular real (3 toques)
- [ ] El dominio de Hostinger carga la tienda correctamente

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
