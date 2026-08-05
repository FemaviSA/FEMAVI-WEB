import { createClient } from "npm:@supabase/supabase-js@2";

// Mapa categoría de content_topics -> valores reales de products.subcategory / products.industries
// usados para elegir productos relacionados a linkear desde el post.
// Debe mantenerse en sync con src/data/categoryConfigs.ts (subcategorías) y los slugs de
// src/pages/industrias/*.tsx (industrias). No se puede importar ese archivo del frontend
// desde acá porque cada Edge Function se despliega de forma aislada.
const CATEGORY_PRODUCT_FILTER: Record<string, { field: "subcategory" | "industries"; values: string[] }> = {
  "desengrasantes": { field: "subcategory", values: ["Desengrasantes"] },
  "higiene-industrial": { field: "subcategory", values: ["Higiene Industrial", "Limpiadores", "Detergentes"] },
  "ceras-y-pisos": { field: "subcategory", values: ["Ceras"] },
  "bactericidas": { field: "subcategory", values: ["Desinfectantes"] },
  "anticorrosivos": { field: "subcategory", values: ["Anticorrosivos"] },
  "lubricantes": { field: "subcategory", values: ["Lubricantes", "Grasas", "Aceites y Aditivos"] },
  "transporte": { field: "industries", values: ["Transporte"] },
  "gastronomia": { field: "industries", values: ["Gastronomía"] },
  "marca": { field: "subcategory", values: ["Desengrasantes", "Lubricantes", "Anticorrosivos"] },
};

const ANTHROPIC_MODEL = "claude-sonnet-5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentTopic = {
  id: number;
  category: string;
  keyword: string;
  content_type: "educativo" | "caso_uso" | "comparativa";
};

type RelatedProduct = { name: string; slug: string; headline: string | null };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function pickRelatedProducts(
  supabase: ReturnType<typeof createClient>,
  category: string,
): Promise<RelatedProduct[]> {
  const filter = CATEGORY_PRODUCT_FILTER[category];
  if (!filter) return [];
  let query = supabase.from("products").select("name,slug,headline").eq("is_active", true).limit(3);
  query = filter.field === "subcategory"
    ? query.in("subcategory", filter.values)
    : query.overlaps("industries", filter.values);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as RelatedProduct[];
}

async function generateArticle(topic: ContentTopic, products: RelatedProduct[]) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta la env var ANTHROPIC_API_KEY");

  const productLines = products
    .map(p => `- ${p.name} (slug: ${p.slug})${p.headline ? `: ${p.headline}` : ""}`)
    .join("\n") || "(no hay productos activos de esta categoría para linkear — no linkees productos)";

  const contentTypeInstructions: Record<ContentTopic["content_type"], string> = {
    educativo: "Formato educativo: explica un concepto o proceso técnico paso a paso, orientado a quien tiene que tomar una decisión de compra o mantenimiento.",
    caso_uso: "Formato caso de uso: narra una situación concreta de un cliente o industria (sin inventar nombres de empresas reales) y cómo se resuelve con los productos de FEMAVI.",
    comparativa: "Formato comparativa/guía de elección: compara opciones o enfoques y ayuda a elegir el correcto según la necesidad.",
  };

  const prompt = `Sos redactor SEO de FEMAVI, fabricante argentino de productos químicos industriales (desengrasantes, bactericidas, ceras, anticorrosivos, lubricantes, higiene industrial) con más de 50 años en el mercado, +20.000 clientes, fórmulas de desarrollo propio y entrega en 48hs en AMBA. Sede en Ibarrola 7071, Liniers, CABA.

Escribí un artículo de blog en español rioplatense (Argentina) para femavi.com.ar apuntando a la keyword: "${topic.keyword}".

${contentTypeInstructions[topic.content_type]}

Productos de FEMAVI para mencionar y linkear naturalmente en el texto (usá su nombre exacto, no inventes otros):
${productLines}

Requisitos:
- Entre 600 y 900 palabras, en Markdown (títulos con ##, sin usar # de nivel 1).
- Tono profesional pero directo, sin relleno ni frases genéricas de IA.
- Mencioná al menos uno de los productos listados arriba de forma orgánica dentro del texto, usando la sintaxis de link Markdown [Nombre del producto](/catalogo/slug-del-producto).
- No inventes certificaciones, normativas ni datos técnicos específicos (dilución, pH, etc.) que no te haya dado.
- El excerpt debe ser una sola oración de hasta 160 caracteres, atractiva y que sirva como meta description.

Devolvé ÚNICAMENTE un objeto JSON válido (sin markdown code fences, sin texto antes o después) con esta forma exacta:
{"title": "...", "slug": "...", "excerpt": "...", "content": "...", "tags": ["...", "..."]}

El slug debe ser en minúsculas, con guiones, sin tildes. Los tags deben incluir "${topic.category}" y 2-3 palabras clave relevantes más.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Error de la API de Anthropic: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`La respuesta del modelo no contenía JSON: ${text.slice(0, 300)}`);

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("La respuesta del modelo no tiene los campos requeridos (title/content/excerpt)");
  }
  return {
    title: String(parsed.title),
    slug: slugify(String(parsed.slug || parsed.title)),
    excerpt: String(parsed.excerpt).slice(0, 300),
    content: String(parsed.content),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [topic.category],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: topics, error: topicsError } = await supabase
      .from("content_topics")
      .select("id,category,keyword,content_type")
      .eq("covered", false)
      .order("id", { ascending: true })
      .limit(1);

    if (topicsError) throw topicsError;
    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ message: "No hay temas pendientes en content_topics." }), {
        status: 200,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const topic = topics[0] as ContentTopic;
    const relatedProducts = await pickRelatedProducts(supabase, topic.category);
    const draft = await generateArticle(topic, relatedProducts);

    // Evita colisión de slug si ya existe un post con el mismo.
    let finalSlug = draft.slug;
    const { data: existing } = await supabase.from("articles").select("id").eq("slug", finalSlug).maybeSingle();
    if (existing) finalSlug = `${draft.slug}-${Date.now().toString(36)}`;

    const { data: article, error: insertError } = await supabase
      .from("articles")
      .insert({
        slug: finalSlug,
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        tags: draft.tags,
        published: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from("content_topics")
      .update({ covered: true, article_id: article.id })
      .eq("id", topic.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ ok: true, article_id: article.id, slug: finalSlug, topic_id: topic.id }),
      { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[weekly-blog-post] error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
