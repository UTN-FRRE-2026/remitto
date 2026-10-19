// HU9: errores de la lectura con IA. Cada código tiene un mensaje para el
// usuario y dice si conviene reintentar automáticamente (solo transitorios).
const CATALOGO = {
  CLAVE_RECHAZADA: {
    mensaje: 'El servicio de IA rechazó la clave configurada. Hay que revisar IA_API_KEY en el servidor.',
    automatico: false,
  },
  MODELO_NO_DISPONIBLE: {
    mensaje: 'El modelo de IA configurado no está disponible.',
    automatico: false,
  },
  CUOTA_AGOTADA: {
    mensaje:
      'Se agotó la cuota gratuita diaria de la IA. Se renueva a la medianoche del Pacífico (4 o 5 de la mañana en Argentina).',
    automatico: false,
  },
  LIMITE_POR_MINUTO: {
    mensaje: 'La IA recibió demasiadas solicitudes en poco tiempo. Esperá un minuto y reintentá.',
    automatico: true,
  },
  SERVICIO_NO_DISPONIBLE: {
    mensaje: 'El servicio de IA no está disponible en este momento. Probá de nuevo en unos minutos.',
    automatico: true,
  },
  SIN_CONEXION: {
    mensaje: 'No se pudo conectar con el servicio de IA.',
    automatico: true,
  },
  DEMORA: {
    mensaje: 'La IA tardó demasiado en responder.',
    automatico: true,
  },
  SOLICITUD_RECHAZADA: {
    mensaje: 'El servicio de IA rechazó la solicitud (formato o contenido no admitido).',
    automatico: false,
  },
  RESPUESTA_INVALIDA: {
    mensaje: 'La IA devolvió una respuesta que no se pudo interpretar.',
    automatico: false,
  },
  DOCUMENTO_ILEGIBLE: {
    mensaje: 'No se pudo leer el comprobante. Probá con otra foto, con buena luz y sin sombras.',
    automatico: false,
  },
  LIMITE_INTENTOS: {
    mensaje: 'Se alcanzó el límite de lecturas con IA para este comprobante.',
    automatico: false,
  },
  INTERRUMPIDO: {
    mensaje: 'La lectura se interrumpió por un reinicio o una falla del servidor. Podés reintentarla.',
    automatico: false,
  },
  ERROR_INTERNO: {
    mensaje: 'Ocurrió un error inesperado al leer el comprobante.',
    automatico: false,
  },
};

export class ErrorIa extends Error {
  // detalle: texto técnico para el log del servidor (nunca incluye la clave).
  // proveedor: { status, code, message, details } saneado, solo para el servidor.
  constructor(codigo, { detalle, mensaje, proveedor } = {}) {
    const info = CATALOGO[codigo] ?? CATALOGO.ERROR_INTERNO;
    super(mensaje ?? info.mensaje);
    this.codigo = CATALOGO[codigo] ? codigo : 'ERROR_INTERNO';
    this.automatico = info.automatico;
    this.detalle = detalle;
    this.proveedor = proveedor ?? null;
  }
}

const MAX_TEXTO_PROVEEDOR = 600;

// Quita de un texto del proveedor lo que nunca debe guardarse: claves de API,
// parámetros sensibles de URLs y bloques base64 (contenido del documento).
export function sanear(texto) {
  if (texto == null) return null;
  const t = String(texto)
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[CLAVE]')
    .replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"']+/gi, '$1[REDACTADO]')
    .replace(/(x-goog-api-key|authorization)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1$2[REDACTADO]')
    .replace(/[A-Za-z0-9+/=_-]{120,}/g, '[DATOS]');
  return t.length > MAX_TEXTO_PROVEEDOR ? `${t.slice(0, MAX_TEXTO_PROVEEDOR)}…` : t;
}

export function mensajeDe(codigo) {
  return (CATALOGO[codigo] ?? CATALOGO.ERROR_INTERNO).mensaje;
}

// Formato persistido en errorProcesamiento: "[CODIGO] mensaje".
export function formatearError(codigo, mensaje) {
  return `[${codigo}] ${mensaje}`;
}

export function leerError(texto) {
  const m = /^\[([A-Z_]+)\]\s*(.*)$/s.exec(texto ?? '');
  return m ? { codigo: m[1], mensaje: m[2] } : texto ? { codigo: 'ERROR_INTERNO', mensaje: texto } : null;
}

// Cuerpo de error de la API ({ error: { code, message, details? } }) si viene.
function errorApi(err) {
  const directo = err?.error?.error ?? (typeof err?.error?.code === 'string' ? err.error : null);
  if (directo && typeof directo === 'object') return directo;
  try {
    return JSON.parse(err?.body ?? '')?.error ?? null;
  } catch {
    return null;
  }
}

// Traduce un error del SDK @google/genai (o de red) a ErrorIa, conservando
// el detalle técnico saneado del proveedor para el servidor.
export function traducirErrorSdk(err) {
  if (err instanceof ErrorIa) return err;
  const status = Number(err?.status ?? err?.statusCode);
  const api = errorApi(err);
  const codigo = typeof api?.code === 'string' ? api.code : undefined;
  const proveedor = {
    clase: err?.constructor?.name ?? 'Error',
    status: Number.isFinite(status) ? status : null,
    code: codigo ?? null,
    message: sanear(api?.message ?? err?.message),
    details: api?.details ? sanear(JSON.stringify(api.details)) : null,
  };
  const detalle = `${proveedor.clase} status=${proveedor.status ?? '-'} code=${codigo ?? '-'} message=${proveedor.message ?? '-'}`;
  const nombre = err?.constructor?.name ?? err?.name ?? '';
  const crear = (cod) => new ErrorIa(cod, { detalle, proveedor });

  if (/Timeout/i.test(nombre) || err?.name === 'TimeoutError') return crear('DEMORA');
  if (!Number.isFinite(status)) {
    if (/Connection|Fetch|Network/i.test(nombre) || ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(err?.code)) {
      return crear('SIN_CONEXION');
    }
    return crear('ERROR_INTERNO');
  }
  if (status === 401 || status === 403) return crear('CLAVE_RECHAZADA');
  if (status === 404) return crear('MODELO_NO_DISPONIBLE');
  if (status === 429) {
    const diario = codigo === 'quota_exceeded' || (!codigo && /daily|per day|quota/i.test(err?.message ?? ''));
    return crear(diario ? 'CUOTA_AGOTADA' : 'LIMITE_POR_MINUTO');
  }
  if (status === 504 || status === 408) return crear('DEMORA');
  if (status >= 500) return crear('SERVICIO_NO_DISPONIBLE');
  return crear('SOLICITUD_RECHAZADA');
}
