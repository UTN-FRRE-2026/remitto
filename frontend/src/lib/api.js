// Cliente HTTP mínimo sobre fetch. Agrega el token de sesión y
// normaliza los errores de la API a Error con .status.
const BASE = '/api';

let token = localStorage.getItem('remitto_token') || null;

export function setToken(nuevo) {
  token = nuevo;
  if (nuevo) localStorage.setItem('remitto_token', nuevo);
  else localStorage.removeItem('remitto_token');
}

export function getToken() {
  return token;
}

async function lanzarError(res) {
  const datos = await res.json().catch(() => ({}));
  const err = new Error(datos.error || 'Ocurrió un error');
  err.status = res.status;
  err.detalles = datos.detalles;
  throw err;
}

async function request(metodo, ruta, cuerpo) {
  // FormData (archivos): el navegador arma el Content-Type con el boundary.
  const esFormData = cuerpo instanceof FormData;
  const headers = {};
  if (cuerpo !== undefined && !esFormData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined || esFormData ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    const err = new Error('No se pudo conectar con el servidor. Revisá tu conexión.');
    err.status = 0;
    throw err;
  }

  if (res.status === 204) return null;
  if (!res.ok) await lanzarError(res);
  return res.json().catch(() => ({}));
}

// Descarga autenticada (p. ej. el archivo de un comprobante): un <img src>
// no puede mandar el header Authorization, por eso se pide como blob.
async function blob(ruta) {
  const res = await fetch(BASE + ruta, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) await lanzarError(res);
  return res.blob();
}

export const api = {
  get: (ruta) => request('GET', ruta),
  post: (ruta, cuerpo) => request('POST', ruta, cuerpo),
  patch: (ruta, cuerpo) => request('PATCH', ruta, cuerpo),
  del: (ruta) => request('DELETE', ruta),
  upload: (ruta, formData) => request('POST', ruta, formData),
  blob,
};
