// Sincronizador del sistema viejo de FEMAVI -> base de datos de la web.
// Corre cada 15 minutos en la PC de la oficina (Windows 7, Node 12).
//
//  - SOLO LEE los archivos del sistema (MAECLI, MAEART, HISTPEDI, HISDEPED).
//  - Si ningún archivo cambió desde la última pasada, no hace nada más que avisar
//    que sigue viva.
//  - Si cambió alguno, lo decodifica y sube SOLO las filas nuevas o modificadas.
//    Para saberlo guarda en estado.json una huella corta de cada fila ya subida.
//  - Se identifica con la clave de config.json, que solo sirve para cargar el
//    historial (no puede leer nada de la base).
//
// Uso: node sincronizar.js            sincroniza
//      node sincronizar.js --simular  calcula qué subiría, sin subir nada
'use strict';
var fs = require('fs');
var path = require('path');
var https = require('https');
var crypto = require('crypto');

var DIR = __dirname;
var SIMULAR = process.argv.indexOf('--simular') >= 0;
var CARPETA_ARG = process.argv.filter(function (a) { return a.indexOf('--carpeta=') === 0; })[0];
var LOTE = 1000;
var PUBLICA = 'sb_publishable_OVOrWR112Ot4EGUv8l_ZrQ_hjxR_LE9';   // clave pública de la web (no es secreta)
var URL_BASE = 'https://lhqawwjszwjzxxsonvwa.supabase.co';

// ── Registro ──
var RUTA_LOG = path.join(DIR, 'sincronizar.log');
function log(s) {
  var d = new Date();
  var linea = d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR') + '  ' + s;
  console.log(linea);
  try {
    fs.appendFileSync(RUTA_LOG, linea + '\r\n');
    if (fs.statSync(RUTA_LOG).size > 2 * 1048576) {        // que no crezca para siempre
      var t = fs.readFileSync(RUTA_LOG, 'utf8');
      fs.writeFileSync(RUTA_LOG, t.slice(t.length / 2));
    }
  } catch (e) { /* si no se puede escribir el log, se sigue igual */ }
}

// ── Una sola pasada a la vez ──
var RUTA_CANDADO = path.join(DIR, 'sincronizar.lock');
function tomarCandado() {
  try {
    var st = fs.statSync(RUTA_CANDADO);
    if (Date.now() - st.mtimeMs < 3 * 3600 * 1000) return false;   // otra pasada en curso
  } catch (e) { /* no hay candado */ }
  fs.writeFileSync(RUTA_CANDADO, String(process.pid));
  return true;
}
function soltarCandado() { try { fs.unlinkSync(RUTA_CANDADO); } catch (e) { /* ya no estaba */ } }

