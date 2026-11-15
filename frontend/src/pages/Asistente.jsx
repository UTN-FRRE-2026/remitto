import { useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../lib/api.js';
import { mostrarNumero, pesos } from '../lib/numeros.js';
import GraficoPrecios, { COLORES_SERIE } from '../components/GraficoPrecios.jsx';
import { IconoAsistente } from '../components/iconos.jsx';
import './Asistente.css';

// HU25 · Asistente (M8): preguntas en castellano sobre el stock. El backend
// elige una herramienta de lectura habilitada y arma el texto, la tabla o el
// gráfico con los datos reales; acá solo se muestran. Solo el propietario.
const SUGERENCIAS = [
  '¿Cuánta yerba me queda?',
  '¿Qué me está faltando?',
  '¿Qué tengo que reponer?',
  '¿Cuánta gaseosa salió esta semana?',
  '¿Qué fue lo más vendido este mes?',
  '¿Qué no se vendió este mes?',
  '¿Cuánto me aumentó la yerba en los últimos tres meses?',
  '¿Qué productos me aumentaron más del 15 % este trimestre?',
];

const dia = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

function valor(v, tipo) {
  if (v === null || v === undefined || v === '') return '—';
  if (tipo === 'pesos') return pesos(v);
  if (tipo === 'numero') return mostrarNumero(v);
  if (tipo === 'porcentaje') return `${v > 0 ? '+' : ''}${mostrarNumero(v, 1)} %`;
  if (tipo === 'fecha') return dia(v);
  return String(v);
}

function Tabla({ presentacion }) {
  const { columnas, filas } = presentacion;
  if (!columnas?.length || !filas?.length) return null;
  return (
    <div className="asistente__tabla-envoltorio">
      <table className="asistente__tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} className={c.tipo && c.tipo !== 'texto' && c.tipo !== 'fecha' ? 'asistente__num' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c.clave} className={c.tipo && c.tipo !== 'texto' && c.tipo !== 'fecha' ? 'asistente__num' : undefined}>
                  {valor(f[c.clave], c.tipo)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Barras simples para el ranking: largo proporcional a la cantidad.
function Barras({ filas }) {
  const max = Math.max(...filas.map((f) => f.cantidad), 0);
  return (
    <ul className="asistente__barras" aria-hidden>
      {filas.slice(0, 10).map((f) => (
        <li key={f.puesto}>
          <span className="asistente__barra-nombre">{f.producto}</span>
          <span className="asistente__barra">
            <span style={{ width: `${max ? Math.max((f.cantidad / max) * 100, 2) : 0}%` }} />
          </span>
          <span className="asistente__barra-valor">
            {mostrarNumero(f.cantidad)} {f.unidad}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Presentacion({ p }) {
  if (!p || p.tipo === 'texto') return null;
  const series = p.grafico === 'precios' ? (p.series ?? []).map((s, i) => ({ ...s, color: COLORES_SERIE[i % COLORES_SERIE.length] })) : null;
  return (
    <section className="asistente__datos" aria-label={p.titulo}>
      <h3>{p.titulo}</h3>
      {series && <GraficoPrecios series={series} />}
      {p.grafico === 'barras' && p.filas?.length > 0 && <Barras filas={p.filas} />}
      <Tabla presentacion={p} />
      {p.totales && (
        <dl className="asistente__totales">
          {Object.entries(p.totales).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{typeof v === 'number' ? mostrarNumero(v) : v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.nota && <p className="asistente__nota">{p.nota}</p>}
    </section>
  );
}

export default function Asistente() {
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);

  useEffect(() => {
    fin.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [mensajes]);

  async function enviar(texto, peticion) {
    if (enviando) return;
    setEnviando(true);
    setMensajes((m) => [...m, { tipo: 'pregunta', texto }]);
    try {
      const r = await peticion();
      setMensajes((m) => [...m, { tipo: 'respuesta', r }]);
    } catch (err) {
      // Los 503 y 500 del asistente traen su mensaje en «respuesta» (por
      // ejemplo, que falta configurar el servicio de IA).
      const respuesta = err.datos?.accion === 'error' && err.datos.respuesta ? err.datos.respuesta : mensajeDeError(err);
      setMensajes((m) => [...m, { tipo: 'respuesta', r: { accion: 'error', respuesta } }]);
    } finally {
      setEnviando(false);
    }
  }

  function preguntar(texto) {
    const t = texto.trim();
    if (!t) return;
    setPregunta('');
    enviar(t, () => api.post('/asistente/consultas', { pregunta: t }));
  }

  function elegir(indice, consultaId, opcion) {
    // La opción se marca elegida para no reenviarla.
    setMensajes((m) => m.map((x, i) => (i === indice ? { ...x, elegida: opcion.id } : x)));
    enviar(opcion.nombre, () => api.post(`/asistente/consultas/${consultaId}/eleccion`, { productoId: opcion.id }));
  }

  return (
    <div className="asistente">
      <h1 className="asistente__titulo">Asistente</h1>
      <p className="asistente__ayuda">Preguntale a tu stock en castellano. Las cifras salen de los datos registrados.</p>

      {mensajes.length === 0 && (
        <div className="asistente__sugerencias" aria-label="Preguntas sugeridas">
          {SUGERENCIAS.map((s) => (
            <button key={s} className="chip" onClick={() => preguntar(s)} disabled={enviando}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="asistente__conversacion" aria-live="polite">
        {mensajes.map((m, i) =>
          m.tipo === 'pregunta' ? (
            <p key={i} className="asistente__pregunta">
              {m.texto}
            </p>
          ) : (
            <article key={i} className={`card asistente__respuesta ${m.r.accion === 'error' ? 'asistente__respuesta--error' : ''}`}>
              <p className="asistente__texto">
                <IconoAsistente size={18} /> {m.r.respuesta}
              </p>
              {m.r.opciones?.length > 0 && (
                <div className="asistente__opciones">
                  {m.r.opciones.map((o) => (
                    <button
                      key={o.id}
                      className={`chip ${m.elegida === o.id ? 'chip--activo' : ''}`}
                      disabled={m.elegida != null || enviando}
                      onClick={() => elegir(i, m.r.id, o)}
                    >
                      {o.nombre}
                    </button>
                  ))}
                </div>
              )}
              <Presentacion p={m.r.presentacion} />
            </article>
          ),
        )}
        {enviando && <p className="asistente__cargando">Consultando…</p>}
        <div ref={fin} />
      </div>

      <form
        className="card asistente__formulario"
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(pregunta);
        }}
      >
        <input
          aria-label="Tu pregunta"
          placeholder="Por ejemplo: ¿Qué tengo que reponer?"
          value={pregunta}
          maxLength={500}
          onChange={(e) => setPregunta(e.target.value)}
        />
        <button className="btn btn--primario" type="submit" disabled={enviando || !pregunta.trim()}>
          Preguntar
        </button>
      </form>
    </div>
  );
}
