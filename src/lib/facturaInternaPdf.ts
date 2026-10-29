import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtNum, fmtPesos } from './adminOrders';
import type { FacturaInterna } from './facturaInterna';

// La factura interna en PDF, para imprimir: producto por producto, lo que
// salió (suma), lo que volvió (resta), el costo y lo que representa. El total
// va arriba y al final, nunca al pie de cada hoja.
// Se carga recién cuando se toca el botón (jsPDF pesa).

// Las fuentes estándar del PDF no tienen el signo menos (−): va el guion común.
const pesos = (n: number | null) => (n == null ? 'sin costo' : fmtPesos.format(n).replace('−', '-'));

const fecha = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export async function logoFemavi(): Promise<string | null> {
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
const CLARO = [241, 245, 249] as const;

export function armarFacturaInternaPdf(d: FacturaInterna, primerMes: string, img: string | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const M = 14;
  const mes = d.nombre;
  const x = img ? M + 28 : M;

  // Encabezado, con el total arriba a la derecha
  if (img) doc.addImage(img, 'PNG', M, 10, 24, 12);
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...OSCURO);
  doc.text('Factura interna FEMAVI a FemWay', x, 16);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS);
  doc.text(mes, x, 21.5);
  doc.setFontSize(8).text('Total a facturar', ancho - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...OSCURO);
  doc.text(pesos(d.totales.costo), ancho - M, 19.5, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS);
  const periodo = d.mes === primerMes
    ? `Primera factura: incluye todo lo anterior, hasta el ${fecha(d.hasta)}.`
    : `Del ${fecha(d.desde)} al ${fecha(d.hasta)}.`;
  doc.text(`${periodo} A costo de la lista de Quimwey. Emitida el ${new Date().toLocaleDateString('es-AR')}.`, M, 30);

  // Resumen: lo que salió (remitos y papelitos juntos), lo que volvió y lo sin cargo
  const t = d.totales;
  autoTable(doc, {
    startY: 34,
    margin: { left: M, right: M },
    tableWidth: 100,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, textColor: [...OSCURO] },
    columnStyles: { 1: { halign: 'right' } },
    body: [
      ['Remitos y papelitos', pesos(t.remitos + t.papelitos)],
      [{ content: 'Notas de crédito', styles: { textColor: [...ROJO] } }, { content: pesos(t.notas_credito), styles: { textColor: [...ROJO] } }],
      [{ content: 'Sin cargo (incluido en remitos y papelitos)', styles: { textColor: [...GRIS] } }, { content: pesos(t.sin_cargo), styles: { textColor: [...GRIS] } }],
    ],
    foot: [['Total a facturar', pesos(t.costo)]],
    footStyles: { fontStyle: 'bold', fillColor: [...CLARO], textColor: [...OSCURO], halign: 'right' },
    didParseCell: c => { if (c.section === 'foot' && c.column.index === 0) c.cell.styles.halign = 'left'; },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  if (d.sin_costo.length) {
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(180, 83, 9);
    doc.text(`Atención: sin costo, no suman: ${d.sin_costo.map(s => s.producto).join(', ')}`,
      M, y, { maxWidth: ancho - 2 * M });
    y += 5;
  }

  // Producto por producto
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    styles: { fontSize: 8.5, cellPadding: 1.6, textColor: [...OSCURO] },
    headStyles: { fillColor: [...CLARO], textColor: [...GRIS], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    head: [['Producto', 'Salió (suma)', 'Volvió (resta)', 'Neto L/kg', 'Costo L/kg', 'Importe']],
    body: d.productos.map(p => [
      `${p.producto} (${p.articulo})`,
      fmtNum(p.salio),
      p.volvio ? `-${fmtNum(p.volvio)}` : '-',
      fmtNum(Math.round((p.salio - p.volvio) * 100) / 100),
      p.costo == null ? 'sin costo' : pesos(p.costo),
      pesos(p.importe),
    ]),
    foot: [['Total a facturar a FemWay', '', '', '', '', pesos(d.totales.costo)]],
    showFoot: 'lastPage',
    footStyles: { fillColor: [...OSCURO], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'right' },
    didParseCell: c => {
      if (c.section === 'body' && c.column.index === 2 && c.cell.raw !== '-') c.cell.styles.textColor = [...ROJO];
      if (c.section === 'foot' && c.column.index === 0) c.cell.styles.halign = 'left';
    },
  });

  // Número de página
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS);
    doc.text(`Factura interna FEMAVI a FemWay · ${mes} · Página ${i} de ${paginas}`,
      ancho / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  return doc;
}
