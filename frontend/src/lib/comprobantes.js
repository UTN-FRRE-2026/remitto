// Textos y estilos comunes de los comprobantes (HU18).
export const ESTADO_COMPROBANTE = {
  PENDIENTE: { texto: 'Sin leer', clase: 'badge--ia' },
  PROCESANDO: { texto: 'Leyendo', clase: 'badge--ia' },
  EN_REVISION: { texto: 'En revisión', clase: 'badge--stock-bajo' },
  CONFIRMADO: { texto: 'Confirmado', clase: 'badge--en-stock' },
  ERROR: { texto: 'Error de lectura', clase: 'badge--sin-stock' },
  ANULADO: { texto: 'Anulado', clase: 'badge--inactivo' },
};

export const TIPO_COMPROBANTE = { REMITO: 'Remito', FACTURA: 'Factura', OTRO: 'Comprobante' };

// Pantalla que abre cada comprobante según su estado (lo decide el backend).
export const rutaComprobante = (c) =>
  c.destino === 'LECTURA' ? `/comprobantes/${c.id}/lectura` : `/comprobantes/${c.id}/revisar`;

// La fecha de emisión es un día calendario: se muestra sin correr la zona horaria.
export const fechaDia = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

export const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

// "Remito 0001-00045872", o el número leído como referencia si todavía no se cargó.
export function tituloComprobante(c) {
  const tipo = TIPO_COMPROBANTE[c.tipo] ?? 'Comprobante';
  if (c.numero) return `${tipo} ${c.numero}`;
  return c.numeroLeido ? `${tipo} · leído ${c.numeroLeido}` : `${tipo} sin número`;
}
