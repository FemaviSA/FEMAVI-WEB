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

const SERVICIO = "ws_sr_padron_a5";

const URLS = {
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
};

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
function firmarPedidoDeTicket(cert: string, key: string): string {
  const ahora = new Date();
  const tra =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<loginTicketRequest version=\"1.0\"><header>" +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${fechaArca(new Date(ahora.getTime() - 10 * 60000))}</generationTime>` +
    `<expirationTime>${fechaArca(new Date(ahora.getTime() + 10 * 60000))}</expirationTime>` +
    `</header><service>${SERVICIO}</service></loginTicketRequest>`;

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
async function obtenerTicket(supabase: any, urls: typeof URLS.produccion) {
  const { data: guardado } = await supabase
    .from("arca_tickets").select("*").eq("servicio", SERVICIO).maybeSingle();

  // Cinco minutos de margen, para que no venza a mitad de una consulta.
  if (guardado && new Date(guardado.expira_at).getTime() > Date.now() + 5 * 60000) {
    return { token: guardado.token, firma: guardado.firma };
  }

  const cert = Deno.env.get("ARCA_CERT");
  const key = Deno.env.get("ARCA_KEY");
  if (!cert || !key) {
    throw new Error("FALTA_CERTIFICADO");
  }

  const cms = firmarPedidoDeTicket(cert, key);
  const respuesta = await pedirSoap(
    urls.wsaa,
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
    servicio: SERVICIO,
    token,
    firma,
    expira_at: expira ? new Date(expira).toISOString() : new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
    creado_at: new Date().toISOString(),
  });

  return { token, firma };
}

/** Deja la respuesta de ARCA en algo legible para la pantalla. */
function ordenarPersona(p: any) {
  const g = p?.datosGenerales ?? {};
  const mono = p?.datosMonotributo;
  const general = p?.datosRegimenGeneral;
  const dom = g.domicilioFiscal ?? {};

  const impuestos: string[] = []
    .concat(general?.impuesto ?? [])
    .map((i: any) => String(i?.descripcionImpuesto ?? "").trim())
    .filter(Boolean);

  const actividades: string[] = []
    .concat(general?.actividad ?? mono?.actividad ?? [])
    .map((a: any) => String(a?.descripcionActividad ?? "").trim())
    .filter(Boolean);

  let condicion = "No figura inscripto en IVA";
  if (mono) {
    const cat = mono.categoriaMonotributo?.descripcionCategoria ?? mono.categoriaMonotributo?.idCategoria;
    condicion = cat ? `Monotributo — categoría ${cat}` : "Monotributo";
  } else if (impuestos.some(i => /IVA/i.test(i) && !/EXENTO|NO ALCANZADO/i.test(i))) {
    condicion = "Responsable inscripto en IVA";
  } else if (impuestos.some(i => /EXENTO/i.test(i))) {
    condicion = "Exento";
  }

  return {
    cuit: String(g.idPersona ?? ""),
    razon_social: g.razonSocial ?? ([g.apellido, g.nombre].filter(Boolean).join(", ") || null),
    tipo_persona: g.tipoPersona ?? null,
    estado: g.estadoClave ?? null,
    condicion,
    monotributo: mono ? (mono.categoriaMonotributo?.descripcionCategoria ?? null) : null,
    impuestos,
    actividades,
    domicilio: [dom.direccion, dom.localidad, dom.descripcionProvincia].filter(Boolean).join(", ") || null,
    codigo_postal: dom.codPostal ?? null,
    fecha_contrato_social: g.fechaContratoSocial ?? null,
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

    const urls = Deno.env.get("ARCA_ENTORNO") === "homologacion" ? URLS.homologacion : URLS.produccion;
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

    try {
      const { token, firma } = await obtenerTicket(supabase, urls);

      const respuesta = await pedirSoap(
        urls.padron,
        "",
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">' +
          "<soapenv:Header/><soapenv:Body><a5:getPersona>" +
          `<token>${token}</token><sign>${firma}</sign>` +
          `<cuitRepresentada>${representada}</cuitRepresentada><idPersona>${digitos}</idPersona>` +
          "</a5:getPersona></soapenv:Body></soapenv:Envelope>",
      );

      const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });
      const arbol = parser.parse(respuesta);
      const persona = arbol?.Envelope?.Body?.getPersonaResponse?.personaReturn?.persona;
      if (!persona) {
        await registrar(false, "ARCA no devolvió datos para ese CUIT.");
        return json({ error: "ARCA no tiene datos para ese CUIT." }, 404);
      }

      const datos = ordenarPersona(persona);
      await registrar(true, datos.razon_social ?? "");
      return json({ ok: true, datos });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (msg === "FALTA_CERTIFICADO") {
        return json({ error: "FALTA_CERTIFICADO", mensaje: "Todavía no está cargado el certificado de ARCA." }, 412);
      }
      await registrar(false, msg.slice(0, 300));
      return json({ error: msg.slice(0, 300) }, 502);
    }
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
