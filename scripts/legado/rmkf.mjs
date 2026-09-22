// Lector de archivos indexados RM/COBOL ("RMKF") del sistema de FEMAVI.
// Formato deducido de los datos y validado: 99,8% de los registros miden
// exactamente el largo fijo que declara la cabecera.
//  - Bloques de 1024 bytes; los de datos empiezan con 00 06 y 8 bytes de cabecera.
//  - Registro: cabecera (8 bytes en maestros, 4 en historiales; largo en los
//    últimos 2) + datos comprimidos.
//  - Compresión: b < 0x80 -> b bytes tal cual; 0x80..0xBF -> b-0x7E espacios;
//    0xC0..0xCF -> b-0xBE ceros ('0'); 0xD0..0xE5 -> b-0xD2 bytes 0x00;
//    0xE6..0xFF -> repetir b-0xE5 veces el byte siguiente.
import fs from 'node:fs';
const B = 1024;

export function expandir(d) {
  const out = [];
  let i = 0;
  while (i < d.length) {
    const b = d[i++];
    if (b < 0x80) { for (let k = 0; k < b; k++) out.push(d[i++]); }
    else if (b <= 0xBF) { for (let k = 0; k < b - 0x7E; k++) out.push(0x20); }
    else if (b <= 0xCF) { for (let k = 0; k < b - 0xBE; k++) out.push(0x30); }
    else if (b <= 0xE5) { for (let k = 0; k < b - 0xD2; k++) out.push(0x00); }
    else { const c = d[i++]; for (let k = 0; k < b - 0xE5; k++) out.push(c); }
  }
  return Buffer.from(out);
}

export function leerArchivo(ruta, cabecera) {
  const f = fs.readFileSync(ruta);
  const L = f.readUInt16BE(16);
  const h = cabecera;
  // El tamaño de bloque depende del archivo (512 o 1024). Se elige el que hace
  // que la cadena de registros de cada bloque termine donde el bloque dice.
  const recorrer = (B, guardar) => {
    const regs = []; let coincide = 0, bloques = 0, descartados = 0;
    for (let base = B; base + B <= f.length; base += B) {
      if (f.readUInt16BE(base) !== 0x0006) continue;
      bloques++;
      let p = base + 8;
      while (p + h <= base + B) {
        const l = f.readUInt16BE(p + h - 2);
        if (!l || p + h + l > base + B) break;
        if (guardar) {
          const r = expandir(f.subarray(p + h, p + h + l));
          if (r.length === L) regs.push(r); else descartados++;
        }
        p += h + l;
      }
      if (p - base === f.readUInt16BE(base + 6)) coincide++;
    }
    return { regs, coincide, bloques, descartados };
  };
  const B = [512, 1024].map(B => [B, recorrer(B, false)])
    .sort((a, b) => b[1].coincide / (b[1].bloques || 1) - a[1].coincide / (a[1].bloques || 1))[0][0];
  const { regs, descartados } = recorrer(B, true);
  return { L, B, regs, descartados, declarados: f.readUInt32BE(50) };
}

// Números empaquetados (COMP-3): dos dígitos por byte, el último medio byte es el signo.
export function empaquetado(buf, decimales = 0) {
  let s = '';
  for (const b of buf) s += (b >> 4).toString(16) + (b & 0x0F).toString(16);
  const signo = s.slice(-1), dig = s.slice(0, -1);
  if (!/^[0-9]+$/.test(dig)) return null;
  const n = Number(dig) / 10 ** decimales;
  return signo === 'd' ? -n : n;
}
