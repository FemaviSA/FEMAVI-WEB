// Consulta al padrón de ARCA (ex AFIP) desde el panel de administración.
//
// ARCA no deja consultar sin identificarse: hay que firmar un pedido con un
// certificado digital, cambiarlo por un ticket que dura 12 horas y recién ahí
// consultar. Todo eso pasa acá adentro; desde el admin es un botón.
//
// El certificado y su clave privada viven en los secretos del proyecto
// (ARCA_CERT, ARCA_KEY, ARCA_CUIT), nunca en el repositorio ni en la base.
//
// Solo lo pueden usar los administradores: se valida el usuario contra is_admin().
import forge from "npm:node-forge@1.3.1";
import { XMLParser } from "npm:fast-xml-parser@4.3.6";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cada padrón devuelve cosas distintas:
//  - la constancia de inscripción trae impuestos y monotributo (lo que sirve
//    para saber si es responsable inscripto o monotributista),
//  - el A13 solo trae identidad, domicilio y actividad.
// Se prueban en ese orden y se usa el primero que esté habilitado en ARCA.
const SERVICIOS = (Deno.env.get("ARCA_SERVICIO") ?? "ws_sr_constancia_inscripcion,ws_sr_padron_a13")
  .split(",").map(s => s.trim()).filter(Boolean);

const WSAA = {
  produccion: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
  homologacion: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
};

/** La constancia usa getPersona_v2; los padrones, getPersona. */
const operacion = (servicio: string) =>
  servicio === "ws_sr_constancia_inscripcion" ? "getPersona_v2" : "getPersona";

const version = (servicio: string) =>
  servicio === "ws_sr_constancia_inscripcion" ? "A5" : servicio.replace("ws_sr_padron_", "").toUpperCase();