// ── Lectura de archivos de a 1 MB (en Windows 7 leer 46 MB de la red de golpe falla) ──
function esperar(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function leerArchivo(ruta) {
  var TRAMO = 1048576, fd = fs.openSync(ruta, 'r');
  try {
    var largo = fs.fstatSync(fd).size, buf = Buffer.alloc(largo), pos = 0, reintentos = 0;
    while (pos < largo) {
      try {
        var n = fs.readSync(fd, buf, pos, Math.min(TRAMO, largo - pos), pos);
        if (n === 0) break;
        pos += n; reintentos = 0;
      } catch (e) {
        if (++reintentos > 10) throw e;
        esperar(500);
      }
    }
    return pos === largo ? buf : buf.subarray(0, pos);
  } finally { fs.closeSync(fd); }
}

// ── Decodificador RM/COBOL (mismo formato que scripts/legado/rmkf.mjs) ──
function expandir(d) {
  var out = [], i = 0;
  while (i < d.length) {
    var b = d[i++], k;
    if (b < 0x80) { for (k = 0; k < b; k++) out.push(d[i++]); }
    else if (b <= 0xBF) { for (k = 0; k < b - 0x7E; k++) out.push(0x20); }
    else if (b <= 0xCF) { for (k = 0; k < b - 0xBE; k++) out.push(0x30); }
    else if (b <= 0xE5) { for (k = 0; k < b - 0xD2; k++) out.push(0x00); }
    else { var c = d[i++]; for (k = 0; k < b - 0xE5; k++) out.push(c); }
  }
  return Buffer.from(out);
}
function recorrer(f, B, h, alRegistro) {
  var coincide = 0, bloques = 0;
  for (var base = B; base + B <= f.length; base += B) {
    if (f.readUInt16BE(base) !== 0x0006) continue;
    bloques++;
    var p = base + 8;
    while (p + h <= base + B) {
      var l = f.readUInt16BE(p + h - 2);
      if (!l || p + h + l > base + B) break;
      if (alRegistro) alRegistro(f.subarray(p + h, p + h + l));
      p += h + l;
    }
    if (p - base === f.readUInt16BE(base + 6)) coincide++;
  }
  return bloques ? coincide / bloques : 0;
}
function registros(ruta, h) {
  var f = leerArchivo(ruta), L = f.readUInt16BE(16), regs = [];
  var B = recorrer(f, 512, h, null) >= recorrer(f, 1024, h, null) ? 512 : 1024;
  recorrer(f, B, h, function (comp) { var r = expandir(comp); if (r.length === L) regs.push(r); });
  return regs;
}

// ── Campos (mismo mapa que scripts/legado/campos.mjs) ──
var CP850 = { 0x81: 'ü', 0x82: 'é', 0x90: 'É', 0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ',
  0xA6: 'ª', 0xA7: 'º', 0xB5: 'Á', 0xD6: 'Í', 0xE0: 'Ó', 0xE9: 'Ú', 0xF8: '°', 0x9A: 'Ü' };
function texto(r, a, b) {
  var s = '';
  for (var i = a; i < b; i++) {
    var x = r[i];
    s += x >= 32 && x < 127 ? String.fromCharCode(x) : (CP850[x] !== undefined ? CP850[x] : (x === 0 ? '' : ' '));
  }
  s = s.trim();
  return s === '' ? null : s;
}
function fecha(r, a) {
  var s = r.toString('latin1', a, a + 8);
  if (!/^(19|20)\d{6}$/.test(s)) return null;
  var y = Number(s.slice(0, 4)), m = Number(s.slice(4, 6)), d = Number(s.slice(6, 8));
  var f = new Date(Date.UTC(y, m - 1, d));      // descarta fechas imposibles (31/11)
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
}
function empaquetado(buf, dec) {
  var s = '';
  for (var i = 0; i < buf.length; i++) s += (buf[i] >> 4).toString(16) + (buf[i] & 0x0F).toString(16);
  var signo = s.slice(-1), dig = s.slice(0, -1);
  if (!/^[0-9]+$/.test(dig)) return null;
  var n = Number(dig) / Math.pow(10, dec);
  return signo === 'd' ? -n : n;
}
function num(r, a, b, dec) { return empaquetado(r.subarray(a, b), dec); }

// Cada tabla: archivo, largo de cabecera, cómo se arma la fila y cuál es su clave.
var TABLAS = [
  { tabla: 'articulos', archivo: 'MAEART', h: 8, clave: function (x) { return x.codigo; }, fila: function (r) {
    var codigo = texto(r, 0, 5);
    return codigo && { codigo: codigo, familia: texto(r, 5, 9), descripcion: texto(r, 9, 34) };
  } },
  { tabla: 'clientes', archivo: 'MAECLI', h: 8, clave: function (x) { return x.codigo; }, fila: function (r) {
    var codigo = texto(r, 0, 5);
    return codigo && {
      codigo: codigo, razon_social: texto(r, 5, 40), cuit: texto(r, 40, 51), domicilio: texto(r, 56, 86),
      localidad: texto(r, 86, 106), provincia: texto(r, 106, 108), iva: texto(r, 108, 109), zona: texto(r, 112, 115),
      vendedor: texto(r, 115, 118), expreso: texto(r, 118, 121), telefonos: texto(r, 121, 166), otros: texto(r, 166, 196),
      cuit_formateado: texto(r, 196, 211), fecha_alta: fecha(r, 252), entrega_domicilio: texto(r, 268, 298),
      entrega_localidad: texto(r, 298, 318), entrega_provincia: texto(r, 318, 320), entrega_telefono: texto(r, 320, 340),
      paga_flete: texto(r, 340, 341), cod_proveedor: texto(r, 341, 351), resp_compras: texto(r, 351, 381),
      cond_pago: texto(r, 391, 393),
    };
  } },
  { tabla: 'comprobantes', archivo: 'HISTPEDI', h: 4, clave: function (x) { return x.clave; }, fila: function (r) {
    var clave = r.toString('latin1', 0, 13);
    if (!/^\d{12}/.test(clave)) return null;
    return { clave: clave, pedido: Number(clave.slice(0, 6)), comprobante: Number(clave.slice(6, 12)),
      tipo: clave[12].trim() || null, cliente: texto(r, 13, 18), fecha: fecha(r, 18), total: num(r, 87, 93, 2) };
  } },
  { tabla: 'renglones', archivo: 'HISDEPED', h: 4, clave: function (x) { return x.clave + '|' + x.linea; }, fila: function (r) {
    var clave = r.toString('latin1', 0, 13), linea = Number(r.toString('latin1', 13, 15));
    if (!/^\d{12}/.test(clave) || !isFinite(linea)) return null;
    return { clave: clave, linea: linea, articulo: texto(r, 23, 28), cantidad: num(r, 33, 37, 1),
      envase: num(r, 37, 40, 0), kilos: num(r, 40, 45, 2), precio: num(r, 45, 51, 2), importe: num(r, 51, 58, 2) };
  } },
];

// ── Estado local: qué se subió ya ──
var RUTA_ESTADO = path.join(DIR, 'estado.json');
function leerEstado() {
  try { return JSON.parse(fs.readFileSync(RUTA_ESTADO, 'utf8')); }
  catch (e) { return { archivos: {}, huellas: {} }; }
}
function guardarEstado(estado) {
  var tmp = RUTA_ESTADO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado));
  fs.renameSync(tmp, RUTA_ESTADO);          // se reemplaza de una: nunca queda a medio escribir
}
function huella(fila) { return crypto.createHash('md5').update(JSON.stringify(fila)).digest('base64').slice(0, 10); }

