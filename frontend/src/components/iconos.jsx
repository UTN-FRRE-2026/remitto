// Íconos de línea (estilo de la maqueta). Heredan color vía currentColor.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconoRemitto = ({ size = 24 }) => (
  // Ticket / remito con dientes abajo (isotipo de la marca).
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 3h14a1 1 0 0 1 1 1v16l-2.2-1.4L15.6 20l-2.2-1.4L11.2 20 9 18.6 6.8 20 5 18.8V4a1 1 0 0 1 0-1z" />
    <rect x="8" y="7" width="8" height="1.8" rx="0.9" fill="#fff" />
    <rect x="8" y="11" width="8" height="1.8" rx="0.9" fill="#fff" />
  </svg>
);

export const IconoInicio = (p) => (
  <svg {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const IconoProductos = (p) => (
  <svg {...base} {...p}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

export const IconoCamara = (p) => (
  <svg {...base} {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const IconoSalidas = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="20" r="1.3" />
    <circle cx="18" cy="20" r="1.3" />
    <path d="M2 3h2.5l2 12.5a1 1 0 0 0 1 .8h9.5a1 1 0 0 0 1-.8L20 7H6" />
  </svg>
);

export const IconoAsistente = (p) => (
  <svg {...base} {...p}>
    <path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z" />
    <path d="M18 15.5 18.8 17.5 20.8 18.3 18.8 19.1 18 21 17.2 19.1 15.2 18.3 17.2 17.5Z" />
  </svg>
);

export const IconoCampana = (p) => (
  <svg {...base} {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const IconoBuscar = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const IconoCodigo = (p) => (
  <svg {...base} {...p}>
    <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" strokeWidth="1.6" />
  </svg>
);

export const IconoSalir = (p) => (
  <svg {...base} {...p}>
    <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
    <path d="M10 12H3m0 0 3-3m-3 3 3 3" />
  </svg>
);

export const IconoOjo = (p) => (
  <svg {...base} {...p}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const IconoCandado = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconoSobre = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const IconoMas = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconoTablero = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconoComprobantes = (p) => (
  <svg {...base} {...p}>
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M13 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

export const IconoMovimientos = (p) => (
  <svg {...base} {...p}>
    <path d="M7 7h13m0 0-3-3m3 3-3 3" />
    <path d="M17 17H4m0 0 3-3m-3 3 3 3" />
  </svg>
);

export const IconoPrecios = (p) => (
  <svg {...base} {...p}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="m7 14 3.5-4 3 2.5L20 6" />
  </svg>
);

export const IconoIntegraciones = (p) => (
  <svg {...base} {...p}>
    <path d="M9 3v5M15 3v5" />
    <path d="M7 8h10v3a5 5 0 0 1-10 0V8Z" />
    <path d="M12 16v5" />
  </svg>
);

export const IconoUsuarios = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
    <path d="M17.5 14.3A5.5 5.5 0 0 1 20.5 20" />
  </svg>
);
