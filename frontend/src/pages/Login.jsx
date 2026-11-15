import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoRemitto, IconoSobre, IconoCandado, IconoOjo } from '../components/iconos.jsx';
import './Login.css';

const DEMO = import.meta.env.DEV;

export default function Login() {
  const { iniciarSesion } = useAuth();
  const navegar = useNavigate();
  // Los datos del usuario de ejemplo se precargan solo en desarrollo
  // (npm run dev): en producción el formulario empieza vacío.
  const [email, setEmail] = useState(DEMO ? 'carlos@doncarlos.com.ar' : '');
  const [password, setPassword] = useState(DEMO ? 'remitto123' : '');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [ayudaClave, setAyudaClave] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await iniciarSesion(email, password);
      navegar('/');
    } catch (err) {
      setError(err.status === 401 ? 'Correo o contraseña incorrectos.' : err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login">
      <header className="login__marca">
        <div className="login__logo">
          <IconoRemitto size={30} />
        </div>
        <h1 className="login__titulo">Remitto</h1>
        <p className="login__claim">
          Tu stock al día,
          <br />
          con una foto del remito.
        </p>
      </header>

      <form className="login__form" onSubmit={enviar}>
        <h2 className="login__h2">Ingresá a tu comercio</h2>

        <div className="campo">
          <label htmlFor="email">Correo electrónico</label>
          <div className="input">
            <IconoSobre size={20} color="var(--texto-suave)" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <div className="input">
            <IconoCandado size={20} color="var(--texto-suave)" />
            <input
              id="password"
              type={verClave ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login__ojo"
              onClick={() => setVerClave((v) => !v)}
              aria-label="Mostrar u ocultar contraseña"
            >
              <IconoOjo size={20} />
            </button>
          </div>
        </div>

        {error && <p className="error-texto">{error}</p>}

        <button className="btn btn--primario btn--bloque" disabled={cargando}>
          {cargando ? <span className="spinner" /> : 'Ingresar'}
        </button>

        <button type="button" className="login__olvide" onClick={() => setAyudaClave((v) => !v)} aria-expanded={ayudaClave}>
          Olvidé mi contraseña
        </button>
        {ayudaClave && (
          <p className="login__ayuda" role="status">
            Pedile al propietario del comercio que te asigne una contraseña nueva desde Usuarios. Si sos el propietario,
            contactá a quien administra el sistema.
          </p>
        )}
      </form>
    </div>
  );
}