// ── Llamadas a la base ──
function rpc(funcion, cuerpo) {
  return new Promise(function (ok, mal) {
    var datos = Buffer.from(JSON.stringify(cuerpo), 'utf8');
    var req = https.request(URL_BASE + '/rest/v1/rpc/' + funcion, {
      method: 'POST', timeout: 60000,
      headers: { apikey: PUBLICA, 'Content-Type': 'application/json', 'Content-Length': datos.length },
    }, function (res) {
      var partes = [];
      res.on('data', function (c) { partes.push(c); });
      res.on('end', function () {
        var txt = Buffer.concat(partes).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) return ok(txt ? JSON.parse(txt) : null);
        var e = new Error('HTTP ' + res.statusCode + ' ' + txt.slice(0, 300));
        e.definitivo = res.statusCode === 401 || res.statusCode === 403 || txt.indexOf('no autorizado') >= 0;
        mal(e);
      });
    });
    req.on('timeout', function () { req.destroy(new Error('se agoto el tiempo de espera')); });
    req.on('error', mal);
    req.end(datos);
  });
}
function conReintentos(fn, intentos) {
  return fn().catch(function (e) {
    if (e.definitivo || intentos <= 1) throw e;
    esperar(5000);
    return conReintentos(fn, intentos - 1);
  });
}

function buscarCarpeta(config) {
  var candidatas = [];
  if (CARPETA_ARG) candidatas.push(CARPETA_ARG.slice('--carpeta='.length));
  (config.carpetas || ['G:\\', '\\\\SRVFEM\\Aplicaciones\\']).forEach(function (c) { candidatas.push(c); });
  for (var i = 0; i < candidatas.length; i++) {
    try { if (fs.existsSync(path.join(candidatas[i], 'HISTPEDI'))) return candidatas[i]; } catch (e) { /* sigue */ }
  }
  return null;
}

