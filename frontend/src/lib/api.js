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

async function request(metodo, ruta, cuerpo) {
  const headers = {};
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  if (res.status === 204) return null;

  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(datos.error || 'Ocurrió un error');
    err.status = res.status;
    err.detalles = datos.detalles;
    throw err;
  }
  return datos;
}

export const api = {
  get: (ruta) => request('GET', ruta),
  post: (ruta, cuerpo) => request('POST', ruta, cuerpo),
  patch: (ruta, cuerpo) => request('PATCH', ruta, cuerpo),
  del: (ruta) => request('DELETE', ruta),
};
