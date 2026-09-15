# Instalar el respaldo en Drive de ObraCertif

Con esto, cada obra y cada certificado que cargues en ObraCertif queda además
respaldado en tu Google Drive, en carpetas navegables, con historial de
versiones. Es gratis y se hace una sola vez.

Tiempo estimado: 5 minutos.

---

## Paso 1 — Crear el proyecto

1. Entrá a **https://script.google.com** con la cuenta de Google donde querés
   que se guarden los respaldos.
2. Tocá **Nuevo proyecto**.
3. Borrá todo el código que aparece (el `function myFunction() {}`).
4. Abrí el archivo `apps_script_obracertif.gs` de esta carpeta, copiá **todo**
   su contenido y pegalo ahí.
5. Arriba a la izquierda, ponele de nombre `ObraCertif Servidor`.
6. Guardá con `Ctrl+S`.

La clave secreta ya viene puesta en el código (`var SECRETO = '...'`). No hace
falta cambiarla: es la misma que tiene la app.

## Paso 2 — Publicar

1. Arriba a la derecha, botón azul **Implementar** → **Nueva implementación**.
2. Al lado de "Seleccionar tipo" tocá el engranaje ⚙️ y elegí **Aplicación web**.
3. Completá así:
   - **Descripción**: `v1`
   - **Ejecutar como**: **Yo** (tu email) ← importante
   - **Quién tiene acceso**: **Cualquier persona** ← importante
4. Tocá **Implementar**.

> ⚠️ "Cualquier persona" suena riesgoso pero no lo es: sin la clave secreta el
> servidor rechaza todo pedido.

## Paso 3 — Autorizar

La primera vez Google te pide permiso:

1. **Autorizar acceso** → elegí tu cuenta.
2. Aparece *"Google no verificó esta aplicación"*. Es normal: la hiciste vos.
3. **Configuración avanzada** → **Ir a ObraCertif Servidor (no seguro)** → **Permitir**.

Si aparece `Error 401: invalid_client`, volvé a tocar **Implementar** una
segunda vez (pasó igual con ObraCalc y se resolvió así).

Al terminar te muestra una **URL de la aplicación web** parecida a:

```
https://script.google.com/macros/s/AKfycbx...largo.../exec
```

**Copiala y pasámela** — con eso conecto la app.

---

## Cómo queda organizado tu Drive

```
ObraCertif_Datos/
└── Corradi Hogar — Galpón_ Depósito [oc_h…]/   ← una carpeta por obra
      ├── datos.json          ← lo que lee y escribe la app
      ├── info.json           ← ficha corta
      ├── resumen.csv         ← una fila por certificado: fechas, % físico, montos
      ├── certificados/
      │     ├── 01 - Certif. 4.csv    ← ítem por ítem, abrible en Excel
      │     └── …
      └── historial/
            ├── 2026-09-15_183012_manual.json
            └── …             ← versiones completas anteriores
```

## Cuándo se guarda

- **Solo**: unos segundos después de cada cambio.
- **Al tocar 💾 Guardar**: se sube al momento y además queda marcado como
  versión "guardado manual" en el historial (usalo al cerrar cada certificado).
- **Historial**: antes de pisar los datos, la versión anterior se guarda en
  `historial/` (como mucho una cada 30 minutos en el autoguardado, siempre en
  cada Guardar manual). Se conservan las últimas 150 por obra.
- Desde la app, **🏗 Obras → 🕘** muestra esas versiones y permite restaurar
  cualquiera (la actual se guarda antes, así que tampoco se pierde).

---

## Preguntas

**¿Cuesta algo?** No. Apps Script es gratis.

**¿Y si edito el script después?** **Implementar → Administrar
implementaciones → ✏️ editar → Versión: Nueva versión → Implementar.** Si creás
una implementación nueva desde cero te da otra URL y hay que volver a pasármela.
