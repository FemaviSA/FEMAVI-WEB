import { createClient } from "npm:@supabase/supabase-js@2";

// Campañas de mail a clientes. No se llama desde la web: se usa a mano con la
// clave de campaign_keys (se guarda solo el hash). Acciones:
//   cargar  → { campaign, recipients: [{client_code, razon_social, email, origen}] }
//   productos → { campaign, productos: { "<client_code>": "<producto>" } }
//   prueba  → { campaign, to, producto? } manda el mail tal cual, con [PRUEBA]
//   enviar  → { campaign, limit, confirmar: "ENVIAR" }   de a tandas de hasta 100
//   revisar → { campaign }                consulta a Resend si rebotó, llegó, etc.
//   estado  → { campaign }

const URL_BAJA = "https://lhqawwjszwjzxxsonvwa.supabase.co/functions/v1/campaign-unsubscribe";
const REMITENTE = "Santiago Daurat - FEMAVI <santiago@femavi.com.ar>";
const RESPONDER_A = "santiago@femavi.com.ar";

// Texto simple a propósito: en recupero de clientes rinde más un mail que
// parece escrito a mano que uno con diseño (Santiago, 09/10/2026).
// {saludo} se reemplaza por una frase que nombra el producto que más compraba
// el cliente, o por una general si no hay producto.
type Campana = { asunto: string; cuerpo: string; conProducto: string; sinProducto: string };
const CAMPANAS: Record<string, Campana> = {
  // Segunda versión (09/10/2026): la primera sonaba a folleto. Los clientes nos
  // conocen, así que va corto, en primera persona y buscando que respondan.
  "recupero-inactivos-2026-10": {
    asunto: "Consulta de FEMAVI",
    cuerpo:
`Hola, ¿cómo están?

{saludo}

Seguimos haciendo lo de siempre: fabricamos productos químicos industriales y los asesoramos para elegir el adecuado para cada proceso. Ya son más de 50 años en esto.

Si hoy necesitan algo, o quieren que veamos juntos algún tema puntual, pueden responder este mail o escribirme al 11-6237-0243 (también por WhatsApp). El catálogo está en www.femavi.com.ar/catalogo

Saludos,
Santiago Daurat
FEMAVI`,
    conProducto: "Les escribe Santiago Daurat, de FEMAVI. Hace un tiempo les proveíamos {producto} y quería saber cómo andan.",
    sinProducto: "Les escribe Santiago Daurat, de FEMAVI. Hace un tiempo trabajamos juntos y quería saber cómo andan.",
  },
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function armarMail(c: Campana, to: string, token: string, prueba: boolean, producto?: string | null) {
  const baja = `${URL_BAJA}?t=${token}`;
  const cuerpo = c.cuerpo.replace("{saludo}", producto ? c.conProducto.replace("{producto}", producto) : c.sinProducto);
  const pie = `Si prefieren no recibir más mails nuestros, pueden avisarnos acá: ${baja}`;
  const text = `${cuerpo}\n\n--\n${pie}`;
  // El HTML es el mismo texto, sin diseño: solo párrafos y links.
  const parrafos = cuerpo.split("\n\n").map((p) =>
    "<p>" + esc(p).replace(/\n/g, "<br>")
      .replace("www.femavi.com.ar/catalogo", '<a href="https://www.femavi.com.ar/catalogo">www.femavi.com.ar/catalogo</a>') + "</p>"
  ).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">${parrafos}` +
    `<p style="font-size:11px;color:#888;margin-top:28px">Si prefieren no recibir más mails nuestros, ` +
    `<a href="${baja}" style="color:#888">avísennos acá</a>.</p></div>`;
  return {
    from: REMITENTE,
    to: [to],
    reply_to: RESPONDER_A,
    subject: (prueba ? "[PRUEBA] " : "") + c.asunto,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${baja}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const clave = req.headers.get("x-campaign-key") ?? "";
    const { data: k } = await supabase.from("campaign_keys").select("id")
      .eq("clave_hash", await sha256(clave)).eq("activa", true).maybeSingle();
    if (!clave || !k) return json({ error: "clave inválida" }, 401);

    const body = await req.json();
    const { accion, campaign } = body;
    const c = CAMPANAS[campaign];
    if (!c) return json({ error: "campaña desconocida" }, 400);

    if (accion === "estado") {
      const { data } = await supabase.from("campaign_recipients").select("status").eq("campaign", campaign);
      const cuenta: Record<string, number> = {};
      for (const r of data ?? []) cuenta[r.status] = (cuenta[r.status] ?? 0) + 1;
      return json({ campaign, ...cuenta });
    }

    if (accion === "cargar") {
      const filas = (body.recipients ?? []).map((r: Record<string, string>) => ({
        campaign,
        client_code: r.client_code ? String(Number(r.client_code)) : null,
        razon_social: r.razon_social ?? null,
        email: String(r.email).trim().toLowerCase(),
        origen: r.origen ?? null,
      }));
      const { error, count } = await supabase.from("campaign_recipients")
        .upsert(filas, { onConflict: "campaign,email", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      return json({ ok: true, recibidos: filas.length, nuevos: count });
    }

    if (accion === "productos") {
      let n = 0;
      for (const [codigo, producto] of Object.entries(body.productos ?? {})) {
        const { error } = await supabase.from("campaign_recipients")
          .update({ producto: (producto as string) || null })
          .eq("campaign", campaign).eq("client_code", String(Number(codigo)));
        if (error) throw error;
        n++;
      }
      return json({ ok: true, clientes: n });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");

    if (accion === "prueba") {
      if (!body.to) return json({ error: "falta to" }, 400);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(armarMail(c, body.to, "00000000-0000-0000-0000-000000000000", true, body.producto)),
      });
      return json({ ok: res.ok, resend: await res.json() }, res.ok ? 200 : 500);
    }

    // Pregunta a Resend cómo terminó cada mail enviado (delivered, bounced,
    // complained...) y lo guarda en last_event. De a uno, por el límite de Resend.
    if (accion === "revisar") {
      const { data: env, error } = await supabase.from("campaign_recipients")
        .select("id,email,resend_id").eq("campaign", campaign).eq("status", "enviado")
        .not("resend_id", "is", null);
      if (error) throw error;
      const cuenta: Record<string, number> = {};
      const problemas: { email: string; evento: string }[] = [];
      for (const p of env ?? []) {
        const res = await fetch(`https://api.resend.com/emails/${p.resend_id}`, {
          headers: { Authorization: "Bearer " + RESEND_API_KEY },
        });
        const r = await res.json();
        const evento = res.ok ? String(r.last_event ?? "desconocido") : "error_consulta";
        cuenta[evento] = (cuenta[evento] ?? 0) + 1;
        if (!["delivered", "opened", "clicked", "sent"].includes(evento)) problemas.push({ email: p.email, evento });
        await supabase.from("campaign_recipients").update({ last_event: evento }).eq("id", p.id);
        await new Promise((ok) => setTimeout(ok, 250));
      }
      return json({ ok: true, revisados: env?.length ?? 0, ...cuenta, problemas });
    }

    if (accion === "enviar") {
      if (body.confirmar !== "ENVIAR") return json({ error: "falta confirmar: ENVIAR" }, 400);
      const limit = Math.min(Number(body.limit) || 0, 100);
      if (limit <= 0) return json({ error: "falta limit (1 a 100)" }, 400);

      const { data: pend, error } = await supabase.from("campaign_recipients")
        .select("id,email,unsubscribe_token,producto").eq("campaign", campaign).eq("status", "pendiente")
        .order("id").limit(limit);
      if (error) throw error;
      if (!pend?.length) return json({ ok: true, enviados: 0, mensaje: "no quedan pendientes" });

      // Los que se dieron de baja (de esta u otra campaña) no reciben nada.
      const { data: bajas } = await supabase.from("email_unsubscribes").select("email")
        .in("email", pend.map((p) => p.email));
      const dadosDeBaja = new Set((bajas ?? []).map((b) => b.email));
      const salen = pend.filter((p) => !dadosDeBaja.has(p.email));
      const omitidos = pend.filter((p) => dadosDeBaja.has(p.email));
      if (omitidos.length) {
        await supabase.from("campaign_recipients").update({ status: "baja" }).in("id", omitidos.map((p) => p.id));
      }
      if (!salen.length) return json({ ok: true, enviados: 0, omitidos: omitidos.length });

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(salen.map((p) => armarMail(c, p.email, p.unsubscribe_token, false, p.producto))),
      });
      const r = await res.json();
      if (!res.ok) {
        await supabase.from("campaign_recipients").update({ status: "error", error: JSON.stringify(r) })
          .in("id", salen.map((p) => p.id));
        return json({ ok: false, error: r }, 500);
      }
      const ids: { id: string }[] = r.data ?? [];
      const ahora = new Date().toISOString();
      await Promise.all(salen.map((p, i) =>
        supabase.from("campaign_recipients")
          .update({ status: "enviado", resend_id: ids[i]?.id ?? null, sent_at: ahora })
          .eq("id", p.id)
      ));
      return json({ ok: true, enviados: salen.length, omitidos: omitidos.length });
    }

    return json({ error: "acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
