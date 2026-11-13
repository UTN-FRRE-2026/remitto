import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al iniciar, si hay token guardado, recupera el perfil.
  useEffect(() => {
    async function recuperar() {
      if (!getToken()) {
        setCargando(false);
        return;
      }
      try {
        const yo = await api.get('/auth/me');
        setUsuario(yo);
      } catch {
        setToken(null);
      } finally {
        setCargando(false);
      }
    }
    recuperar();
  }, []);

  async function iniciarSesion(email, password) {
    const { token, usuario } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUsuario(usuario);
    return usuario;
  }

  // Tras editar los propios datos (HU3), refresca el nombre del menú.
  async function recargarPerfil() {
    setUsuario(await api.get('/auth/me'));
  }

  function cerrarSesion() {
    setToken(null);
    setUsuario(null);
  }

  const esPropietario = usuario?.rol === 'PROPIETARIO';

  return (
    <AuthContext.Provider value={{ usuario, cargando, esPropietario, iniciarSesion, cerrarSesion, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
