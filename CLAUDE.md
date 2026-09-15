# ObraCertif — guía para trabajar en este repo

`index.html` es la app completa (HTML + CSS + JS vanilla, **sin build**). Se
publica con GitHub Pages: **un `git push` a `main` alcanza para desplegar**.

Trabajamos en **español rioplatense**. Cambios quirúrgicos: sólo lo pedido.

## Cómo editar

Editá siempre `index.html` **en el lugar**. Este archivo es el maestro desde
ahora; `Downloads\ObraCertif_4.html` quedó como versión anterior de una sola
obra. No generes copias con sufijos (`_v2`, `_final`): el historial de git es
el control de versiones.

## Invariantes

### 1. `S` es la obra activa, `DB` las contiene a todas

- `DB = {v:5, activa, obras:{[id]: obra}}` en `localStorage['obracertif_v5']`
  (+ `_bak` con la copia anterior). `S` apunta a `DB.obras[DB.activa]`.
- Todo el código de certificados sigue usando `S` como antes. No hace falta
  saber de `DB` para tocar tablas, resumen o PDF.
- `persist()` es el único punto de guardado: local + programa la subida a
  Drive (4 s de debounce). Cualquier cambio de datos tiene que terminar en
  `persist()` (directo, o vía `render()`/`patch()`).
- `_bootDone` evita que el arranque marque la obra como modificada.

### 2. Id de obra estable

`_idDesde(obra)` = hash de `propietario|obra`. Así, importar dos veces el mismo
HTML viejo no duplica la obra. En Drive la carpeta se encuentra por ese id
(va entre corchetes al final del nombre), no por el nombre visible.

### 3. Marcador `SAVED_STATE`

```js
const SAVED_STATE = null; // <<SAVED_STATE>>
```

"📋 Copia offline" reemplaza desde `const SAVED_STATE = ` hasta el comentario
`// <<SAVED_STATE>>`. No cambies ese formato. Dentro de `getHTML()` los textos
se arman por partes (`'SAVED'+'_STATE'`) a propósito, para que el reemplazo no
se coma el propio código (bug de la versión anterior al guardar dos veces).

### 4. Drive

- `DRIVE_URL` / `DRIVE_SECRET` al final del script. La misma clave va en
  `apps_script_obracertif.gs`.
- Acciones del servidor: `save` (POST), `list`, `load`, `versiones`,
  `loadVersion` (GET).
- El servidor guarda la versión anterior en `historial/` antes de pisar
  `datos.json`. Si cambiás el `.gs`, redesplegar como **Nueva versión** de la
  misma implementación (si no, cambia la URL).

## Datos de clientes: nunca al repo

El repo es **público**. Los certificados reales (montos, propietarios) viven
en el navegador y en Drive, nunca en git. `.gitignore` excluye `*.json`.

## Antes de commitear

Verificá que el script parsea (una coma de más deja la pantalla en blanco):

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');new Function(h.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log('OK')"
```
