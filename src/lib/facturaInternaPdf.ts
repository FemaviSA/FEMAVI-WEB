import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtNum, fmtPesos } from './adminOrders';
import type { ClaseComprobante, FacturaInterna } from './facturaInterna';

// La factura interna en PDF, para imprimir: los totales, el detalle por
// producto y cada comprobante con sus renglones, igual que en la pantalla.
// Se carga recién cuando se toca el botón (jsPDF pesa).

const CLASE: Record<ClaseComprobante, string> = {
  remito: 'Remito',
  papelito: 'Papelito',
  nota_credito: 'Nota de crédito',
};

// Las fuentes estándar del PDF no tienen el signo menos (−): va el guion común.
const pesos = (n: number | null) => (n == null ? 'sin costo' : fmtPesos.format(n).replace('−', '-'));

const fecha = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const nombreMes = (iso: string) => {
  const s = new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function logo(): Promise<string | null> {
  try {
    const r = await fetch('/logo-femavi.png');
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise(res => {
      const f = new FileReader();
      f.onload = () => res(f.result as string);
      f.onerror = () => res(null);
      f.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

const GRIS = [100, 116, 139] as const;
const OSCURO = [15, 23, 42] as const;
const ROJO = [220, 38, 38] as const;

export async function descargarFacturaInternaPdf(d: FacturaInterna, primerMes: string) {
  const doc = armarFacturaInternaPdf(d, primerMes, await logo());
  doc.save(`Factura interna FEMAVI a FemWay - ${nombreMes(d.mes)}.pdf`);
}

export function armarFacturaInternaPdf(d: FacturaInterna, primerMes: string, img: string | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const M = 14;
  const t = d.totales;
  const mes = nombreMes(d.mes);

  // Encabezado
  if (img) doc.addImage(img, 'PNG', M, 10, 24, 12);
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...OSCURO);
  doc.text('Factura interna FEMAVI a FemWay', img ? M + 28 : M, 16);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS);
  doc.text(mes, img ? M + 28 : M, 21.5);
  doc.setFontSize(8);
  doc.text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, ancho - M, 16, { align: 'right' });

  const periodo = d.mes === primerMes
    ? `Primera factura: incluye todo lo anterior, hasta el ${fecha(d.hasta)}.`
    : `Del ${fecha(d.desde)} al ${fecha(d.hasta)}.`;
  doc.setFontSize(9).text(periodo, M, 30);
  doc.text('A costo de la lista de Quimwey. La bonificación no resta, lo que va sin cargo entra y las notas de crédito restan.',
    M, 34.5, { maxWidth: ancho - 2 * M });

  // Totales
  autoTable(doc, {
    startY: 40,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.6 },
    columnStyles: { 1: { halign: 'right' } },
    body: [
      ['Remitos', pesos(t.remitos)],
      ['Papelitos', pesos(t.papelitos)],
      ['Notas de crédito', pesos(t.notas_credito)],
      ['Sin cargo (incluido arriba)', pesos(t.sin_cargo)],
      [`Comprobantes: ${fmtNum(t.comprobantes)} · ${fmtNum(t.kg)} L/kg`, ''],
    ],
    foot: [['A facturar a FemWay', pesos(t.costo)]],
    footStyles: { fontStyle: 'bold', fontSize: 11, fillColor: [...OSCURO], textColor: 255 },
    tableWidth: 110,
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (d.sin_costo.length) {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(180, 83, 9);
    doc.text(`Atención: ${d.sin_costo.length === 1 ? 'un artículo sin costo' : `${d.sin_costo.length} artículos sin costo`} `
      + `(no suman): ${d.sin_costo.map(s => s.producto).join(', ')}`, M, y, { maxWidth: ancho - 2 * M });
    y += 8;
  }

  // Por producto
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...OSCURO);
  doc.text('Por producto', M, y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [...GRIS], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    head: [['Producto', 'Salió', 'Sin cargo', 'Volvió', 'Costo L/kg', 'Importe']],
    body: d.productos.map(p => [
      `${p.producto} (${p.articulo})`,
      fmtNum(p.salio),
      p.sin_cargo ? fmtNum(p.sin_cargo) : '-',
      p.volvio ? `-${fmtNum(p.volvio)}` : '-',
      p.costo == null ? 'sin costo' : pesos(p.costo),
      pesos(p.importe),
    ]),
    foot: [['Total', '', '', '', '', pesos(t.costo)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [...OSCURO], fontStyle: 'bold', halign: 'right' },
    didParseCell: c => {
      if (c.section === 'body' && c.column.index === 3 && c.cell.raw !== '-') c.cell.styles.textColor = [...ROJO];
    },
  });

  // Comprobantes, cada uno con sus renglones
  doc.addPage();
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...OSCURO);
  doc.text('Comprobantes', M, 16);
  const filas: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
  for (const c of d.comprobantes) {
    const credito = c.clase === 'nota_credito';
    filas.push([
      fecha(c.fecha),
      `${CLASE[c.clase]} ${c.comprobante}`,
      String(c.pedido),
      c.cliente ?? '-',
      { content: pesos(c.importe), styles: { fontStyle: 'bold', textColor: credito ? [...ROJO] : [...OSCURO] } },
    ]);
    for (const r of c.renglones) {
      filas.push([
        '',
        { content: `${r.producto} (${r.articulo})${r.sin_cargo ? '  · sin cargo' : ''}`, colSpan: 2, styles: { textColor: [...GRIS] } },
        { content: `${fmtNum(r.kg)} L/kg × ${r.costo == null ? 'sin costo' : pesos(r.costo)}`, styles: { textColor: [...GRIS], halign: 'right' } },
        { content: pesos(r.importe), styles: { textColor: [...GRIS] } },
      ]);
    }
  }
  autoTable(doc, {
    startY: 18,
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 1.2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [...GRIS], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20 }, 4: { halign: 'right', cellWidth: 28 } },
    head: [['Fecha', 'Comprobante', 'Pedido', 'Cliente', 'Importe']],
    body: filas,
    foot: [['', '', '', 'Total', pesos(t.costo)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [...OSCURO], fontStyle: 'bold', halign: 'right' },
  });

  // Pie con número de página
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS);
    doc.text(`Factura interna FEMAVI a FemWay · ${mes} · Página ${i} de ${paginas}`,
      ancho / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  return doc;
}
