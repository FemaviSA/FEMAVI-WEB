// Zona de reparto de FemWay a partir de la dirección de entrega.
//
// Casi siempre alcanza con la localidad, y eso lo resuelve la base sola
// (femway_zona_de). Esta función es para cuando no alcanza: un nombre que está
// en dos partidos de zonas distintas (Del Viso, Solano…) o "La Matanza" a
// secas, que se reparte en cinco zonas.
//
//  1. La base dice en qué partidos puede estar (femway_zona_candidatos).
//  2. Georef (el servicio de direcciones del Estado) busca la calle y la altura
//     en cada uno. Si aparece en uno solo, ese es el partido.
//  3. En La Matanza, Georef no distingue localidades: con las coordenadas se
//     mira en qué localidad caen (San Justo, Ramos Mejía…). Los contornos
//     están en matanza.json: son los límites de OpenStreetMap, bajados el
//     14/10/2026 y simplificados a ~10 m. OpenStreetMap no le contesta a este
//     servidor, por eso van guardados acá. Falta 20 de Junio, que en
//     OpenStreetMap queda dentro de González Catán (misma zona, 460).
//
// Si algo no cierra (la calle no aparece, aparece en dos partidos, no hay
// altura) devuelve zona null y se pone a mano. Mejor sin zona que equivocada.
//
// La llama la planilla (vendedor y admin) con la clave pública del sitio.
import { createClient } from "npm:@supabase/supabase-js@2";
import MATANZA from "./matanza.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** "Calle 844 N° 2500, piso 2 dpto B" → "844 2500": lo que Georef entiende. */
function limpiarDireccion(d: string): string {
  return d
    .replace(/\b(piso|dpto|depto|departamento|of|oficina|local|pb)\b.*$/i, "")
    .replace(/\b(calle|n[°º]|nro\.?|numero|número)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Hallazgo { partido: string; lat: number; lon: number }

async function buscarEnPartido(direccion: string, partido: string): Promise<Hallazgo | null> {
  const q = new URLSearchParams({
    direccion, provincia: "06", departamento: partido, max: "1",
    campos: "altura.valor,ubicacion,departamento.nombre",
  });
  const r = await fetch(`https://apis.datos.gob.ar/georef/api/direcciones?${q}`);
  if (!r.ok) return null;
  const d = await r.json();
  const h = d?.direcciones?.[0];
  // Sin altura Georef devuelve la calle entera: no sirve para ubicar el lugar.
  if (!h || h.altura?.valor == null || h.ubicacion?.lat == null) return null;
  return { partido: h.departamento?.nombre ?? partido, lat: h.ubicacion.lat, lon: h.ubicacion.lon };
}

type Anillo = [number, number][];
const LOCALIDADES = MATANZA as { nombre: string; poligonos: Anillo[][] }[];

/** Par-impar: ¿el punto está adentro del anillo? (x = longitud, y = latitud) */
function enAnillo(x: number, y: number, a: Anillo): boolean {
  let adentro = false;
  for (let i = 0, k = a.length - 1; i < a.length; k = i++) {
    const [xi, yi] = a[i], [xk, yk] = a[k];
    if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

/** La localidad de La Matanza donde caen las coordenadas, o null. */
function localidadEn(lat: number, lon: number): string | null {
  const hay = LOCALIDADES.filter(l =>
    l.poligonos.some(p => enAnillo(lon, lat, p[0]) && !p.slice(1).some(h => enAnillo(lon, lat, h))));
  // Justo sobre un límite puede caer en dos: ahí no se adivina.
  return hay.length === 1 ? hay[0].nombre : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { localidad, direccion } = await req.json().catch(() => ({}));
    const loc = String(localidad ?? "").trim();
    const dir = limpiarDireccion(String(direccion ?? ""));
    if (!loc) return json({ zona: null });

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const zonaDe = async (texto: string): Promise<string | null> => {
      const { data } = await db.rpc("femway_zona_de", { p_localidad: texto });
      return (data as string | null) ?? null;
    };

    // Lo de siempre: la localidad sola.
    const directa = await zonaDe(loc);
    if (directa) return json({ zona: directa, por: "localidad" });

    const { data: cand } = await db.rpc("femway_zona_candidatos", { p_localidad: loc });
    const partidos = (cand as string[] | null) ?? [];
    if (!partidos.length || !/\d/.test(dir)) return json({ zona: null });

    const hallados = (await Promise.all(partidos.map(p => buscarEnPartido(dir, p))))
      .filter((h): h is Hallazgo => h !== null);
    // La misma calle y altura en dos partidos: no se puede decidir.
    if (hallados.length !== 1) return json({ zona: null, motivo: hallados.length ? "en_varios" : "no_encontrada" });
    const h = hallados[0];

    if (h.partido === "La Matanza") {
      const lugar = localidadEn(h.lat, h.lon);
      const zona = lugar ? await zonaDe(lugar) : null;
      return json({ zona, por: "direccion", partido: h.partido, localidad: lugar });
    }

    return json({ zona: await zonaDe(h.partido), por: "direccion", partido: h.partido });
  } catch (e) {
    return json({ zona: null, error: String((e as Error)?.message ?? e) }, 500);
  }
});
