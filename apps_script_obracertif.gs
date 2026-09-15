/**
 * ═══════════════════════════════════════════════════════════════════
 *  ObraCertif — respaldo en Drive (Google Apps Script)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Mismo criterio que ObraControl, ObraGestión y ObraCalc: una carpeta por
 *  obra, navegable desde Drive, con los datos que usa la app, copias
 *  legibles en CSV y un HISTORIAL de versiones para no perder nunca nada.
 *
 *  ObraCertif_Datos/
 *    └── Corradi Hogar — Galpón Depósito [oc_h1x2y3]/
 *          ├── datos.json          ← lo que lee y escribe la app
 *          ├── info.json           ← ficha corta (nombre, cantidad de certificados, fecha)
 *          ├── resumen.csv         ← una fila por certificado (fechas, % físico, montos)
 *          ├── certificados/
 *          │     ├── 01 - Certif. 4.csv
 *          │     └── 02 - Certif. 5.csv …
 *          └── historial/
 *                └── 2026-09-15_1830.json …   ← versiones anteriores completas
 * ═══════════════════════════════════════════════════════════════════
 */

var SECRETO = 'obracertif-66c3420b5d0ac65b89f33d17';
var CARPETA = 'ObraCertif_Datos';
var MIN_ENTRE_VERSIONES = 30;   // autoguardado: como mucho una versión cada 30 min
var MAX_VERSIONES = 150;        // por obra; las más viejas van a la papelera

// ─── CARPETAS ──────────────────────────────────────────────────────

function _limpio(n) {
  return String(n || 'sin_nombre').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'sin_nombre';
}

function _raiz() {
  var it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}

/** Busca la carpeta de la obra por su id (va entre corchetes al final del nombre). */
function _buscarObra(obraId) {
  var sufijo = '[' + obraId + ']';
  var it = _raiz().getFolders();
  while (it.hasNext()) {
    var c = it.next();
    var n = c.getName();
    if (n.slice(-sufijo.length) === sufijo) return c;
  }
  return null;
}

/** La crea si no existe y la renombra si cambió el nombre de la obra. */
function _carpetaObra(obraId, obraName) {
  var nombre = _limpio(obraName) + ' [' + obraId + ']';
  var c = _buscarObra(obraId);
  if (!c) return _raiz().createFolder(nombre);
  if (c.getName() !== nombre) c.setName(nombre);
  return c;
}

function _sub(carpeta, nombre) {
  var it = carpeta.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : carpeta.createFolder(nombre);
}

function _archivo(carpeta, nombre) {
  var it = carpeta.getFilesByName(nombre);
  return it.hasNext() ? it.next() : null;
}

function _escribir(carpeta, nombre, contenido, mime) {
  var viejo = _archivo(carpeta, nombre);
  if (viejo) viejo.setTrashed(true);
  return carpeta.createFile(Utilities.newBlob(contenido, mime || 'application/json', nombre));
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── CÁLCULOS (iguales a la app) ───────────────────────────────────

function _tot(items) {
  var t = { pres: 0, acum: 0, ant: 0, base: 0 };
  (items || []).forEach(function (it) {
    var imp = +it.importe_actual || 0;
    t.pres += imp * (+it.pct_pres || 0);
    t.acum += imp * (+it.pct_acum || 0);
    t.ant += imp * (+it.pct_ant || 0);
    t.base += imp;
  });
  return t;
}

function _num(n) { return (Math.round((+n || 0) * 100) / 100).toFixed(2).replace('.', ','); }
function _pct(p) { return ((+p || 0) * 100).toFixed(1).replace('.', ',') + '%'; }
function _fecha(s) {
  if (!s) return '';
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s);
}

function _csv(filas) {
  return '﻿' + filas.map(function (f) {
    return f.map(function (c) {
      c = (c === null || c === undefined) ? '' : String(c);
      return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
    }).join(';');
  }).join('\n');
}

// ─── COPIAS LEGIBLES ───────────────────────────────────────────────

