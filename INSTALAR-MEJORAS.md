# Instalar las mejoras nuevas — guía rápida

## 1. Actualizar el backend (Apps Script)

1. Andá a tu Google Sheet → **Extensiones → Apps Script**.
2. Borrá **todo** el contenido actual de `Code.gs`.
3. Pegá el contenido completo del nuevo `apps-script/Code.gs` (adjunto).
4. Guardá (ícono de disquete o Ctrl+S).
5. **Implementar → Administrar implementaciones → ✏️ (editar) → Nueva versión → Implementar.**
   Esto es obligatorio: si solo guardás pero no creás una "Nueva versión", la URL pública
   (`.../exec`) sigue sirviendo el código viejo.

Las hojas nuevas ("Compras" e "Historial") se crean solas la primera vez que el panel les pide
datos — no hace falta armarlas a mano.

## 2. Instalar los dos triggers automáticos (una sola vez)

Estos NO se activan solos con el paso 1 — son automatizaciones que corren aunque no tengas el
panel abierto, y Google exige instalarlas manualmente por seguridad.

1. En el editor de Apps Script, en el selector de funciones (arriba, al lado del botón ▶️ Ejecutar),
   elegí **`instalarTriggerSnapshotSemanal`** y hacé clic en ▶️ Ejecutar.
   - La primera vez te va a pedir autorización — es normal, es tu propio script.
   - Esto programa el snapshot de historial para todos los domingos a las 22hs.
2. Repetí lo mismo eligiendo **`instalarTriggerAlertaStock`** y ejecutando ▶️.
   - Programa el chequeo de stock bajo todos los días a las 9am.
3. Para confirmar que quedaron instalados: ícono de reloj ⏰ en el panel izquierdo
   ("Activadores") — deberías ver ambos listados.

Si alguna vez necesitás desinstalarlos o reinstalarlos (por ejemplo, si cambiás el horario a mano
en "Activadores" y querés volver al default), simplemente volvé a ejecutar la función
correspondiente — el código borra el trigger viejo antes de crear uno nuevo, así que nunca se
duplican.

## 3. Subir el frontend

Reemplazá en tu repo: `index.html`, `admin.html`, `css/style.css`, `css/admin.css`, `js/admin.js`
(los demás `js/*.js` no cambiaron, pero te los dejo igual en el zip por si preferís reemplazar todo
junto). Commit y push como siempre.

## 4. Qué vas a ver nuevo en el panel

- **Pestaña Compras**: registrás cada reposición de mercadería (producto, cantidad, costo unitario,
  proveedor). Te muestra invertido en los últimos 30 días y el histórico total.
- **Pestaña Historial**: tabla + gráfico de ventas/ganancia semana a semana. Al principio vas a ver
  "Todavía no hay snapshots" — normal, se llena con el tiempo (o generá uno a mano con el botón
  "Generar snapshot ahora" para probarlo ya).
- **Pestaña Alertas**: lista los productos con 5 unidades o menos. El botón "Probar ahora" te manda
  un mail de verdad a la cuenta de Google dueña del script, así confirmás que funciona antes de
  dejarlo en automático.
- **Productos**: la stat card "Valor de inventario (costo)" que ya tenías es justamente tu capital
  invertido en vivo (lo que tenés parado en stock ahora mismo, a costo).

## Notas importantes

- El snapshot semanal calcula sobre los **últimos 7 días desde el momento en que corre**, no por
  semana calendario — así que el primer domingo va a sumar todo lo que pasó desde que lo instalaste.
- El mail de alerta de stock se manda a la cuenta de Google que es dueña del script (la que usaste
  para crear la Sheet), vía `Session.getEffectiveUser().getEmail()`. Si en algún momento querés que
  vaya a otra dirección, avisame y lo hacemos configurable desde el panel.
- Nada de esto toca `Productos`, `Ventas` ni `Gastos` — las hojas y funciones que ya usabas siguen
  exactamente igual.
