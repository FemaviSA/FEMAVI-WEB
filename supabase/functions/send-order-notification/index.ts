import ExcelJS from "npm:exceljs@4.4.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  product: string;
  presentation?: string | null;
  quantity: number;
  unit_price?: number | null;
  line_total?: number | null;
}

// === PALETA (la misma que usa la planilla de cotizaciones) ===
const AZUL_OSCURO = "FF1B3A6B";
const AZUL_CLARO = "FFD6E4F7";
const GRIS_FILA = "FFF5F7FA";
const GRIS_BORDE = "FFBFCAD4";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF1A1A1A";
const VERDE_BONIF = "FF047857";

const F = (bold: boolean, size: number, color = NEGRO, italic = false): Partial<ExcelJS.Font> => ({
  name: "Calibri", bold, size, color: { argb: color }, italic,
});
const B = (style: ExcelJS.BorderStyle = "thin", color = GRIS_BORDE): ExcelJS.Border => ({
  style, color: { argb: color },
});
const solid = (argb: string): ExcelJS.Fill => ({
  type: "pattern", pattern: "solid", fgColor: { argb },
});

const MONEDA = '"$"#,##0.00';

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dato = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? "—" : s;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, prueba } = await req.json();
    if (!order_id) throw new Error("Falta order_id");

    // Modo prueba: manda solo a la casilla de Santiago, para no dejar correo de
    // prueba en ventas@, que es compartida. Deliberadamente NO acepta una
    // dirección arbitraria: si la aceptara, cualquiera podría usar esta función
    // para mandar mail con el dominio de FEMAVI a donde quisiera.
    const destinatarios = prueba === true
      ? ["santiago@femavi.com.ar"]
      : ["santiago@femavi.com.ar", "ventas@femavi.com.ar"];

    // El mail se arma con lo que quedó guardado, no con lo que mandó el
    // navegador: así no puede diferir de lo que administración ve en el panel.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cada pedido se avisa una sola vez y solo si se cargó en la última hora.
    // El pedido se "reclama" de forma atómica marcando notified_at: si ya
    // estaba marcado, o es viejo, no se manda nada. Así nadie puede usar esta
    // función para reenviar pedidos y llenar de correo a ventas@.
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: o, error: errOrden } = await supabase
      .from("orders")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", order_id)
      .is("notified_at", null)
      .gte("created_at", haceUnaHora)
      .select("*")
      .maybeSingle();
    if (errOrden) throw new Error("No pude leer el pedido " + order_id);
    if (!o) {
      return new Response(JSON.stringify({ ok: true, enviado: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let vendedor = o.seller_code ? "Agente " + o.seller_code : "—";
    if (o.seller_code) {
      const { data: s } = await supabase
        .from("sellers").select("name").eq("code", o.seller_code).maybeSingle();
      if (s?.name) vendedor = s.name + " (" + o.seller_code + ")";
    }

    const items: OrderItem[] = Array.isArray(o.items) ? o.items : [];
    const creado = new Date(o.created_at);
    const fecha = creado.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

    // ===================== PLANILLA =====================
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedido", {
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
    });

    [2, 12, 14, 30, 13, 14, 16, 2].forEach((w: number, i: number) => {
      ws.getColumn(i + 1).width = w;
    });

    const ANCHO = 8;
    const pintarFila = (r: number, color: string) => {
      for (let c = 1; c <= ANCHO; c++) ws.getCell(r, c).fill = solid(color);
    };

    // ── Logo y dirección ──
    ws.getRow(1).height = 6;
    ws.getRow(2).height = 38;
    ws.getRow(3).height = 18;
    pintarFila(2, BLANCO);
    pintarFila(3, BLANCO);

    // El logo se toma del sitio en vez de venir incrustado acá: así la planilla
    // usa siempre el mismo que la web y la función no carga 25 KB de base64.
    try {
      const resLogo = await fetch("https://www.femavi.com.ar/logo-femavi.png");
      if (resLogo.ok) {
        const bytes = new Uint8Array(await resLogo.arrayBuffer());
        const logoId = wb.addImage({ buffer: bytes.buffer as ArrayBuffer, extension: "png" });
        ws.addImage(logoId, { tl: { col: 1, row: 1 }, br: { col: 4.2, row: 3 }, editAs: "oneCell" });
      }
    } catch {
      // El logo es decorativo: si el sitio no responde, la planilla sale igual.
    }

    ws.mergeCells("F2:G3");
    const dir = ws.getCell("F2");
    dir.value = "Ibarrola 7071 — CABA (Cp1408)\nCel: +54 9 11 6228 4649\nMail: ventas@femavi.com.ar";
    dir.font = F(false, 9, "FF444444");
    dir.alignment = { horizontal: "right", vertical: "middle", wrapText: true };

    ws.getRow(4).height = 4;
    pintarFila(4, AZUL_OSCURO);

    // ── Barra de título ──
    ws.getRow(5).height = 30;
    pintarFila(5, AZUL_OSCURO);
    ws.mergeCells("B5:E5");
    const titulo = ws.getCell("B5");
    titulo.value = "P E D I D O   N°  " + dato(o.order_number);
    titulo.font = F(true, 15, BLANCO);
    titulo.alignment = { horizontal: "left", vertical: "middle" };

    ws.mergeCells("F5:G5");
    const cuenta = ws.getCell("F5");
    cuenta.value = "CUENTA  " + dato(o.account);
    cuenta.font = F(true, 13, BLANCO);
    cuenta.alignment = { horizontal: "right", vertical: "middle" };

    // ── Datos de cabecera, en dos columnas de pares etiqueta/valor ──
    let r = 7;
    const parEtiqueta = (fila: number, colEtiqueta: number, etiqueta: string, valor: unknown) => {
      const e = ws.getCell(fila, colEtiqueta);
      e.value = etiqueta;
      e.font = F(true, 9, "FF5A6F80");
      e.alignment = { horizontal: "left", vertical: "middle" };
      const v = ws.getCell(fila, colEtiqueta + 1);
      v.value = dato(valor);
      v.font = F(false, 10);
      v.alignment = { horizontal: "left", vertical: "middle" };
      v.border = { bottom: B("hair") };
    };

    const cabecera: [string, unknown, string, unknown][] = [
      ["FECHA", fecha, "VENDEDOR", vendedor],
      ["N° CLIENTE", o.is_new_client ? "CLIENTE NUEVO" : o.client_code, "CICLO DE VENTAS", o.sales_cycle],
      ["N° O/COMPRA", o.purchase_order, "FECHA DE ENVÍO", o.ship_date],
    ];
    for (const [e1, v1, e2, v2] of cabecera) {
      ws.getRow(r).height = 17;
      parEtiqueta(r, 2, e1, v1);
      parEtiqueta(r, 5, e2, v2);
      r++;
    }
    r++;

    // ── Bloques FACTURAR A / ENTREGAR A ──
    const barra = (texto: string) => {
      ws.getRow(r).height = 20;
      pintarFila(r, AZUL_CLARO);
      ws.mergeCells(r, 2, r, 7);
      const c = ws.getCell(r, 2);
      c.value = texto;
      c.font = F(true, 10, AZUL_OSCURO);
      c.alignment = { horizontal: "left", vertical: "middle" };
      r++;
    };

    barra("FACTURAR A");
    const facturar: [string, unknown, string, unknown][] = [
      ["RAZÓN SOCIAL", o.company, "CUIT", o.cuit],
      ["DIRECCIÓN", o.bill_address, "CONDICIÓN IVA", o.tax_condition],
      ["CIUDAD Y PROV.", o.bill_city, "COND. DE PAGO", o.payment_terms],
      ["WHATSAPP", o.phone, "E-MAIL", o.email],
      ["A CARGO DE", o.client_name, "", ""],
    ];
    for (const [e1, v1, e2, v2] of facturar) {
      ws.getRow(r).height = 17;
      parEtiqueta(r, 2, e1, v1);
      if (e2) parEtiqueta(r, 5, e2, v2);
      r++;
    }
    r++;

    barra("ENTREGAR A");
    const entregar: [string, unknown, string, unknown][] = [
      ["DIRECCIÓN", o.delivery_address, "TRANSPORTE", o.carrier],
      ["CIUDAD Y PROV.", o.ship_city, "ZONA", o.zone],
      ["WHATSAPP", o.ship_phone, "A CARGO DE", o.ship_contact],
    ];
    for (const [e1, v1, e2, v2] of entregar) {
      ws.getRow(r).height = 17;
      parEtiqueta(r, 2, e1, v1);
      parEtiqueta(r, 5, e2, v2);
      r++;
    }
    r++;

    // ── Tabla de productos ──
    ws.getRow(r).height = 22;
    pintarFila(r, AZUL_OSCURO);
    ["CANTIDAD", "ENVASE", "DESCRIPCIÓN DEL PRODUCTO", "P. UNITARIO", "TOTAL"].forEach((t, i) => {
      const c = ws.getCell(r, i + 2);
      c.value = t;
      c.font = F(true, 10, BLANCO);
      c.alignment = { horizontal: i >= 3 ? "right" : "left", vertical: "middle" };
    });
    ws.mergeCells(r, 6, r, 7);
    const encTotal = ws.getCell(r, 6);
    encTotal.value = "TOTAL";
    encTotal.font = F(true, 10, BLANCO);
    encTotal.alignment = { horizontal: "right", vertical: "middle" };
    r++;

    const filaPrimerItem = r;
    items.forEach((it, i) => {
      // Cantidad negativa = bonificación sobre el producto de arriba.
      const bonificacion = Number(it.quantity) < 0;
      const importe = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);

      ws.getRow(r).height = 18;
      if (bonificacion) pintarFila(r, "FFEFFCF4");
      else if (i % 2 === 1) pintarFila(r, GRIS_FILA);

      const celdas: [number, unknown, "left" | "right"][] = [
        [2, Number(it.quantity ?? 0), "left"],
        [3, it.presentation || "", "left"],
        [4, (bonificacion ? "BONIFICACIÓN — " : "") + (it.product ?? ""), "left"],
        [5, Number(it.unit_price ?? 0), "right"],
      ];
      for (const [col, valor, alineacion] of celdas) {
        const c = ws.getCell(r, col);
        c.value = valor as never;
        c.font = F(bonificacion, 10, bonificacion ? VERDE_BONIF : NEGRO);
        c.alignment = { horizontal: alineacion, vertical: "middle" };
        c.border = { bottom: B("hair") };
        if (col === 5) c.numFmt = MONEDA;
      }

      ws.mergeCells(r, 6, r, 7);
      const t = ws.getCell(r, 6);
      t.value = importe;
      t.numFmt = MONEDA;
      t.font = F(true, 10, bonificacion ? VERDE_BONIF : NEGRO);
      t.alignment = { horizontal: "right", vertical: "middle" };
      t.border = { bottom: B("hair") };
      r++;
    });

    // ── Total ──
    ws.getRow(r).height = 26;
    pintarFila(r, AZUL_CLARO);
    ws.mergeCells(r, 2, r, 5);
    const etiquetaTotal = ws.getCell(r, 2);
    etiquetaTotal.value = "TOTAL DEL PEDIDO";
    etiquetaTotal.font = F(true, 11, AZUL_OSCURO);
    etiquetaTotal.alignment = { horizontal: "right", vertical: "middle" };

    ws.mergeCells(r, 6, r, 7);
    const valorTotal = ws.getCell(r, 6);
    valorTotal.value = items.length
      ? { formula: `SUM(F${filaPrimerItem}:F${r - 1})`, result: Number(o.total ?? 0) }
      : Number(o.total ?? 0);
    valorTotal.numFmt = MONEDA;
    valorTotal.font = F(true, 13, AZUL_OSCURO);
    valorTotal.alignment = { horizontal: "right", vertical: "middle" };
    r += 2;

    // ── Observaciones ──
    if (o.notes) {
      ws.getRow(r).height = 17;
      const e = ws.getCell(r, 2);
      e.value = "OBSERVACIONES";
      e.font = F(true, 9, "FF5A6F80");
      r++;
      ws.mergeCells(r, 2, r, 7);
      const c = ws.getCell(r, 2);
      c.value = o.notes;
      c.font = F(false, 10);
      c.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      ws.getRow(r).height = 34;
    }

    // ── Serializar ──
    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer as ArrayBuffer);
    let binario = "";
    for (let i = 0; i < uint8.length; i++) binario += String.fromCharCode(uint8[i]);
    const xlsxBase64 = btoa(binario);

    const empresaSegura = String(o.company || "cliente").toLowerCase()
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const filename = "pedido-" + dato(o.order_number) + "-" + empresaSegura + ".xlsx";

    // ===================== MAIL =====================
    const plata = new Intl.NumberFormat("es-AR", {
      style: "currency", currency: "ARS", minimumFractionDigits: 2,
    });

    const filasHtml = items.map((it) => {
      const bonificacion = Number(it.quantity) < 0;
      const importe = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
      const color = bonificacion ? "#047857" : "#1a2b3c";
      const fondo = bonificacion ? "#f0fdf4" : "#ffffff";
      return `<tr style="background:${fondo}">
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;color:${color};font-weight:700">${esc(it.quantity)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;color:${color}">${esc(it.presentation || "—")}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;color:${color};font-weight:600">${bonificacion ? "BONIFICACIÓN — " : ""}${esc(it.product)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;text-align:right;color:${color}">${plata.format(Number(it.unit_price ?? 0))}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e2e8ee;text-align:right;color:${color};font-weight:700">${plata.format(importe)}</td>
      </tr>`;
    }).join("");

    const ficha = (titulo: string, pares: [string, unknown][]) =>
      `<h3 style="color:#1B3A6B;margin:22px 0 8px;font-size:14px;letter-spacing:.04em">${titulo}</h3>` +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      pares.map(([k, v]) =>
        `<tr><td style="padding:5px 10px;font-weight:bold;background:#f0f4f8;width:170px">${esc(k)}</td>` +
        `<td style="padding:5px 10px">${esc(dato(v))}</td></tr>`
      ).join("") +
      "</table>";

    const html =
      '<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">' +
      '<div style="background:#1B3A6B;padding:18px 26px;border-radius:8px 8px 0 0">' +
      `<h2 style="color:#fff;margin:0;font-size:19px">Pedido N° ${esc(dato(o.order_number))} · Cuenta ${esc(dato(o.account))}</h2>` +
      `<p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px">${esc(vendedor)} · ${fecha}</p>` +
      "</div>" +
      '<div style="border:1px solid #e2e8ee;border-top:none;padding:20px 26px;border-radius:0 0 8px 8px">' +

      (o.is_new_client
        ? '<div style="padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:13px;margin-bottom:6px"><strong>Cliente nuevo</strong> — hay que darlo de alta antes de facturar.</div>'
        : "") +

      ficha("Facturar a", [
        ["Razón social", o.company], ["N° de cliente", o.is_new_client ? "cliente nuevo" : o.client_code],
        ["Dirección", o.bill_address], ["Ciudad y provincia", o.bill_city],
        ["WhatsApp", o.phone], ["E-mail", o.email], ["A cargo de", o.client_name],
        ["Condición IVA", o.tax_condition], ["CUIT", o.cuit], ["Cond. de pago", o.payment_terms],
      ]) +

      ficha("Entregar a", [
        ["Dirección", o.delivery_address], ["Ciudad y provincia", o.ship_city],
        ["WhatsApp", o.ship_phone], ["A cargo de", o.ship_contact],
        ["Transporte", o.carrier], ["Zona", o.zone],
        ["N° de orden de compra", o.purchase_order], ["Fecha de envío", o.ship_date],
      ]) +

      '<h3 style="color:#1B3A6B;margin:22px 0 8px;font-size:14px">Productos</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="background:#1B3A6B;color:#fff">' +
      '<th style="padding:7px 10px;text-align:left;width:75px">Cant.</th>' +
      '<th style="padding:7px 10px;text-align:left;width:90px">Envase</th>' +
      '<th style="padding:7px 10px;text-align:left">Producto</th>' +
      '<th style="padding:7px 10px;text-align:right;width:105px">P. unitario</th>' +
      '<th style="padding:7px 10px;text-align:right;width:115px">Total</th>' +
      "</tr></thead>" + `<tbody>${filasHtml}</tbody>` +
      '<tfoot><tr style="background:#D6E4F7">' +
      '<td colspan="4" style="padding:10px;text-align:right;font-weight:bold;color:#1B3A6B">TOTAL DEL PEDIDO</td>' +
      `<td style="padding:10px;text-align:right;font-weight:bold;font-size:15px;color:#1B3A6B">${plata.format(Number(o.total ?? 0))}</td>` +
      "</tr></tfoot></table>" +

      (o.notes
        ? `<div style="margin-top:18px;padding:12px 16px;background:#f8f9fa;border-radius:6px;border-left:3px solid #1B3A6B;font-size:13px"><strong>Observaciones:</strong> ${esc(o.notes)}</div>`
        : "") +

      '<hr style="margin:22px 0;border:none;border-top:1px solid #e2e8ee" />' +
      '<p style="color:#666;font-size:12px;margin:0">📎 La planilla del pedido va adjunta en Excel.</p>' +
      "</div></div>";

    // ── Envío ──
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");

    const asunto = (prueba === true ? "[PRUEBA] " : "") +
      "Pedido " + dato(o.order_number) + " · " + dato(o.account) +
      " · " + vendedor + " · " + dato(o.company);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "FEMAVI Pedidos <pedidos@femavi.com.ar>",
        to: destinatarios,
        subject: asunto,
        html,
        attachments: [{ filename, content: xlsxBase64 }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      // Si el mail no salió, se libera el pedido para poder reintentar.
      await supabase.from("orders").update({ notified_at: null }).eq("id", order_id);
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, order_number: o.order_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
