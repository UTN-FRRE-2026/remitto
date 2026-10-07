// Badge de estado de stock, según el estado derivado del backend.
const MAPA = {
  EN_STOCK: { clase: 'badge--en-stock', texto: 'En stock' },
  STOCK_BAJO: { clase: 'badge--stock-bajo', texto: 'Stock bajo' },
  SIN_STOCK: { clase: 'badge--sin-stock', texto: 'Sin stock' },
};

export default function EstadoBadge({ estado }) {
  const info = MAPA[estado] ?? MAPA.EN_STOCK;
  return <span className={`badge ${info.clase}`}>{info.texto}</span>;
}