function _csvResumen(d) {
  var filas = [['Certificado', 'Fecha medición', 'Fecha pago', '% físico acumulado', 'Monto acumulado realizado',
                'Pagado hasta el momento', 'Monto a pagar este certificado', '% avance este certificado',
                'Mano de obra: acumulado', 'Mano de obra: pagado', 'Mano de obra: a pagar']];
  (d.certs || []).forEach(function (c) {
    var t = _tot(c.items_c), m = _tot(c.items_mo);
    var pa = +c.pagado_anterior || 0, pm = +c.pagado_mo_anterior || 0;
    filas.push([c.label, _fecha(c.fecha_medicion), _fecha(c.fecha_pago),
      _pct(t.base ? t.acum / t.base : 0), _num(t.acum), _num(pa), _num(t.acum - pa),
      _pct(t.base ? t.pres / t.base : 0), _num(m.acum), _num(pm), _num(m.acum - pm)]);
  });
  return _csv(filas);
}

function _csvCert(d, c) {
  var rubros = {};
  (d.rubros || []).forEach(function (r) { rubros[r.id] = r.label; });
  var enc = ['Rubro', 'N°', 'Descripción', 'Importe vigente', '% anterior', 'Monto anterior',
             '% presente', 'Monto presente', '% acumulado', 'Monto acumulado'];
  function fila(it) {
    var imp = +it.importe_actual || 0;
    return [rubros[it.grupo] || it.grupo, it.n, it.desc, _num(imp),
      _pct(it.pct_ant), _num(imp * it.pct_ant), _pct(it.pct_pres), _num(imp * it.pct_pres),
      _pct(it.pct_acum), _num(imp * it.pct_acum)];
  }
  var t = _tot(c.items_c), m = _tot(c.items_mo);
  var filas = [[c.label + ' — medición ' + _fecha(c.fecha_medicion) + ' — pago ' + _fecha(c.fecha_pago)], [],
               ['CLIENTE'], enc];
  (c.items_c || []).forEach(function (it) { filas.push(fila(it)); });
  filas.push(['TOTAL', '', '', _num(t.base), '', _num(t.ant), '', _num(t.pres), '', _num(t.acum)]);
  filas.push(['Pagado hasta el momento', '', '', '', '', '', '', '', '', _num(c.pagado_anterior)]);
  filas.push(['MONTO A PAGAR', '', '', '', '', '', '', '', '', _num(t.acum - (+c.pagado_anterior || 0))]);
  filas.push([], ['MANO DE OBRA (uso interno)'], enc);
  (c.items_mo || []).forEach(function (it) { filas.push(fila(it)); });
  filas.push(['TOTAL', '', '', _num(m.base), '', _num(m.ant), '', _num(m.pres), '', _num(m.acum)]);
  return _csv(filas);
}

function _info(d, obraName) {
  var ult = (d.certs || [])[(d.certs || []).length - 1] || {};
  return {
    id: d.id, nombre: obraName,
    certs: (d.certs || []).length, ultimo: ult.label || '',
    actualizado: d.actualizado || new Date().toISOString(),
    subido: new Date().toISOString()
  };
}

// ─── HISTORIAL ─────────────────────────────────────────────────────

function _versiones(carpetaHist) {
  var lista = [], it = carpetaHist.getFiles();
  while (it.hasNext()) lista.push(it.next());
  lista.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; });
  return lista;
}

function _guardarVersion(carpeta, datosTxt, d, hito) {
  var hist = _sub(carpeta, 'historial');
  var vers = _versiones(hist);
  var ahora = new Date();
  if (!hito && vers.length) {
    var min = (ahora - vers[0].getDateCreated()) / 60000;
    if (min < MIN_ENTRE_VERSIONES) return;
  }
  var tz = Session.getScriptTimeZone();
  var nombre = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd_HHmmss') + (hito ? '_manual' : '') + '.json';
  var f = hist.createFile(Utilities.newBlob(datosTxt, 'application/json', nombre));
  var ult = (d.certs || [])[(d.certs || []).length - 1] || {};
  f.setDescription(JSON.stringify({ certs: (d.certs || []).length, ultimo: ult.label || '' }));
  vers.slice(MAX_VERSIONES - 1).forEach(function (v) { v.setTrashed(true); });
}

