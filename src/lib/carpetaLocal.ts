// Guardar un archivo directo en una carpeta de la PC (Chrome/Edge). La primera
// vez el navegador pide elegir la carpeta; queda recordada en este navegador y
// después solo pide confirmar el permiso. Donde no se puede, se descarga normal.

type Permiso = 'granted' | 'denied' | 'prompt';
interface Carpeta {
  name: string;
  queryPermission(o: { mode: 'readwrite' }): Promise<Permiso>;
  requestPermission(o: { mode: 'readwrite' }): Promise<Permiso>;
  getDirectoryHandle(nombre: string, o: { create: boolean }): Promise<Carpeta>;
  getFileHandle(nombre: string, o: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}
type ConSelector = Window & {
  showDirectoryPicker?: (o: { id?: string; mode: 'readwrite'; startIn?: string }) => Promise<Carpeta>;
};

const BASE = 'femavi-carpetas';
const TABLA = 'carpetas';

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function leer(clave: string): Promise<Carpeta | null> {
  try {
    const db = await abrir();
    return await new Promise(res => {
      const r = db.transaction(TABLA).objectStore(TABLA).get(clave);
      r.onsuccess = () => res((r.result as Carpeta) ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

async function recordar(clave: string, c: Carpeta) {
  try {
    const db = await abrir();
    db.transaction(TABLA, 'readwrite').objectStore(TABLA).put(c, clave);
  } catch { /* si no se puede recordar, la próxima vez la vuelve a pedir */ }
}

export const sePuedeElegirCarpeta = () => typeof (window as ConSelector).showDirectoryPicker === 'function';

/** Pide la carpeta y la recuerda. null si el usuario cancela. */
export async function elegirCarpeta(clave: string): Promise<Carpeta | null> {
  try {
    const c = await (window as ConSelector).showDirectoryPicker!({ id: clave, mode: 'readwrite', startIn: 'desktop' });
    await recordar(clave, c);
    return c;
  } catch {
    return null;
  }
}

export type Guardado = { ruta: string } | { descargado: true } | { cancelado: true };

/** Guarda el archivo que arma `armar` en la carpeta recordada bajo `clave`,
 *  dentro de la subcarpeta `sub` (la crea si falta). Si el navegador no deja,
 *  lo descarga. La carpeta se pide antes de armar el archivo: el navegador solo
 *  muestra el selector o el permiso enseguida después del clic. */
export async function guardarEnCarpeta(
  clave: string, sub: string, nombre: string, armar: () => Promise<Blob>,
): Promise<Guardado> {
  if (!sePuedeElegirCarpeta()) {
    const archivo = await armar();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(archivo);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return { descargado: true };
  }
  let carpeta = await leer(clave);
  if (carpeta && (await carpeta.queryPermission({ mode: 'readwrite' })) !== 'granted'
      && (await carpeta.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    carpeta = null;
  }
  if (!carpeta) carpeta = await elegirCarpeta(clave);
  if (!carpeta) return { cancelado: true };

  const archivo = await armar();
  const destino = await carpeta.getDirectoryHandle(sub, { create: true });
  const f = await destino.getFileHandle(nombre, { create: true });
  const w = await f.createWritable();
  await w.write(archivo);
  await w.close();
  return { ruta: `${carpeta.name}\\${sub}\\${nombre}` };
}
