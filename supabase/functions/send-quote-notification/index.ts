import ExcelJS from "npm:exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductDetail {
  name: string;
  slug: string;
  presentation: string;
  quantity: number;
}

interface QuoteEmailData {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  industry?: string | null;
  message?: string | null;
  productNames: string[];
  productDetails?: ProductDetail[];
}

const LOGO_B64 = "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";

// === HELPERS ===
const AZUL_OSCURO = "FF1B3A6B";
const AZUL_MEDIO  = "FF2E5FA3";
const AZUL_CLARO  = "FFD6E4F7";
const GRIS_FILA   = "FFF5F7FA";
const GRIS_BORDE  = "FFBFCAD4";
const BLANCO      = "FFFFFFFF";
const NEGRO       = "FF1A1A1A";
const VERDE_TOTAL = "FF1B6B3A";

const F = (bold: boolean, size: number, color = NEGRO, italic = false): Partial<ExcelJS.Font> => ({
  name: "Calibri", bold, size, color: { argb: color }, italic,
});
const B = (style: ExcelJS.BorderStyle = "thin", color = GRIS_BORDE): ExcelJS.Border => ({
  style, color: { argb: color },
});
const solid = (argb: string): ExcelJS.Fill => ({
  type: "pattern", pattern: "solid", fgColor: { argb },
});

