import { createClient } from "npm:@supabase/supabase-js@2";

// Link de baja al pie de los mails de campaña (y el one-click de Gmail, que
// llega por POST). Es público: el token es el único dato y no se puede adivinar.
// Responde texto plano porque Supabase no sirve HTML desde sus funciones.

const texto = (t: string, status = 200) =>
  new Response(t, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return texto("Link inválido.", 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: r } = await supabase.from("campaign_recipients")
    .select("id,email,campaign,status").eq("unsubscribe_token", token).maybeSingle();

  // El token de los mails de prueba no existe: se contesta igual, sin tocar nada.
  if (r) {
    await supabase.from("email_unsubscribes")
      .upsert({ email: r.email, campaign: r.campaign }, { onConflict: "email", ignoreDuplicates: true });
    if (r.status === "pendiente") {
      await supabase.from("campaign_recipients").update({ status: "baja" }).eq("id", r.id);
    }
  }

  return texto("Listo. No va a recibir más comunicaciones de FEMAVI en esta dirección.\n\nSi fue un error, escríbanos a santiago@femavi.com.ar.");
});
