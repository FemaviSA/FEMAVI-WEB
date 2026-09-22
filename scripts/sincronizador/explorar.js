// Explorador de los archivos del sistema viejo de FEMAVI.
// SOLO LEE. Recorre G: (y una carpeta más adentro), reconoce los archivos con el
// formato del sistema (RM/COBOL indexado), y de cada uno informa tamaño, fecha,
// largo de registro, cuántos registros tiene y tres registros de muestra en texto.
// El resultado se manda a la base con la misma clave del sincronizador y queda
// guardado en exploracion.txt.
'use strict';
var fs = require('fs');
var path = require('path');
var https = require('https');

var DIR = __dirname;
var PUBLICA = 'sb_publishable_OVOrWR112Ot4EGUv8l_ZrQ_hjxR_LE9';
var URL_BASE = 'https://lhqawwjszwjzxxsonvwa.supabase.co';
var lineas = [];
function decir(s) { console.log(s); lineas.push(s); }

// ── Igual que el sincronizador ──
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
function leerArchivo(ruta) {
  var TRAMO = 1048576, fd = fs.openSync(ruta, 'r');
  try {
    var largo = fs.fstatSync(fd).size, buf = Buffer.alloc(largo), pos = 0, fallos = 0;
    while (pos < largo) {
      try {
        var n = fs.readSync(fd, buf, pos, Math.min(TRAMO, largo - pos), pos);
        if (n === 0) break;
        pos += n;
      } catch (e) {
        if (++fallos > 5) throw e;
      }
    }
    return buf.subarray(0, pos);
  } finally { fs.closeSync(fd); }
}
function visible(r) {
  var s = '';
  for (var i = 0; i < r.length && i < 160; i++) {
    var x = r[i];
    s += x >= 32 && x < 127 ? String.fromCharCode(x) : '.';
  }
  return s;
}

/** Los archivos del sistema arrancan con la marca "RMKF" en el byte 6. */
function esDelSistema(ruta, tam) {
  if (tam < 2048 || tam > 300 * 1048576) return false;
  var fd;
  try {
    fd = fs.openSync(ruta, 'r');
    var buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return buf.toString('latin1', 6, 10) === 'RMKF';
  } catch (e) {
    return false;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function analizar(ruta, nombre, st) {
  decir('');
  decir('=== ' + nombre + ' ===');
  decir('  ' + (st.size / 1048576).toFixed(2) + ' MB, modificado ' + st.mtime.toLocaleString());
  try {
    var f = leerArchivo(ruta);
    var L = f.readUInt16BE(16);
    decir('  largo de registro: ' + L + ', declarados en cabecera: ' + f.readUInt32BE(50));
    // Los maestros usan cabecera de 8 bytes y los historiales de 4: se prueban las dos.
    [8, 4].forEach(function (h) {
      var B = recorrer(f, 512, h, null) >= recorrer(f, 1024, h, null) ? 512 : 1024;
      var ok = 0, muestras = [];
      recorrer(f, B, h, function (comp) {
        var r = expandir(comp);
        if (r.length !== L) return;
        ok++;
        if (muestras.length < 3) muestras.push(visible(r));
      });
      decir('  cabecera ' + h + ' / bloque ' + B + ': ' + ok + ' registros');
      if (ok > 0) muestras.forEach(function (m, i) { decir('    ' + (i + 1) + ': ' + m); });
    });
  } catch (e) {
    decir('  no se pudo leer: ' + (e.code || '') + ' ' + e.message);
  }
}

function explorar(dir, nivel) {
  var entradas;
  try { entradas = fs.readdirSync(dir); } catch (e) { return; }
  var archivos = [], carpetas = [];
  entradas.forEach(function (nombre) {
    var ruta = path.join(dir, nombre), st;
    try { st = fs.statSync(ruta); } catch (e) { return; }
    if (st.isDirectory()) carpetas.push(ruta);
    else if (esDelSistema(ruta, st.size)) archivos.push({ ruta: ruta, nombre: path.join(dir, nombre), st: st });
  });
  archivos.sort(function (a, b) { return b.st.size - a.st.size; });
  archivos.forEach(function (a) { analizar(a.ruta, a.nombre, a.st); });
  if (nivel > 0) carpetas.forEach(function (c) { explorar(c, nivel - 1); });
}

function mandar(texto) {
  var config;
  try { config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')); } catch (e) { config = null; }
  if (!config || !config.clave_sync) { console.log('(sin clave: el resultado quedo solo en exploracion.txt)'); return; }
  var datos = Buffer.from(JSON.stringify({ p_key: config.clave_sync, p_asunto: 'exploracion de G:', p_texto: texto }), 'utf8');
  var req = https.request(URL_BASE + '/rest/v1/rpc/hist_sync_nota', {
    method: 'POST', timeout: 60000,
    headers: { apikey: PUBLICA, 'Content-Type': 'application/json', 'Content-Length': datos.length },
  }, function (res) {
    res.resume();
    console.log(res.statusCode < 300 ? 'Resultado enviado a Claude. Ya podes cerrar.' : 'No se pudo enviar (HTTP ' + res.statusCode + '); esta en exploracion.txt');
  });
  req.on('timeout', function () { req.destroy(); });
  req.on('error', function (e) { console.log('No se pudo enviar: ' + e.message + '; esta en exploracion.txt'); });
  req.end(datos);
}

decir('EXPLORACION DE ARCHIVOS DEL SISTEMA - ' + new Date().toLocaleString());
var raices = ['G:\\'];
try {
  var c = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
  if (c.carpetas) raices = c.carpetas;
} catch (e) { /* valores por defecto */ }
raices.forEach(function (r) {
  decir('');
  decir('--- en ' + r + ' ---');
  explorar(r, 1);
});

var texto = lineas.join('\r\n');
try { fs.writeFileSync(path.join(DIR, 'exploracion.txt'), texto); } catch (e) { /* nada */ }
mandar(texto.slice(0, 190000));