// ── Una pasada ──
function sincronizarTabla(t, dir, estado, config) {
  var ruta = path.join(dir, t.archivo);
  var st = fs.statSync(ruta);
  var firma = st.size + '|' + st.mtimeMs;
  if (estado.archivos[t.archivo] === firma) return Promise.resolve(0);

  var huellas = estado.huellas[t.tabla] || (estado.huellas[t.tabla] = {});
  var porClave = {};                       // si una clave aparece dos veces, queda la última (como en la carga inicial)
  registros(ruta, t.h).forEach(function (r) {
    var fila = t.fila(r);
    if (fila) porClave[t.clave(fila)] = fila;
  });
  var cambios = [];
  Object.keys(porClave).forEach(function (k) {
    var h = huella(porClave[k]);
    if (huellas[k] !== h) cambios.push({ k: k, h: h, fila: porClave[k] });
  });
  porClave = null;

  if (cambios.length === 0 || SIMULAR) {
    if (cambios.length) log('  ' + t.tabla + ': ' + cambios.length + ' filas para subir (simulado, no se sube nada)');
    if (!SIMULAR) { estado.archivos[t.archivo] = firma; guardarEstado(estado); }
    return Promise.resolve(cambios.length);
  }

  log('  ' + t.tabla + ': ' + cambios.length + ' filas nuevas o modificadas, subiendo...');
  var i = 0;
  function siguiente() {
    if (i >= cambios.length) {
      estado.archivos[t.archivo] = firma;
      guardarEstado(estado);
      return Promise.resolve(cambios.length);
    }
    var lote = cambios.slice(i, i + LOTE);
    return conReintentos(function () {
      return rpc('hist_sync_subir', { p_key: config.clave_sync, p_tabla: t.tabla, p_filas: lote.map(function (c) { return c.fila; }) });
    }, 4).then(function () {
      lote.forEach(function (c) { huellas[c.k] = c.h; });
      i += LOTE;
      if (i % 20000 === 0 || i >= cambios.length) {
        guardarEstado(estado);             // si se corta, la próxima pasada sigue desde acá
        if (cambios.length > LOTE) log('    ' + Math.min(i, cambios.length) + ' / ' + cambios.length);
      }
      return siguiente();
    });
  }
  return siguiente();
}

function principal() {
  var config;
  try { config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')); } catch (e) { config = null; }
  if (!SIMULAR && (!config || !config.clave_sync)) {
    log('FALTA LA CLAVE: primero hay que correr CONFIGURAR.bat.');
    process.exitCode = 1;
    return;
  }
  config = config || {};
  if (!tomarCandado()) { log('Ya hay una sincronizacion en curso; esta pasada se saltea.'); return; }

  var dir = buscarCarpeta(config);
  if (!dir) { log('ERROR: no se encuentran los archivos del sistema (G:\\ ni \\\\SRVFEM\\Aplicaciones).'); soltarCandado(); process.exitCode = 1; return; }

  var estado = leerEstado(), total = 0, t0 = Date.now();
  var cadena = Promise.resolve();
  TABLAS.forEach(function (t) {
    cadena = cadena.then(function () { return sincronizarTabla(t, dir, estado, config); })
      .then(function (n) { total += n; });
  });
  cadena
    .then(function () { return SIMULAR ? null : conReintentos(function () { return rpc('hist_sync_latido', { p_key: config.clave_sync }); }, 3); })
    .then(function () {
      var seg = ((Date.now() - t0) / 1000).toFixed(0);
      if (total || SIMULAR) log('OK: ' + total + ' filas ' + (SIMULAR ? 'para subir (simulado)' : 'subidas') + ' en ' + seg + ' s.');
      else log('OK: sin cambios (' + seg + ' s).');
    })
    .catch(function (e) {
      log('ERROR: ' + (e.code || '') + ' ' + e.message);
      if (e.definitivo) log('La base rechazo la clave: hay que registrar la huella de CONFIGURAR.bat.');
      process.exitCode = 1;
    })
    .then(soltarCandado);
}

principal();