function parseSizeAndQty(presentation: string, quantity: number): { display: string; totalUnits: number } {
  const match = presentation.match(/(\d+(?:[.,]\d+)?)/);
  if (match) {
    const size = parseFloat(match[1].replace(",", "."));
    return { display: quantity + "x" + size, totalUnits: Math.round(quantity * size * 100) / 100 };
  }
  return { display: String(quantity), totalUnits: quantity };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: QuoteEmailData = await req.json();
    const { name, email, phone, company, message, productDetails, productNames } = body;

    const now = new Date();
    const fmt = (d: Date) =>
      String(d.getDate()).padStart(2, "0") + "/" +
      String(d.getMonth() + 1).padStart(2, "0") + "/" +
      d.getFullYear();
    const fecha = fmt(now);

    // Build products list
    const products: { name: string; qtyDisplay: string; totalUnits: number; price: number }[] = [];
    if (productDetails && productDetails.length > 0) {
      for (const p of productDetails) {
        const { display, totalUnits } = parseSizeAndQty(p.presentation || "", p.quantity);
        products.push({ name: p.name, qtyDisplay: display, totalUnits, price: 0 });
      }
    } else if (productNames && productNames.length > 0) {
      for (const pn of productNames) {
        products.push({ name: pn, qtyDisplay: "1", totalUnits: 1, price: 0 });
      }
    }

    // === BUILD WORKBOOK ===
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cotizacion", {
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
    });

    // Column widths
    [2, 12, 26, 14, 11, 16, 16, 2].forEach((w: number, i: number) => {
      ws.getColumn(i + 1).width = w;
    });

    // ── HEADER (filas 1-3) ──
    ws.getRow(1).height = 6;
    ws.getRow(2).height = 38;
    ws.getRow(3).height = 18;

    // fill header white
    for (let r = 2; r <= 3; r++)
      for (let c = 1; c <= 8; c++)
        ws.getCell(r, c).fill = solid(BLANCO);

    // Logo
    try {
      const logoBytes = Uint8Array.from(atob(LOGO_B64), (ch) => ch.charCodeAt(0));
      const logoId = wb.addImage({ buffer: logoBytes.buffer as ArrayBuffer, extension: "png" });
      ws.addImage(logoId, { tl: { col: 1, row: 1 }, br: { col: 4.2, row: 3 }, editAs: "oneCell" });
    } catch {
      // logo opcional: si falla la decodificación no debe bloquear el resto de la planilla
    }

    // Dirección texto
    ws.mergeCells("F2:G3");
    const addrCell = ws.getCell("F2");
    addrCell.value = "Ibarrola 7071 — CABA (Cp1408)\nCel: +54 9 11 6228 4649\nMail: ventas@femavi.com.ar";
    addrCell.font = F(false, 9, "FF444444");
    addrCell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };

    // Línea separadora
    ws.getRow(4).height = 4;
    for (let c = 1; c <= 8; c++) ws.getCell(4, c).fill = solid(AZUL_OSCURO);

    // ── BARRA TÍTULO ──
    ws.getRow(5).height = 28;
    ws.mergeCells("B5:G5");
    for (let c = 1; c <= 8; c++) ws.getCell(5, c).fill = solid(AZUL_OSCURO);
    const titleCell = ws.getCell("B5");
    titleCell.value = "C O T I Z A C I Ó N";
    titleCell.font = F(true, 18, BLANCO);
    titleCell.fill = solid(AZUL_OSCURO);
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    // ── DATOS (filas 6-11) ──
    ws.getRow(6).height = 6;
    [7, 8, 9, 10].forEach((r) => { ws.getRow(r).height = 18; });
    ws.getRow(11).height = 6;

    const datosLeft: [number, string, string][] = [
      [7,  "Cotización N°:", ""],
      [8,  "Fecha:",         ""],
      [9,  "Válido hasta:",  ""],
      [10, "Vend.:",                   "Santiago Daurat"],
    ];
    const datosRight: [number, string, string][] = [
      [7,  "Empresa:",   company || ""],
      [8,  "Contacto:",  name || ""],
      [9,  "Teléfono:", phone || ""],
      [10, "Email:",     email || ""],
    ];

    for (const [row, label, val] of datosLeft) {
      const lbl = ws.getCell(row, 2);
      lbl.value = label; lbl.font = F(true, 10); lbl.alignment = { horizontal: "left", vertical: "middle" };
      ws.mergeCells(row, 3, row, 4);
      const v = ws.getCell(row, 3);
      v.value = val; v.font = F(false, 10, AZUL_MEDIO); v.alignment = { horizontal: "left", vertical: "middle" };
    }
    for (const [row, label, val] of datosRight) {
      const lbl = ws.getCell(row, 5);
      lbl.value = label; lbl.font = F(true, 10); lbl.alignment = { horizontal: "right", vertical: "middle" };
      ws.mergeCells(row, 6, row, 7);
      const v = ws.getCell(row, 6);
      v.value = val; v.font = F(false, 10); v.alignment = { horizontal: "left", vertical: "middle" };
    }

    // ── TABLA HEADER (fila 12) ──
    ws.getRow(12).height = 20;
    ws.mergeCells("C12:D12");
    const tblCols: [number, string][] = [
      [2, "Ítem"], [3, "Descripción del producto"],
      [5, "Cant."], [6, "Precio unit. ($)"], [7, "Total ($)"],
    ];
    for (const [col, val] of tblCols) {
      const cell = ws.getCell(12, col);
      cell.value = val;
      cell.font = F(true, 10, BLANCO);
      cell.fill = solid(AZUL_OSCURO);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { right: B("thin", BLANCO), bottom: B("thin", BLANCO) };
    }
    ws.getCell(12, 4).fill = solid(AZUL_OSCURO);

    // ── PRODUCT ROWS ──
    const numProducts = Math.max(products.length, 2);
    let r = 13;
    const firstProductRow = r;

    for (let i = 0; i < numProducts; i++) {
      ws.getRow(r).height = 17;
      const p = products[i];
      const bg = r % 2 === 0 ? GRIS_FILA : BLANCO;

      ws.mergeCells(r, 3, r, 4);

      const totalFormula =
        `F${r}*IF(ISNUMBER(FIND("x",E${r})),VALUE(LEFT(E${r},FIND("x",E${r})-1))*VALUE(MID(E${r},FIND("x",E${r})+1,100)),VALUE(E${r}))`;

      const rowData: [number, ExcelJS.CellValue, Partial<ExcelJS.Alignment>, boolean][] = [
        [2, i + 1,                { horizontal: "center" }, false],
        [3, p ? p.name : "",      { horizontal: "left"   }, false],
        [5, p ? p.qtyDisplay : "",{ horizontal: "center" }, false],
        [6, null,                 { horizontal: "right"  }, true ],
        [7, p ? { formula: totalFormula, result: 0 } : null, { horizontal: "right" }, true],
      ];

      for (const [col, val, align, isMoney] of rowData) {
        const cell = ws.getCell(r, col);
        cell.value = val;
        cell.font = F(false, 10);
        cell.fill = solid(bg);
        cell.alignment = { ...align, vertical: "middle" };
        if (isMoney) cell.numFmt = '"$"\\ #,##0.00';
        cell.border = {
          left:   col === 2 ? B() : undefined,
          right:  col === 7 ? B() : B("hair"),
          top:    B("hair"),
          bottom: B("hair"),
        };
      }
      ws.getCell(r, 4).fill = solid(bg);
      r++;
    }

    const lastProductRow = r - 1;

    // Fila cierre tabla
    ws.getRow(r).height = 6;
    for (let c = 2; c <= 7; c++) {
      ws.getCell(r, c).border = { bottom: B("medium", AZUL_OSCURO) };
      ws.getCell(r, c).fill = solid(BLANCO);
    }
    r++;

    // ── TOTALES ──
    const subRow = r, ivaRow = r + 1;

    const totDefs: [string, string, boolean, string, string, number][] = [
      ["Subtotal",  `SUM(G${firstProductRow}:G${lastProductRow})`, false, AZUL_CLARO,  NEGRO,       16],
      ["IVA (21%)", `G${subRow}*0.21`,                             false, AZUL_CLARO,  NEGRO,       16],
      ["TOTAL",     `G${subRow}+G${ivaRow}`,                       true,  VERDE_TOTAL, BLANCO,      22],
    ];

    for (let i = 0; i < totDefs.length; i++) {
      const [label, formula, bold, bg, color, h] = totDefs[i];
      const row = r + i;
      ws.getRow(row).height = h;
      ws.mergeCells(row, 2, row, 6);
      const lbl = ws.getCell(row, 2);
      lbl.value = label; lbl.font = F(bold, bold ? 12 : 10, color);
      lbl.fill = solid(bg); lbl.alignment = { horizontal: "right", vertical: "middle" };
      lbl.border = { left: B(), bottom: B("hair"), top: i === 2 ? B("medium") : undefined };
      const val = ws.getCell(row, 7);
      val.value = { formula, result: 0 };
      val.numFmt = '"$"\\ #,##0.00'; val.font = F(bold, bold ? 12 : 10, color);
      val.fill = solid(bg); val.alignment = { horizontal: "right", vertical: "middle" };
      val.border = { right: B(), bottom: B("hair"), top: i === 2 ? B("medium") : undefined };
    }
    r += 3;

    // ── CONDICIONES ──
    r++;
    ws.getRow(r).height = 18;
    ws.mergeCells(r, 2, r, 7);
    const condTitle = ws.getCell(r, 2);
    condTitle.value = "CONDICIONES DE VENTA";
    condTitle.font = F(true, 10, BLANCO);
    condTitle.fill = solid(AZUL_MEDIO);
    condTitle.alignment = { horizontal: "left", vertical: "middle" };
    condTitle.border = { left: B(), right: B(), top: B(), bottom: B() };
    r++;

    const condiciones = [
      "• Forma de pago:",
      "• Plazo de entrega: 7 días.",
      "• Entregas en AMBA: sin cargo en pedidos que superen los $200.000.",
      "• Interior del país: despachamos por el expreso de su preferencia (flete a cargo del destinatario).",
    ];

    for (let i = 0; i < condiciones.length; i++) {
      ws.getRow(r).height = 15;
      ws.mergeCells(r, 2, r, 7);
      const cell = ws.getCell(r, 2);
      cell.value = condiciones[i]; cell.font = F(false, 9);
      cell.alignment = { vertical: "middle" };
      cell.border = { left: B(), right: B(), bottom: i === condiciones.length - 1 ? B() : B("hair") };
      r++;
    }

    // ── SLOGAN ──
    r++;
    ws.getRow(r).height = 32;
    ws.mergeCells(r, 2, r, 7);
    const slogan = ws.getCell(r, 2);
    slogan.value = '"CUIDAMOS NUESTROS PROCESOS PARA DIFERENCIARLOS POR CALIDAD"';
    slogan.font = F(true, 11, AZUL_OSCURO, true);
    slogan.alignment = { horizontal: "center", vertical: "middle" };
    slogan.border = { left: B(), right: B(), top: B("medium", AZUL_OSCURO), bottom: B("medium", AZUL_OSCURO) };
    r++;

    // ── OBSERVACIONES ──
    r++;
    ws.getRow(r).height = 15;
    ws.mergeCells(r, 2, r, 7);
    const obs = ws.getCell(r, 2);
    obs.value = message ? "Observaciones: " + message : "Observaciones:";
    obs.font = F(false, 9, "FF666666");
    obs.border = { left: B("hair"), right: B("hair"), bottom: B("hair") };

    // ── GENERATE BUFFER ──
    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer as ArrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const xlsxBase64 = btoa(binary);

    const safeCompany = (company || "cliente").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const dateStr = now.toISOString().slice(0, 10);
    const filename = "cotizacion-" + safeCompany + "-" + dateStr + ".xlsx";

    // ── EMAIL HTML ──
    const fechaLarga = now.toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
    const productListHtml = products.map((p, i) =>
      "<tr>" +
      `<td style="padding:6px 12px;border-bottom:1px solid #e2e8ee">${i + 1}</td>` +
      `<td style="padding:6px 12px;border-bottom:1px solid #e2e8ee">${p.name}</td>` +
      `<td style="padding:6px 12px;border-bottom:1px solid #e2e8ee;text-align:center">${p.qtyDisplay}</td>` +
      "</tr>"
    ).join("");

    const emailHtml =
      '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">' +
      '<div style="background:#1B3A6B;padding:20px 28px;border-radius:8px 8px 0 0">' +
      '<h2 style="color:#fff;margin:0;font-size:20px">FEMAVI S.A. – Nueva Solicitud de Cotización</h2>' +
      `<p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">${fechaLarga}</p>` +
      "</div>" +
      '<div style="border:1px solid #e2e8ee;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px">' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
      `<tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4f8;width:140px">Empresa</td><td style="padding:6px 12px">${company || "-"}</td></tr>` +
      `<tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4f8">Contacto</td><td style="padding:6px 12px">${name || "-"}</td></tr>` +
      `<tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4f8">Email</td><td style="padding:6px 12px">${email || "-"}</td></tr>` +
      `<tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4f8">Teléfono</td><td style="padding:6px 12px">${phone || "-"}</td></tr>` +
      "</table>" +
      '<h3 style="color:#1B3A6B;margin:0 0 12px">Productos solicitados</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      '<thead><tr style="background:#f0f4f8">' +
      '<th style="padding:8px 12px;text-align:left;width:40px">#</th>' +
      '<th style="padding:8px 12px;text-align:left">Producto</th>' +
      '<th style="padding:8px 12px;text-align:center;width:80px">Cant.</th>' +
      "</tr></thead>" +
      `<tbody>${productListHtml}</tbody>` +
      "</table>" +
      (message ? `<div style="margin-top:20px;padding:12px 16px;background:#f8f9fa;border-radius:6px;border-left:3px solid #1B3A6B"><strong>Observaciones:</strong> ${message}</div>` : "") +
      '<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8ee" />' +
      '<p style="color:#666;font-size:13px;margin:0">📎 La planilla Excel está adjunta. Completá el <strong>precio unitario</strong> y el <strong>código de cliente / N° cotización</strong>.</p>' +
      "</div></div>";

    // ── SEND VIA RESEND ──
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "FEMAVI Cotizaciones <cotizaciones@femavi.com.ar>",
        to: ["santiago@femavi.com.ar", "ventas@femavi.com.ar"],
        subject: "Nueva cotización – " + (company || name) + " – " + fecha,
        html: emailHtml,
        attachments: [{ filename, content: xlsxBase64 }],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", resendRes.status, errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
