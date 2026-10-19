import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { IconoAsistente, IconoCheck, IconoComprobantes, IconoVolver } from '../components/iconos.jsx';
import './LecturaComprobante.css';

const PREVISUALIZABLES = ['image/jpeg', 'image/png', 'image/webp'];
const segundos = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
const numero = (v, dec = 0) =>
  v == null ? null : Number(v).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: 3 });

// M4 · Leyendo con IA (HU9): progreso de la lectura y resumen de solo lectura.
// La edición y la confirmación del comprobante llegan con HU10.
export default function LecturaComprobante() {
  const { id } = useParams();
  const location = useLocation();
  const navegar = useNavigate();
  const [comprobante, setComprobante] = useState(null);
  const [estado, setEstado] = useState(null);
  const [vista, setVista] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inicioPedido = useRef(false);
  const desdePolling = useRef(Date.now());

  const cargarComprobante = useCallback(async () => {
    setComprobante(await api.get(`/comprobantes/${id}`));
  }, [id]);

  const pedirLectura = useCallback(async () => {
    setEnviando(true);
    setError('');
    try {
      setEstado(await api.post(`/comprobantes/${id}/procesar`));
      desdePolling.current = Date.now();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }, [id]);

  // Carga inicial. Solo arranca la lectura sola si viene de una carga recién
  // hecha; un comprobante anterior requiere tocar "Leer con IA".
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [c, e] = await Promise.all([api.get(`/comprobantes/${id}`), api.get(`/comprobantes/${id}/estado`)]);
        if (!vigente) return;
        setComprobante(c);
        setEstado(e);
        if (location.state?.iniciar && !inicioPedido.current) {
          inicioPedido.current = true;
          navegar(location.pathname, { replace: true, state: null });
          if (e.estado === 'PENDIENTE') await pedirLectura();
        }
      } catch (err) {
        if (vigente) setError(err.message);
      }
    })();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Consulta del progreso: cada 2 s el primer minuto, después cada 5 s.
  useEffect(() => {
    if (estado?.estado !== 'PROCESANDO') return undefined;
    const pausa = Date.now() - desdePolling.current < 60_000 ? 2000 : 5000;
    const t = setTimeout(async () => {
      try {
        const e = await api.get(`/comprobantes/${id}/estado`);
        setEstado(e);
        if (e.estado !== 'PROCESANDO') await cargarComprobante();
      } catch (err) {
        setError(err.message);
      }
    }, pausa);
    return () => clearTimeout(t);
  }, [estado, id, cargarComprobante]);

  // Vista previa del archivo original (descarga autenticada).
  useEffect(() => {
    if (!comprobante || !PREVISUALIZABLES.includes(comprobante.archivoMime)) return undefined;
    let url;
    api
      .blob(`/comprobantes/${id}/archivo`)
      .then((b) => {
        url = URL.createObjectURL(b);
        setVista(url);
      })
      .catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [comprobante, id]);

  const fase = estado?.fase;
  const leyendo = fase === 'EN_COLA' || fase === 'LEYENDO';
  const listo = estado?.estado === 'EN_REVISION';
  const fallo = estado?.estado === 'ERROR';
  const t = estado?.tiempos;

  let titulo = 'Lectura con IA';
  if (leyendo) titulo = fase === 'EN_COLA' ? 'Tu remito está en espera' : 'Estamos leyendo tu remito';
  else if (listo) titulo = 'Listo para revisar';
  else if (fallo) titulo = 'No pudimos leer el remito';

  const normalizada = comprobante?.respuestaIa?.normalizada;
  const motivosLinea = new Map((normalizada?.lineas ?? []).map((l) => [l.nroLinea, l]));

  return (
    <div className="lectura">
      <header className="lectura__barra">
        <button className="lectura__volver" onClick={() => navegar(-1)} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <span>Comprobante #{id}</span>
      </header>

      <div className="lectura__archivo">
        {vista ? (
          <img src={vista} alt="Comprobante cargado" />
        ) : (
          <div className="lectura__archivo-icono">
            <IconoComprobantes width={40} height={40} />
            <span>{comprobante?.origenArchivo === 'PDF' ? 'PDF' : 'Archivo'}</span>
          </div>
        )}
      </div>

      <section className="lectura__hoja card" aria-live="polite">
        <span className="badge badge--ia lectura__etiqueta">
          <IconoAsistente width={14} height={14} /> Lectura con IA
        </span>
        <h1>{titulo}</h1>

        <ol className="lectura__pasos">
          <Paso hecho titulo="Archivo recibido" detalle={comprobante?.proveedor?.razonSocial} />
          <Paso
            hecho={listo}
            activo={leyendo}
            error={fallo}
            titulo="Leyendo los ítems"
            detalle={
              fase === 'EN_COLA'
                ? `En espera hace ${segundos(t?.esperaColaMs)}`
                : fase === 'LEYENDO'
                  ? `Leyendo hace ${segundos(t?.ejecucionMs)}`
                  : listo
                    ? `${estado.lineas} ${estado.lineas === 1 ? 'línea detectada' : 'líneas detectadas'}`
                    : fallo
                      ? estado.error?.mensaje
                      : 'Todavía no se leyó'
            }
          />
          <Paso hecho={listo} titulo="Listo para revisar" />
        </ol>

        {t && (
          <p className="lectura__tiempos">
            Espera en cola {segundos(t.esperaColaMs)} · Lectura {segundos(t.ejecucionMs)} · Total {segundos(t.totalMs)}
            {estado.rnf2 === 'EXCEDIDO' && <strong> · superó el objetivo de {segundos(estado.objetivoMs)}</strong>}
          </p>
        )}

        {error && (
          <p className="lectura__error" role="alert">
            {error}
          </p>
        )}

        {estado?.estado === 'PENDIENTE' && (
          <div className="lectura__acciones">
            {estado.puedeLeer ? (
              <button className="btn btn--primario btn--bloque" onClick={pedirLectura} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Leer con IA'}
              </button>
            ) : (
              <p className="lectura__nota">La lectura con IA no está disponible en este momento.</p>
            )}
          </div>
        )}

        {fallo && (
          <div className="lectura__acciones">
            {estado.puedeLeer && (
              <button className="btn btn--primario btn--bloque" onClick={pedirLectura} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Reintentar'}
              </button>
            )}
            <Link className="btn btn--secundario btn--bloque" to="/cargar">
              Subir otra foto
            </Link>
            <p className="lectura__nota">
              Lecturas usadas: {estado.intentos} de {estado.maxIntentos}
              {!estado.puedeLeer && estado.intentos >= estado.maxIntentos && ' · se alcanzó el límite'}
            </p>
          </div>
        )}

        {listo && normalizada && (
          <div className="lectura__resultado">
            {estado.posibleDuplicado?.length > 0 && (
              <p className="lectura__aviso">
                Posible duplicado: el número leído coincide con el comprobante{' '}
                {estado.posibleDuplicado.map((d) => `#${d.id}`).join(', ')} de este proveedor. Se podrá corregir al revisar.
              </p>
            )}
            <dl className="lectura__cabecera">
              <div>
                <dt>Número leído</dt>
                <dd>{normalizada.cabecera.numero ?? 'sin dato'}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{normalizada.cabecera.fechaEmision ?? 'sin dato'}</dd>
              </div>
              <div>
                <dt>Total impreso</dt>
                <dd>{normalizada.cabecera.totalDeclarado != null ? `$ ${numero(normalizada.cabecera.totalDeclarado, 2)}` : 'sin dato'}</dd>
              </div>
            </dl>
            {normalizada.motivosRevision.length > 0 && (
              <ul className="lectura__motivos">
                {normalizada.motivosRevision.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <div className="lectura__tabla" role="table" aria-label="Líneas leídas">
              {comprobante.detalles.map((d) => {
                const motivos = motivosLinea.get(d.nroLinea)?.motivosRevision ?? [];
                const unidad = motivosLinea.get(d.nroLinea)?.unidad;
                return (
                  <div key={d.id} className={`lectura__linea ${motivos.length ? 'lectura__linea--revisar' : ''}`} role="row">
                    <div className="lectura__linea-datos">
                      <strong>{d.descripcionExtraida ?? 'Sin descripción'}</strong>
                      <span>{d.codigoExtraido ? `Cód. ${d.codigoExtraido}` : 'Sin código'}</span>
                    </div>
                    <div className="lectura__linea-numeros">
                      <strong>{d.cantidadExtraida != null ? numero(d.cantidadExtraida) : 'sin dato'}</strong>
                      <span>{unidad ?? ''}</span>
                      <span>{d.precioUnitarioExtraido != null ? `$ ${numero(d.precioUnitarioExtraido, 2)}` : 'sin precio'}</span>
                    </div>
                    {motivos.length > 0 && (
                      <ul className="lectura__linea-motivos">
                        {motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="lectura__nota">La revisión y la confirmación del ingreso llegan en la próxima etapa.</p>
          </div>
        )}

        <p className="lectura__pie">Nada entra a tu stock hasta que lo confirmes.</p>
      </section>
    </div>
  );
}

function Paso({ hecho, activo, error, titulo, detalle }) {
  const clase = hecho ? 'hecho' : error ? 'error' : activo ? 'activo' : 'pendiente';
  return (
    <li className={`lectura__paso lectura__paso--${clase}`}>
      <span className="lectura__paso-marca">{hecho ? <IconoCheck size={16} /> : activo ? <span className="lectura__girando" /> : null}</span>
      <div>
        <strong>{titulo}</strong>
        {detalle && <span>{detalle}</span>}
      </div>
    </li>
  );
}
