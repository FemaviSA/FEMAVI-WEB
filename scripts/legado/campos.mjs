// Mapa de campos del sistema viejo de FEMAVI (RM/COBOL), deducido y verificado
// contra fotos de la pantalla del sistema (clientes 00004 CONVEYORS y 19917 TGS).
import { leerArchivo, empaquetado } from './rmkf.mjs';

// Codificación de DOS (CP850) -> Unicode, solo lo que usa el castellano.
const CP850 = { 0x81: 'ü', 0x82: 'é', 0x90: 'É', 0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ',
  0xA6: 'ª', 0xA7: 'º', 0xB5: 'Á', 0xD6: 'Í', 0xE0: 'Ó', 0xE9: 'Ú', 0xF8: '°', 0x9A: 'Ü' };
const texto = (r, a, b) => {
  let s = '';
  for (const x of r.subarray(a, b)) s += x >= 32 && x < 127 ? String.fromCharCode(x) : (CP850[x] ?? (x === 0 ? '' : ' '));
  const t = s.trim();
  return t === '' ? null : t;
};
const fecha = (r, a) => {
  const s = r.toString('latin1', a, a + 8);
  if (!/^(19|20)\d{6}$/.test(s)) return null;
  const y = Number(s.slice(0, 4)), m = Number(s.slice(4, 6)), d = Number(s.slice(6, 8));
  // El sistema viejo tiene fechas imposibles (ej. 31/11/1996): se descartan.
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
};
const num = (r, a, b, dec) => empaquetado(r.subarray(a, b), dec);

export function clientes(dir) {
  const porCodigo = new Map();
  for (const r of leerArchivo(dir + '/MAECLI', 8).regs) {
    const codigo = texto(r, 0, 5);
    if (!codigo) continue;
    porCodigo.set(codigo, {           // si un código aparece dos veces, queda la última versión
      codigo,
      razon_social: texto(r, 5, 40),
      cuit: texto(r, 40, 51),
      domicilio: texto(r, 56, 86),
      localidad: texto(r, 86, 106),
      provincia: texto(r, 106, 108),
      iva: texto(r, 108, 109),
      zona: texto(r, 112, 115),
      vendedor: texto(r, 115, 118),
      expreso: texto(r, 118, 121),
      telefonos: texto(r, 121, 166),
      otros: texto(r, 166, 196),
      cuit_formateado: texto(r, 196, 211),
      fecha_alta: fecha(r, 252),
      entrega_domicilio: texto(r, 268, 298),
      entrega_localidad: texto(r, 298, 318),
      entrega_provincia: texto(r, 318, 320),
      entrega_telefono: texto(r, 320, 340),
      paga_flete: texto(r, 340, 341),
      cod_proveedor: texto(r, 341, 351),
      resp_compras: texto(r, 351, 381),
      cond_pago: texto(r, 391, 393),
    });
  }
  return [...porCodigo.values()];
}

export function articulos(dir) {
  const m = new Map();
  for (const r of leerArchivo(dir + '/MAEART', 8).regs) {
    const codigo = texto(r, 0, 5);
    if (codigo) m.set(codigo, { codigo, familia: texto(r, 5, 9), descripcion: texto(r, 9, 34) });
  }
  return [...m.values()];
}

export function comprobantes(dir) {
  const m = new Map();
  for (const r of leerArchivo(dir + '/HISTPEDI', 4).regs) {
    const clave = r.toString('latin1', 0, 13);
    if (!/^\d{12}/.test(clave)) continue;
    m.set(clave, {
      clave,
      pedido: Number(clave.slice(0, 6)),
      comprobante: Number(clave.slice(6, 12)),
      tipo: clave[12].trim() || null,
      cliente: texto(r, 13, 18),
      fecha: fecha(r, 18),
      total: num(r, 87, 93, 2),
    });
  }
  return [...m.values()];
}

export function renglones(dir) {
  const m = new Map();
  for (const r of leerArchivo(dir + '/HISDEPED', 4).regs) {
    const clave = r.toString('latin1', 0, 13);
    const linea = Number(r.toString('latin1', 13, 15));
    if (!/^\d{12}/.test(clave) || !Number.isFinite(linea)) continue;
    m.set(clave + '|' + linea, {
      clave, linea,
      articulo: texto(r, 23, 28),
      cantidad: num(r, 33, 37, 1),
      envase: num(r, 37, 40, 0),
      kilos: num(r, 40, 45, 2),
      precio: num(r, 45, 51, 2),
      importe: num(r, 51, 58, 2),
    });
  }
  return [...m.values()];
}
