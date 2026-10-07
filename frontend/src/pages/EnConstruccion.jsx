import { IconoRemitto } from '../components/iconos.jsx';

// Placeholder para las pantallas que llegan en las próximas historias.
export default function EnConstruccion({ titulo, descripcion, hu }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--texto-suave)' }}>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 64,
          height: 64,
          margin: '0 auto 20px',
          borderRadius: 18,
          background: 'var(--salvia)',
          color: 'var(--oscuro)',
        }}
      >
        <IconoRemitto size={30} />
      </div>
      <h1 style={{ fontSize: 'var(--fs-titulo)', fontWeight: 800, color: 'var(--oscuro)' }}>{titulo}</h1>
      <p style={{ marginTop: 10, maxWidth: 300, marginInline: 'auto' }}>{descripcion}</p>
      {hu && (
        <p style={{ marginTop: 14, fontSize: 'var(--fs-detalle)', fontWeight: 700 }}>
          Próxima entrega · {hu}
        </p>
      )}
    </div>
  );
}
