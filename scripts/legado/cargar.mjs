// Carga el historial del sistema viejo (RM/COBOL) en las tablas hist_* de Supabase.
//
// Los archivos (MAECLI, MAEART, HISTPEDI, HISDEPED) se copian a mano desde
// \SRVFEM\Aplicaciones\TRABAJO a una carpeta local. Nunca se leen en el servidor.
//
// La carga necesita una puerta temporal, porque las tablas hist_* no aceptan
// escrituras desde la web:
//   1. Generar una clave de un solo uso y guardarla en un archivo local (no en el repo).
//   2. Crear public.hist_importar(p_clave, p_tabla, p_filas) security definer, que
//      compara sha256(p_clave) con el hash de esa clave (ver el historial de
//      migraciones: "hist_importar_temporal"), con execute solo para anon.
//   3. node scripts/legado/cargar.mjs <carpeta-de-archivos> <.env> <archivo-de-clave>
//   4. Borrar la función y la clave apenas termina.
//
// Uso: node cargar.mjs <dir> <ruta .env> <ruta clave>
import fs from 'node:fs';
import { clientes, articulos, comprobantes, renglones } from './campos.mjs';

const [dir, envPath, clavePath] = process.argv.slice(2);
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const CLAVE = fs.readFileSync(clavePath, 'utf8').trim();

async function llamar(tabla, filas) {
  for (let intento = 1; intento <= 4; intento++) {
    const r = await fetch(URL + '/rest/v1/rpc/hist_importar', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_clave: CLAVE, p_tabla: tabla, p_filas: filas }),
    });
    if (r.ok) return Number(await r.text());
    const err = await r.text();
    if (intento === 4) throw new Error(tabla + ': ' + r.status + ' ' + err.slice(0, 300));
    await new Promise(res => setTimeout(res, 2000 * intento));
  }
}

// Tandas chicas: el rol anon tiene un límite de tiempo por consulta.
const TANDA = 1500;
async function subir(nombre, filas) {
  let insertadas = 0;
  for (let i = 0; i < filas.length; i += TANDA) insertadas += await llamar(nombre, filas.slice(i, i + TANDA));
  console.log('OK', nombre, 'insertadas', insertadas, 'de', filas.length);
}

await llamar('vaciar', null);
await subir('clientes', clientes(dir));
await subir('articulos', articulos(dir));
await subir('comprobantes', comprobantes(dir));
await subir('renglones', renglones(dir));
