// Prueba del sincronizador de FEMAVI para la PC de la oficina (Windows 7, Node 12).
// SOLO LEE: no escribe nada en el sistema ni sube datos a la web.
//  1. Busca los archivos del sistema (G:\ o \\SRVFEM\Aplicaciones).
//  2. Los lee y cuenta clientes, articulos y facturas; muestra la ultima factura.
//  3. Prueba que la PC pueda conectarse de forma segura con la base de datos.
// El resultado queda en resultado.txt, al lado de este archivo.
'use strict';
var fs = require('fs');
var path = require('path');
var https = require('https');

var lineas = [];
function decir(s) { console.log(s); lineas.push(s); }
function guardar() {
  try { fs.writeFileSync(path.join(__dirname, 'resultado.txt'), lineas.join('\r\n') + '\r\n'); } catch (e) { /* nada */ }
}

var ARCHIVOS = ['MAECLI', 'MAEART', 'HISTPEDI', 'HISDEPED'];

function buscarCarpeta() {
  var candidatas = [];
  if (process.argv[2]) candidatas.push(process.argv[2]);
  candidatas.push('G:\\', '\\\\SRVFEM\\Aplicaciones\\');
  for (var i = 0; i < candidatas.length; i++) {
    var c = candidatas[i];
    try {
      if (fs.existsSync(path.join(c, 'HISTPEDI'))) return c;
      // Por si estan un nivel mas adentro.
      var subs = fs.readdirSync(c);
      for (var j = 0; j < subs.length; j++) {
        var s = path.join(c, subs[j]);
        try { if (fs.existsSync(path.join(s, 'HISTPEDI'))) return s; } catch (e) { /* sin permiso */ }
      }
    } catch (e) {
      decir('  (no se pudo abrir ' + c + ': ' + e.code + ')');
    }
  }
  return null;
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

function esperar(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

/**
 * Lee el archivo de a 1 MB. En Windows 7 leer de la red un archivo grande de un
 * solo golpe falla; y si el sistema tiene un tramo bloqueado mientras factura,
 * se reintenta ese tramo unas veces antes de rendirse.
 */
function leerArchivo(ruta) {
  var TRAMO = 1024 * 1024;
  var fd = fs.openSync(ruta, 'r');
  try {
    var largo = fs.fstatSync(fd).size;
    var buf = Buffer.alloc(largo);
    var pos = 0, reintentos = 0;
    while (pos < largo) {
      try {
        var n = fs.readSync(fd, buf, pos, Math.min(TRAMO, largo - pos), pos);
        if (n === 0) break;
        pos += n;
        reintentos = 0;
      } catch (e) {
        if (++reintentos > 10) {
          e.message = e.message + ' (en el byte ' + pos + ' de ' + largo + ', errno ' + e.errno + ')';
          throw e;
        }
        esperar(500);
      }
    }
    return pos === largo ? buf : buf.subarray(0, pos);
  } finally {
    fs.closeSync(fd);
  }
}

/** Recorre los registros de un archivo sin guardarlos todos en memoria. */
function porCadaRegistro(ruta, h, fn) {
  var f = leerArchivo(ruta);
  var L = f.readUInt16BE(16);
  var B = recorrer(f, 512, h, null) >= recorrer(f, 1024, h, null) ? 512 : 1024;
  var ok = 0, malos = 0;
  recorrer(f, B, h, function (comp) {
    var r = expandir(comp);
    if (r.length === L) { ok++; fn(r); } else malos++;
  });
  return { ok: ok, malos: malos, B: B, L: L };
}

function fecha(r, a) {
  var s = r.toString('latin1', a, a + 8);
  return /^(19|20)\d{6}$/.test(s) ? s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4) : null;
}
function empaquetado(buf, dec) {
  var s = '';
  for (var i = 0; i < buf.length; i++) s += (buf[i] >> 4).toString(16) + (buf[i] & 0x0F).toString(16);
  var signo = s.slice(-1), dig = s.slice(0, -1);
  if (!/^[0-9]+$/.test(dig)) return null;
  var n = Number(dig) / Math.pow(10, dec);
  return signo === 'd' ? -n : n;
}
function texto(r, a, b) {
  return r.toString('latin1', a, b).replace(/[^\x20-\x7E]/g, ' ').trim();
}

function probarArchivos(dir) {
  decir('');
  decir('1) ARCHIVOS en ' + dir);
  for (var i = 0; i < ARCHIVOS.length; i++) {
    var ruta = path.join(dir, ARCHIVOS[i]);
    try {
      var st = fs.statSync(ruta);
      decir('   ' + ARCHIVOS[i] + ': ' + (st.size / 1048576).toFixed(1) + ' MB, modificado ' + st.mtime.toLocaleString());
    } catch (e) {
      decir('   ' + ARCHIVOS[i] + ': NO ENCONTRADO (' + e.code + ')');
      return false;
    }
  }

  decir('');
  decir('2) LECTURA');
  var t0 = Date.now(), total = 0;
  try {
    var cli = porCadaRegistro(path.join(dir, 'MAECLI'), 8, function () {});
    decir('   Clientes: ' + cli.ok + (cli.malos ? ' (' + cli.malos + ' ilegibles)' : ''));
    var art = porCadaRegistro(path.join(dir, 'MAEART'), 8, function () {});
    decir('   Articulos: ' + art.ok);

    var ultima = null;
    // Hay fechas cargadas mal en el sistema (ej. 2099): se ignoran las futuras.
    var d = new Date(), hoy = String(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
    var com = porCadaRegistro(path.join(dir, 'HISTPEDI'), 4, function (r) {
      var clave = r.toString('latin1', 0, 13);
      if (!/^\d{12}/.test(clave)) return;
      var f = r.toString('latin1', 18, 26);
      if (/^(19|20)\d{6}$/.test(f) && f <= hoy && (!ultima || f > ultima.f || (f === ultima.f && clave > ultima.clave))) {
        ultima = { f: f, clave: clave, cliente: texto(r, 13, 18), total: empaquetado(r.subarray(87, 93), 2) };
      }
    });
    decir('   Comprobantes: ' + com.ok);
    if (ultima) {
      decir('   Ultimo comprobante: ' + fecha(Buffer.from(ultima.f), 0) + ' - pedido ' + ultima.clave.slice(0, 6) +
        ' - comprobante ' + ultima.clave.slice(6, 12) + ' tipo ' + ultima.clave[12] +
        ' - cliente ' + ultima.cliente + ' - $ ' + (ultima.total === null ? '?' : ultima.total.toFixed(2)));
    }
    var ren = porCadaRegistro(path.join(dir, 'HISDEPED'), 4, function () {});
    decir('   Renglones: ' + ren.ok);
    total = Date.now() - t0;
    decir('   Tiempo de lectura: ' + (total / 1000).toFixed(1) + ' segundos. Memoria usada: ' +
      Math.round(process.memoryUsage().rss / 1048576) + ' MB');
    return true;
  } catch (e) {
    decir('   ERROR leyendo: ' + (e.code || '') + ' ' + e.message + (e.errno !== undefined ? ' [errno ' + e.errno + ']' : ''));
    return false;
  }
}

function probarConexion(listo) {
  decir('');
  decir('3) CONEXION con la base de datos');
  var req = https.get('https://lhqawwjszwjzxxsonvwa.supabase.co/rest/v1/', { timeout: 20000 }, function (res) {
    // Cualquier respuesta (aunque sea "sin permiso") prueba que la conexion segura funciona.
    decir('   OK: conexion segura establecida (respuesta ' + res.statusCode + ').');
    res.resume();
    listo(true);
  });
  req.on('timeout', function () { req.destroy(new Error('se agoto el tiempo de espera')); });
  req.on('error', function (e) {
    decir('   FALLO: ' + (e.code || '') + ' ' + e.message);
    listo(false);
  });
}

decir('PRUEBA DEL SINCRONIZADOR FEMAVI - ' + new Date().toLocaleString());
decir('Windows ' + require('os').release() + ' ' + process.arch + ', Node ' + process.version);
var dir = buscarCarpeta();
var archivosOk = false;
if (!dir) {
  decir('');
  decir('1) ARCHIVOS: NO SE ENCONTRO HISTPEDI ni en G:\\ ni en \\\\SRVFEM\\Aplicaciones.');
} else {
  archivosOk = probarArchivos(dir);
}
probarConexion(function (conexionOk) {
  decir('');
  decir(archivosOk && conexionOk ? 'RESULTADO: TODO BIEN. Esta PC sirve para sincronizar.' : 'RESULTADO: HAY PROBLEMAS, mandale este texto a Claude.');
  decir('(Este texto quedo guardado en resultado.txt)');
  guardar();
});