/** La constancia se consulta por el endpoint A5; los padrones, por el suyo. */
function urlPadron(servicio: string, entorno: "produccion" | "homologacion") {
  const base = entorno === "homologacion"
    ? "https://awshomo.afip.gov.ar/sr-padron/webservices/personaService"
    : "https://aws.afip.gov.ar/sr-padron/webservices/personaService";
  return base + version(servicio);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Fecha en el formato que pide ARCA, con huso de Buenos Aires. */
function fechaArca(d: Date): string {
  const arg = new Date(d.getTime() - 3 * 3600 * 1000);
  return arg.toISOString().replace("Z", "-03:00");
}

/** Arma el pedido de ticket y lo firma con el certificado (CMS / PKCS#7). */
function firmarPedidoDeTicket(cert: string, key: string, servicio: string): string {
  const ahora = new Date();
  const tra =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<loginTicketRequest version=\"1.0\"><header>" +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${fechaArca(new Date(ahora.getTime() - 10 * 60000))}</generationTime>` +
    `<expirationTime>${fechaArca(new Date(ahora.getTime() + 10 * 60000))}</expirationTime>` +
    `</header><service>${servicio}</service></loginTicketRequest>`;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(forge.pki.certificateFromPem(cert));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: forge.pki.certificateFromPem(cert),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function pedirSoap(url: string, accion: string, cuerpo: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: accion },
    body: cuerpo,
  });
  const texto = await res.text();
  if (!res.ok) {
    // ARCA devuelve el motivo adentro del XML, aunque el código sea 500.
    const faltante = texto.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1];
    throw new Error(faltante?.trim() || `ARCA respondió ${res.status}`);
  }
  return texto;
}

/** Ticket de acceso: el guardado si sigue vigente, o uno nuevo. */
async function obtenerTicket(supabase: any, servicio: string, wsaa: string) {
  const { data: guardado } = await supabase
    .from("arca_tickets").select("*").eq("servicio", servicio).maybeSingle();

  // Cinco minutos de margen, para que no venza a mitad de una consulta.
  if (guardado && new Date(guardado.expira_at).getTime() > Date.now() + 5 * 60000) {
    return { token: guardado.token, firma: guardado.firma };
  }

  const cert = Deno.env.get("ARCA_CERT");
  const key = Deno.env.get("ARCA_KEY");
  if (!cert || !key) {
    throw new Error("FALTA_CERTIFICADO");
  }

  const cms = firmarPedidoDeTicket(cert, key, servicio);
  const respuesta = await pedirSoap(
    wsaa,
    "",
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
      `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`,
  );

  const interno = respuesta
    .match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/)?.[1]
    ?.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  if (!interno) throw new Error("ARCA no devolvió el ticket de acceso.");

  const token = interno.match(/<token>([\s\S]*?)<\/token>/)?.[1]?.trim();
  const firma = interno.match(/<sign>([\s\S]*?)<\/sign>/)?.[1]?.trim();
  const expira = interno.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)?.[1]?.trim();
  if (!token || !firma) throw new Error("El ticket de ARCA vino incompleto.");

  await supabase.from("arca_tickets").upsert({
    servicio,
    token,
    firma,
    expira_at: expira ? new Date(expira).toISOString() : new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
    creado_at: new Date().toISOString(),
  });

  return { token, firma };
}

/**
 * Deja la respuesta de ARCA en algo legible. Cada padrón contesta distinto:
 * el A5 anida todo en datosGenerales y el A13 lo devuelve plano, y además el
 * A13 no informa impuestos ni monotributo.
 */
function ordenarPersona(p: any, servicioUsado: string) {
  const g = p?.datosGenerales ?? p ?? {};
  const mono = p?.datosMonotributo ?? g?.datosMonotributo;
  const general = p?.datosRegimenGeneral ?? g?.datosRegimenGeneral;

  // El A13 trae varios domicilios (fiscal, legal/real): se toma el fiscal.
  const domicilios: any[] = [].concat(g.domicilioFiscal ?? g.domicilio ?? []);
  const dom = domicilios.find((d: any) => /FISCAL/i.test(String(d?.tipoDomicilio ?? ""))) ?? domicilios[0] ?? {};

  const impuestos: string[] = []
    .concat(general?.impuesto ?? [])
    .map((i: any) => String(i?.descripcionImpuesto ?? "").trim())
    .filter(Boolean);

  const actividades: string[] = []
    .concat(general?.actividad ?? mono?.actividad ?? [])
    .map((a: any) => String(a?.descripcionActividad ?? "").trim())
    .filter(Boolean);
  if (actividades.length === 0 && g.descripcionActividadPrincipal) {
    actividades.push(String(g.descripcionActividadPrincipal).trim());
  }

  // Sin datos de impuestos no se puede afirmar nada: se devuelve null y la
  // pantalla avisa que este padrón no lo informa.
  let condicion: string | null = null;
  if (mono) {
    const cat = mono.categoriaMonotributo?.descripcionCategoria ?? mono.categoriaMonotributo?.idCategoria;
    condicion = cat ? `Monotributo — categoría ${cat}` : "Monotributo";
  } else if (impuestos.length > 0) {
    condicion = impuestos.some(i => /IVA/i.test(i) && !/EXENTO|NO ALCANZADO/i.test(i))
      ? "Responsable inscripto en IVA"
      : impuestos.some(i => /EXENTO/i.test(i)) ? "Exento" : "No figura inscripto en IVA";
  }

  return {
    cuit: String(g.idPersona ?? ""),
    razon_social: g.razonSocial ?? ([g.apellido, g.nombre].filter(Boolean).join(", ") || null),
    tipo_persona: g.tipoPersona ?? null,
    forma_juridica: g.formaJuridica ?? null,
    estado: g.estadoClave ?? null,
    condicion,
    monotributo: mono ? (mono.categoriaMonotributo?.descripcionCategoria ?? null) : null,
    impuestos,
    actividades,
    domicilio: [dom.direccion, dom.localidad, dom.descripcionProvincia].filter(Boolean).join(", ") || null,
    codigo_postal: dom.codigoPostal ?? dom.codPostal ?? null,
    fecha_contrato_social: g.fechaContratoSocial ? String(g.fechaContratoSocial).slice(0, 10) : null,
    padron: servicioUsado,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { cuit, order_id } = await req.json();
    const digitos = String(cuit ?? "").replace(/\D/g, "");
    if (digitos.length !== 11) return json({ error: "El CUIT tiene que tener 11 dígitos." }, 400);

    // Solo administradores: se pregunta con el propio usuario que llamó.
    const auth = req.headers.get("Authorization") ?? "";
    const comoUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: esAdmin } = await comoUsuario.rpc("is_admin");
    if (esAdmin !== true) return json({ error: "No autorizado." }, 403);
    const { data: usuario } = await comoUsuario.auth.getUser();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const entorno = Deno.env.get("ARCA_ENTORNO") === "homologacion" ? "homologacion" : "produccion";
    const representada = Deno.env.get("ARCA_CUIT");
    if (!representada) throw new Error("FALTA_CERTIFICADO");

    const registrar = (ok: boolean, detalle: string) =>
      supabase.from("arca_consultas").insert({
        cuit: digitos,
        order_id: order_id ?? null,
        consultado_por: usuario?.user?.email ?? null,
        ok,
        detalle,
      });

    const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });
    let ultimoError = "";
    // Qué pasó con cada padrón: sirve para entender por qué no contestó uno.
    const intentos: { servicio: string; error: string }[] = [];

    // Se prueban los padrones en orden y se usa el primero que conteste.
    for (const servicio of SERVICIOS) {
      try {
        const { token, firma } = await obtenerTicket(supabase, servicio, WSAA[entorno]);
        const ns = version(servicio).toLowerCase();
        const op = operacion(servicio);

        const respuesta = await pedirSoap(
          urlPadron(servicio, entorno),
          "",
          '<?xml version="1.0" encoding="UTF-8"?>' +
            `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pad="http://${ns}.soap.ws.server.puc.sr/">` +
            `<soapenv:Header/><soapenv:Body><pad:${op}>` +
            `<token>${token}</token><sign>${firma}</sign>` +
            `<cuitRepresentada>${representada}</cuitRepresentada><idPersona>${digitos}</idPersona>` +
            `</pad:${op}></soapenv:Body></soapenv:Envelope>`,
        );

        const arbol = parser.parse(respuesta);
        // El nombre del nodo depende de la operación (getPersonaResponse o
        // getPersona_v2Response): se busca el que termine en Response.
        const cuerpo = arbol?.Envelope?.Body ?? {};
        const clave = Object.keys(cuerpo).find(k => /Response$/.test(k));
        const devuelto = clave ? cuerpo[clave]?.personaReturn : undefined;
        const persona = devuelto?.persona ?? devuelto;
        if (!persona || (!persona.razonSocial && !persona.datosGenerales && !persona.apellido)) {
          ultimoError = "ARCA no devolvió datos para ese CUIT.";
          intentos.push({ servicio, error: ultimoError });
          continue;
        }

        const datos = ordenarPersona(persona, servicio);
        await registrar(true, datos.razon_social ?? "");
        if (intentos.length) {
          await registrar(false, "fallaron antes: " + intentos.map(i => i.servicio + " -> " + i.error).join(" | "));
        }
        return json({ ok: true, datos, intentos });
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        if (msg === "FALTA_CERTIFICADO") {
          return json({ error: "FALTA_CERTIFICADO", mensaje: "Todavía no está cargado el certificado de ARCA." }, 412);
        }
        // Si el servicio no está habilitado, se intenta con el siguiente.
        ultimoError = msg;
        intentos.push({ servicio, error: msg.slice(0, 200) });
      }
    }

    await registrar(false, intentos.map(i => i.servicio + " -> " + i.error).join(" | ").slice(0, 300));
    return json({ error: ultimoError.slice(0, 300) || "ARCA no devolvió datos.", intentos }, 502);
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
