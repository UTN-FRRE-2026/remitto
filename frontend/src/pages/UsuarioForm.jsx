import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../lib/roles.js';
import { IconoVolver } from '../components/iconos.jsx';
import './Catalogo.css';

const VACIO = { nombre: '', email: '', rol: 'EMPLEADO', password: '' };
const DESCRIPCION_ROL = {
  EMPLEADO: 'Carga comprobantes, registra salidas y recuentos. No administra usuarios, catálogo ni integraciones.',
  PROPIETARIO: 'Accede a todas las funciones, incluida la administración.',
};

// HU3 · Alta y modificación de un usuario (solo propietario). No se eliminan:
// se desactivan, y un usuario desactivado no puede iniciar sesión.
export default function UsuarioForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const { usuario: yo, recargarPerfil } = useAuth();
  const esYo = editando && Number(id) === yo?.id;
  const [form, setForm] = useState(VACIO);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    api
      .get(`/usuarios/${id}`)
      .then((u) => {
        setUsuario(u);
        setForm({ nombre: u.nombre, email: u.email, rol: u.rol, password: '' });
      })
      .catch((err) => setErrorCarga(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, [editando, id]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const errorClave =
    form.password && form.password.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : '';
  const valido =
    form.nombre.trim() && form.email.trim() && !errorClave && (editando || form.password.length >= 6);

  async function guardar(e) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError('');
    const datos = { nombre: form.nombre.trim(), email: form.email.trim() };
    if (!esYo) datos.rol = form.rol; // el backend no deja que el propietario se quite el rol
    if (form.password) datos.password = form.password;
    try {
      if (editando) {
        await api.patch(`/usuarios/${id}`, datos);
        if (esYo) await recargarPerfil();
        navegar('/usuarios', { state: { aviso: `Se guardaron los cambios de ${datos.nombre}.` } });
      } else {
        await api.post('/usuarios', datos);
        navegar('/usuarios', { state: { aviso: `Se creó el usuario de ${datos.nombre}. Ya puede iniciar sesión.` } });
      }
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  async function cambiarActivo(activo) {
    if (
      !activo &&
      !window.confirm(
        `¿Desactivar a ${usuario.nombre}? No podrá iniciar sesión y, si tiene una sesión abierta, se cierra en su próximo pedido. Lo que registró se conserva.`,
      )
    ) {
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const actualizado = activo
        ? await api.patch(`/usuarios/${id}`, { activo: true })
        : await api.del(`/usuarios/${id}`);
      setUsuario(actualizado);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <p className="catalogo__estado">Cargando…</p>;
  if (errorCarga) {
    return (
      <div>
        <p className="error-texto">{errorCarga}</p>
        <Link to="/usuarios" className="btn btn--secundario" style={{ marginTop: 16 }}>
          Volver a usuarios
        </Link>
      </div>
    );
  }

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <button type="button" className="catalogo__volver" onClick={() => navegar('/usuarios')} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <h1 className="catalogo__titulo">{editando ? (esYo ? 'Mis datos' : 'Editar usuario') : 'Nuevo usuario'}</h1>
        {usuario && !usuario.activo && <span className="badge badge--inactivo">Desactivado</span>}
      </header>

      <form className="card formulario" onSubmit={guardar} noValidate>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <div className="input">
            <input id="nombre" value={form.nombre} onChange={cambiar('nombre')} maxLength={120} autoFocus={!editando} />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="email">Correo electrónico</label>
          <div className="input">
            <input id="email" type="email" value={form.email} onChange={cambiar('email')} maxLength={255} autoComplete="off" />
          </div>
          <span className="formulario__ayuda">Con este correo inicia sesión. No puede repetirse.</span>
        </div>

        <div className="campo">
          <label htmlFor="rol">Rol</label>
          <div className="input">
            <select id="rol" value={form.rol} onChange={cambiar('rol')} disabled={esYo}>
              {Object.entries(ROLES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <span className="formulario__ayuda">
            {esYo ? 'No podés quitarte el rol de propietario.' : DESCRIPCION_ROL[form.rol]}
          </span>
        </div>

        <div className="campo">
          <label htmlFor="password">{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <div className="input">
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={cambiar('password')}
              autoComplete="new-password"
              maxLength={72}
            />
          </div>
          {errorClave ? (
            <span className="formulario__error-campo">{errorClave}</span>
          ) : (
            <span className="formulario__ayuda">
              {editando ? 'Dejala vacía para no cambiarla.' : 'Al menos 6 caracteres. Pasásela a la persona por un medio seguro.'}
            </span>
          )}
        </div>

        {error && <p className="error-texto">{error}</p>}

        <div className="formulario__acciones">
          <button type="submit" className="btn btn--primario" disabled={!valido || enviando}>
            {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => navegar('/usuarios')}>
            Cancelar
          </button>
        </div>
      </form>

      {editando && !esYo && (
        <div className="card catalogo__estado-registro">
          {usuario.activo ? (
            <>
              <p>Un usuario no se elimina: se desactiva. No puede iniciar sesión, pero lo que registró se conserva.</p>
              <button type="button" className="btn btn--peligro" onClick={() => cambiarActivo(false)} disabled={enviando}>
                Desactivar usuario
              </button>
            </>
          ) : (
            <>
              <p>Este usuario está desactivado y no puede iniciar sesión.</p>
              <button type="button" className="btn btn--secundario" onClick={() => cambiarActivo(true)} disabled={enviando}>
                Reactivar usuario
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
