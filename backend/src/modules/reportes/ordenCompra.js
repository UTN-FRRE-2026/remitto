import PDFDocument from 'pdfkit';

// HU31 (RF9.2): orden de compra a partir de la sugerencia de reposición
// (HU27). Un documento por proveedor, con producto, cantidad y unidad. No
// recalcula nada: toma el grupo del proveedor tal como lo arma sugerir().
// Sin precios: el documento es para enviárselo al proveedor.

const UNIDAD = { UNIDAD: 'u.', KILOGRAMO: 'kg', GRAMO: 'g', LITRO: 'l', MILILITRO: 'ml', METRO: 'm', PAQUETE: 'paq.' };
const ZONA = 'America/Argentina/Buenos_Aires';

export const formatoCantidad = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 });

// CUIT con guiones, como en la pantalla (se guarda sin ellos).
export function formatoCuit(cuit) {
  const digitos = String(cuit ?? '').replace(/\D/g, '');
  return digitos.length === 11 ? `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}` : cuit;
}

// sugerencia: resultado de reposicion()/sugerir(). clave: id del proveedor o
// 'sin' (productos sin compras registradas). proveedor: fila de la base
// (razonSocial, cuit, contacto, telefono, email, direccion) o null.
// Devuelve null si ese proveedor no tiene nada para pedir.
export function ordenDeCompra(sugerencia, clave, proveedor, emitida = new Date()) {
  const grupo = sugerencia.proveedores.find((g) => (clave === 'sin' ? g.id == null : g.id === clave));
  if (!grupo || grupo.productos.length === 0) return null;
  return {
    proveedor:
      clave === 'sin'
        ? { razonSocial: null, aDefinir: true }
        : {
            razonSocial: proveedor?.razonSocial ?? grupo.nombre,
            cuit: proveedor?.cuit ?? null,
            contacto: proveedor?.contacto ?? null,
            telefono: proveedor?.telefono ?? null,
            email: proveedor?.email ?? null,
            direccion: proveedor?.direccion ?? null,
          },
    emitida,
    lineas: grupo.productos.map((p) => ({
      producto: p.nombre,
      cantidad: p.cantidad,
      unidad: UNIDAD[p.unidadMedida] ?? p.unidadMedida,
    })),
  };
}

const sinAcentos = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

const diaArgentina = (fecha) => fecha.toLocaleDateString('sv-SE', { timeZone: ZONA });

export function nombreArchivo(orden) {
  const quien = orden.proveedor.aDefinir ? 'sin-proveedor' : sinAcentos(orden.proveedor.razonSocial) || 'proveedor';
  return `orden-compra-${quien}-${diaArgentina(orden.emitida)}.pdf`;
}

// --- PDF ---------------------------------------------------------------------

const MARGEN = 50;
// Columnas de la tabla (A4: 595 puntos de ancho). La cantidad tiene ancho fijo
// y se alinea a la derecha: nunca se corta; el producto ocupa las líneas que
// necesite.
const COL = {
  numero: { x: MARGEN, ancho: 28 },
  producto: { x: MARGEN + 32, ancho: 318 },
  cantidad: { x: MARGEN + 356, ancho: 90 },
  unidad: { x: MARGEN + 452, ancho: 43 },
};
const TAM = 10;
const SEPARACION = 6;

// Genera el PDF (Buffer). Sin comprimir: pesa pocos KB y su texto se puede
// verificar en las pruebas.
export function generarPdf(orden) {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      compress: false,
      info: { Title: 'Orden de compra', Author: 'Remitto', Subject: orden.proveedor.razonSocial ?? 'Proveedor a definir' },
    });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);

    const pie = () => doc.page.height - MARGEN - 30;
    const ancho = doc.page.width - MARGEN * 2;

    // Cabecera del documento.
    doc.font('Helvetica-Bold').fontSize(20).text('Orden de compra', MARGEN, MARGEN);
    doc
      .font('Helvetica')
      .fontSize(TAM)
      .fillColor('#555555')
      .text(`Emitida el ${orden.emitida.toLocaleString('es-AR', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' })}`)
      .fillColor('#000000')
      .moveDown(0.8);
    doc.font('Helvetica-Bold').text('Proveedor: ', { continued: true });
    if (orden.proveedor.aDefinir) {
      doc.font('Helvetica').text('a definir (productos sin compras registradas)');
    } else {
      const p = orden.proveedor;
      doc.font('Helvetica').text(p.razonSocial);
      const datos = [p.cuit && `CUIT ${formatoCuit(p.cuit)}`, p.contacto && `Contacto: ${p.contacto}`, p.telefono && `Tel. ${p.telefono}`, p.email, p.direccion].filter(Boolean);
      if (datos.length) doc.fillColor('#555555').text(datos.join(' · '), { width: ancho }).fillColor('#000000');
    }
    doc.moveDown(1);

    // Tabla.
    let y = doc.y;
    const cabecera = () => {
      doc.font('Helvetica-Bold').fontSize(TAM);
      doc.text('#', COL.numero.x, y, { width: COL.numero.ancho });
      doc.text('Producto', COL.producto.x, y, { width: COL.producto.ancho });
      doc.text('Cantidad', COL.cantidad.x, y, { width: COL.cantidad.ancho, align: 'right' });
      doc.text('Unidad', COL.unidad.x, y, { width: COL.unidad.ancho });
      y += doc.currentLineHeight() + 4;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.8).strokeColor('#000000').stroke();
      y += SEPARACION;
      doc.font('Helvetica').fontSize(TAM);
    };
    cabecera();

    orden.lineas.forEach((l, i) => {
      doc.font('Helvetica').fontSize(TAM);
      const alto = Math.max(doc.heightOfString(l.producto, { width: COL.producto.ancho }), doc.currentLineHeight());
      if (y + alto > pie()) {
        doc.addPage();
        y = MARGEN;
        cabecera();
      }
      doc.text(String(i + 1), COL.numero.x, y, { width: COL.numero.ancho });
      doc.text(l.producto, COL.producto.x, y, { width: COL.producto.ancho });
      doc.text(formatoCantidad(l.cantidad), COL.cantidad.x, y, { width: COL.cantidad.ancho, align: 'right' });
      doc.text(l.unidad, COL.unidad.x, y, { width: COL.unidad.ancho });
      y += alto + SEPARACION / 2;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.3).strokeColor('#bbbbbb').stroke();
      y += SEPARACION / 2;
    });

    // Cierre.
    if (y + 40 > pie()) {
      doc.addPage();
      y = MARGEN;
    }
    doc
      .font('Helvetica')
      .fontSize(TAM)
      .fillColor('#555555')
      .text(
        `${orden.lineas.length} ${orden.lineas.length === 1 ? 'producto' : 'productos'}. Cantidades sugeridas para llegar al stock deseado. Generado con Remitto.`,
        MARGEN,
        y + 10,
        { width: ancho },
      );
    doc.end();
  });
}
