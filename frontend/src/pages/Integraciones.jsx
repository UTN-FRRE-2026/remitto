import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { IconoCandado, IconoCheck } from '../components/iconos.jsx';
import './Integraciones.css';

const ZONA = 'America/Argentina/Buenos_Aires';
const fecha = (f) => new Date(f).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });

// Pedido de ejemplo para quien programa la caja (HU22).
const EJEMPLO = `{
  "referencia": "CAJA1-0001-00004512",
  "lineas": [
    { "codigoBarras": "7790001000012", "cantidad": 2 }
  ]
}`;

// "Hace 4 minutos", "Hace 2 horas"; más de una semana, la fecha.
export function haceCuanto(f, ahora = Date.now()) {
  if (!f) return 'Nunca';
  const minutos = Math.floor((ahora - new Date(f).getTime()) / 60000);
  if (minutos < 1) return 'Recién';
  if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return fecha(f);
}

// HU21 · Integración con punto de venta: claves para que la caja del comercio
// informe sus ventas (HU22). La ruta es solo del propietario y el backend lo
// vuelve a comprobar en cada pedido.
export default function Integraciones() {
  const [claves, setClaves] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState(null);
  const [aRevocar, setARevocar] = useState(null);
  const [revocando, setRevocando] = useState(false);
  // Evita generar dos claves con un doble toque antes de que se deshabilite el botón.
  const creandoRef = useRef(false);

  function cargar() {
    return api
      .get('/claves-integracion')
      .then(setClaves)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function generar(e) {
    e.preventDefault();
    if (creandoRef.current || !nombre.trim()) return;
    creandoRef.current = true;
    setCreando(true);
    setError('');
    try {
      const creada = await api.post('/claves-integracion', { nombre: nombre.trim() });
      // La clave completa solo vive en memoria mientras se muestra.
      setNueva(creada);
      setNombre('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      creandoRef.current = false;
      setCreando(false);
    }
  }

  async function revocar(id) {
    setRevocando(true);
    setError('');
    try {
      await api.del(`/claves-integracion/${id}`);
      setARevocar(null);
      if (nueva?.id === id) setNueva(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevocando(false);
    }
  }

  return (
    <div className="integraciones">
      <h1 className="integraciones__titulo">Integración con punto de venta</h1>
      <p className="integraciones__ayuda">Conectá la caja de tu comercio para que cada venta descuente el stock sola.</p>

      {nueva && <ClaveNueva clave={nueva} onCerrar={() => setNueva(null)} />}

      <form className="card integraciones__generar" onSubmit={generar}>
        <div className="campo">
          <label htmlFor="nombre-clave">Nombre de la clave</label>
          <div className="input">
            <input
              id="nombre-clave"
              value={nombre}
              maxLength={60}
              placeholder="Por ejemplo: Caja del mostrador"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn--primario" type="submit" disabled={creando || !nombre.trim()}>
          {creando ? 'Generando…' : 'Generar clave'}
        </button>
      </form>

      {error && (
        <p className="error-texto integraciones__error" role="alert">
          {error}
        </p>
      )}

      <section className="card integraciones__lista" aria-labelledby="titulo-claves">
        <header>
          <h2 id="titulo-claves">Claves de acceso</h2>
          <p>Cada clave se muestra completa una sola vez, al generarla.</p>
        </header>
        {cargando && <p className="integraciones__vacio">Cargando…</p>}
        {!cargando && claves.length === 0 && <p className="integraciones__vacio">Todavía no generaste claves.</p>}
        {claves.map((c) => (
          <article key={c.id} className={`clave ${c.activa ? '' : 'clave--revocada'}`}>
            <div className="clave__cabecera">
              <div className="clave__datos">
                <strong>{c.nombre}</strong>
                <code>{c.prefijo}••••••••</code>
              </div>
              <span className={`badge ${c.activa ? 'badge--en-stock' : 'badge--sin-stock'}`}>
                {c.activa ? 'Activa' : 'Revocada'}
              </span>
            </div>
            <dl className="clave__meta">
              <div>
                <dt>Último uso</dt>
                <dd>{haceCuanto(c.ultimoUsoEn)}</dd>
              </div>
              <div>
                <dt>Creada</dt>
                <dd>
                  {fecha(c.creadaEn)}
                  {c.creadaPor ? ` · ${c.creadaPor.nombre}` : ''}
                </dd>
              </div>
              {!c.activa && (
                <div>
                  <dt>Revocada</dt>
                  <dd>{fecha(c.revocadaEn)}</dd>
                </div>
              )}
            </dl>
            {c.activa && aRevocar !== c.id && (
              <button className="clave__revocar" onClick={() => setARevocar(c.id)}>
                Revocar
              </button>
            )}
            {c.activa && aRevocar === c.id && (
              <div className="clave__confirmar" role="alertdialog" aria-label={`Revocar ${c.nombre}`}>
                <p>La caja que use esta clave dejará de poder informar ventas. No se puede deshacer.</p>
                <div>
                  <button className="btn btn--secundario" onClick={() => setARevocar(null)} disabled={revocando}>
                    Cancelar
                  </button>
                  <button className="btn btn--peligro" onClick={() => revocar(c.id)} disabled={revocando}>
                    {revocando ? 'Revocando…' : 'Revocar clave'}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="card integraciones__api">
        <h2>Para quien programa la caja</h2>
        <p>Cada pedido se autentica con la clave en el encabezado:</p>
        <pre>Authorization: Bearer rmt_live_…</pre>
        <p>
          Cada venta se informa con <code>POST /api/v1/integracion/salidas</code>, con una referencia única (el número de
          ticket) y los productos por código de barras. Si la caja reenvía la misma venta, no se descuenta dos veces.
        </p>
        <pre>{EJEMPLO}</pre>
        <p>
          Para comprobar una clave: <code>GET /api/v1/integracion/estado</code>. Contrato completo (OpenAPI):{' '}
          <a href="/api/v1/integracion/openapi.json" target="_blank" rel="noreferrer">
            /api/v1/integracion/openapi.json
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function ClaveNueva({ clave, onCerrar }) {
  const [copiada, setCopiada] = useState(false);
  const campo = useRef(null);

  // El portapapeles solo existe en HTTPS o localhost; si falla, se selecciona
  // el texto para copiarlo a mano.
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave.clave);
      setCopiada(true);
    } catch {
      campo.current?.select();
    }
  }

  return (
    <div className="card clave-nueva" role="status">
      <h2>
        <IconoCandado size={18} /> Clave «{clave.nombre}» generada
      </h2>
      <p>Copiala y cargala en la caja ahora: por seguridad no se vuelve a mostrar.</p>
      <div className="clave-nueva__valor">
        <input ref={campo} readOnly value={clave.clave} onFocus={(e) => e.target.select()} aria-label="Clave completa" />
        <button className="btn btn--secundario" onClick={copiar}>
          {copiada ? (
            <>
              <IconoCheck size={16} /> Copiada
            </>
          ) : (
            'Copiar'
          )}
        </button>
      </div>
      <button className="btn btn--primario btn--bloque" onClick={onCerrar}>
        Ya la guardé
      </button>
    </div>
  );
}
