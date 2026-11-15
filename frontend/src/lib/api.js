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
  err.datos = datos; // cuerpo completo (el asistente responde sus errores en «respuesta»)
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
async function pedirArchivo(ruta) {
  const res = await fetch(BASE + ruta, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) await lanzarError(res);
  return res;
}

// Devuelve el Blob (contrato de siempre, lo usan los comprobantes).
async function blob(ruta) {
  return (await pedirArchivo(ruta)).blob();
}

// HU31: archivo para descargar, con el nombre que indica el backend
// (Content-Disposition). Devuelve { blob, nombre }.
async function descargar(ruta) {
  const res = await pedirArchivo(ruta);
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? null;
  return { blob: await res.blob(), nombre };
}

// Hace que el navegador guarde un Blob con ese nombre.
export function guardarArchivo(blobArchivo, nombre) {
  const url = URL.createObjectURL(blobArchivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (ruta) => request('GET', ruta),
  post: (ruta, cuerpo) => request('POST', ruta, cuerpo),
  patch: (ruta, cuerpo) => request('PATCH', ruta, cuerpo),
  del: (ruta) => request('DELETE', ruta),
  upload: (ruta, formData) => request('POST', ruta, formData),
  blob,
  descargar,
};

// Texto para mostrar de un error de la API: los detalles de validación por
// campo, si los hay, o el mensaje general.
export const mensajeDeError = (err) => err.detalles?.map?.((d) => d.mensaje).join(' ') || err.message;