// ─── GUARDAR ───────────────────────────────────────────────────────

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) {
    return _json({ ok: false, error: 'Servidor ocupado.' });
  }
  try {
    var body = JSON.parse(e.postData.contents);
    if (String(body.secreto || '') !== SECRETO)
      return _json({ ok: false, error: 'Clave incorrecta.' });

    var d = body.data || {};
    var obraId = String(body.obraId || d.id || '');
    if (!obraId || !d.certs) return _json({ ok: false, error: 'Faltan datos de la obra.' });
    var obraName = String(body.obraName || 'Obra sin nombre');
    var carpeta = _carpetaObra(obraId, obraName);
    var datosTxt = JSON.stringify(d);

    // Antes de pisar datos.json, la versión anterior queda en el historial
    var previo = _archivo(carpeta, 'datos.json');
    if (previo) {
      var prevTxt = previo.getBlob().getDataAsString();
      if (prevTxt !== datosTxt) {
        try { _guardarVersion(carpeta, prevTxt, JSON.parse(prevTxt), false); } catch (err) {}
      }
    }
    _escribir(carpeta, 'datos.json', datosTxt);
    _escribir(carpeta, 'info.json', JSON.stringify(_info(d, obraName)));
    if (body.hito) _guardarVersion(carpeta, datosTxt, d, true);

    // Si falla algún CSV, el respaldo real ya quedó guardado arriba
    try {
      _escribir(carpeta, 'resumen.csv', _csvResumen(d), 'text/csv');
      var certsF = _sub(carpeta, 'certificados');
      var viejos = certsF.getFiles();
      while (viejos.hasNext()) viejos.next().setTrashed(true);
      (d.certs || []).forEach(function (c, i) {
        var n = ('0' + (i + 1)).slice(-2) + ' - ' + _limpio(c.label) + '.csv';
        certsF.createFile(Utilities.newBlob(_csvCert(d, c), 'text/csv', n));
      });
    } catch (err) { console.error('csv: ' + err); }

    return _json({ ok: true, carpeta: carpeta.getName(), fecha: new Date().toISOString() });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ─── LEER ──────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var accion = p.action || 'ping';
    if (String(p.secreto || '') !== SECRETO)
      return _json({ ok: false, error: 'Clave incorrecta.' });

    if (accion === 'ping')
      return _json({ ok: true, mensaje: 'ObraCertif Drive API activa', version: 1 });

    if (accion === 'list') {
      var obras = [], it = _raiz().getFolders();
      while (it.hasNext()) {
        var c = it.next();
        try {
          var inf = _archivo(c, 'info.json');
          if (inf) obras.push(JSON.parse(inf.getBlob().getDataAsString()));
        } catch (err) {}
      }
      obras.sort(function (a, b) { return (b.actualizado || '') < (a.actualizado || '') ? -1 : 1; });
      return _json({ ok: true, obras: obras });
    }

    var carpeta = _buscarObra(String(p.obraId || ''));
    if (!carpeta) return _json({ ok: false, error: 'Obra no encontrada.' });

    if (accion === 'load') {
      var f = _archivo(carpeta, 'datos.json');
      return f ? _json({ ok: true, data: JSON.parse(f.getBlob().getDataAsString()) })
               : _json({ ok: false, error: 'La obra no tiene datos.' });
    }

    if (accion === 'versiones') {
      var lista = _versiones(_sub(carpeta, 'historial')).map(function (v) {
        var extra = {};
        try { extra = JSON.parse(v.getDescription() || '{}'); } catch (err) {}
        return { archivo: v.getName(), fecha: v.getDateCreated().toISOString(),
                 hito: v.getName().indexOf('_manual') > -1, certs: extra.certs, ultimo: extra.ultimo };
      });
      return _json({ ok: true, versiones: lista });
    }

    if (accion === 'loadVersion') {
      var v = _archivo(_sub(carpeta, 'historial'), String(p.archivo || ''));
      return v ? _json({ ok: true, data: JSON.parse(v.getBlob().getDataAsString()) })
               : _json({ ok: false, error: 'Versión no encontrada.' });
    }

    return _json({ ok: false, error: 'Acción desconocida: ' + accion });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
