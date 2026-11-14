import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { leerNumero, mostrarNumero, pesos } from '../lib/numeros.js';
import { UNIDADES } from '../lib/unidades.js';
import { TIPO_COMPROBANTE } from '../lib/comprobantes.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoVolver, IconoBuscar, IconoMas, IconoCheck, IconoComprobantes } from '../components/iconos.jsx';
import './RevisarComprobante.css';

const PREVISUALIZABLES = ['image/jpeg', 'image/png', 'image/webp'];

// HU15: estado de la asociación propuesta. La confianza es null cuando la
// eligió la persona (o nunca hubo propuesta) y 0 cuando no hubo coincidencia.
function asociacion(d, umbral) {
  const confianza = d.confianza != null ? Number(d.confianza) : null;
  const propuesta = Boolean(d.productoId) && confianza != null;
  return {
    confianza,
    propuesta,
    sinCoincidencia: !d.productoId && confianza === 0,
    dudosa: d.estado !== 'DESCARTADO' && confianza != null && (!d.productoId || confianza < umbral),
  };
}
const porciento = (x) => `${Math.round(x * 100)} %`;
// "GAS COLA 2.25L" → "Gas cola 2.25l": sugerencia editable para el alta.
const sugerirNombre = (texto) => {
  const t = (texto ?? '').trim().toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

const mensajeDeError = (err) => err.detalles?.map?.((d) => d.mensaje).join(' ') || err.message;
const formatoInvalido = 'Número no válido. Usá coma para los decimales, por ejemplo 1,5.';

// M5 / D2 · Revisar remito (HU10). Las correcciones se guardan como borrador;
// "Validar datos" informa si está completo y, si lo está, habilita
// "Confirmar ingreso" (HU11), que suma al stock en una sola operación.
export default function RevisarComprobante() {
  const { id } = useParams();
  const { esPropietario } = useAuth();
  const [comprobante, setComprobante] = useState(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [validando, setValidando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const pendientes = useRef(new Set());

  // Cada guardado se registra para que "Validar datos" espere a que termine.
  const registrar = useCallback((promesa) => {
    pendientes.current.add(promesa);
    setValidacion(null);
    promesa.finally(() => pendientes.current.delete(promesa)).catch(() => {});
    return promesa;
  }, []);

  const recargar = useCallback(
    () => api.get(`/comprobantes/${id}`).then(setComprobante).catch((err) => setError(err.message)),
    [id],
  );
  useEffect(() => {
    recargar();
  }, [recargar]);

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
    // Solo depende del archivo, no de cada edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobante?.id, comprobante?.archivoMime, id]);

  const reemplazarLinea = useCallback((detalle) => {
    setComprobante((c) => ({ ...c, detalles: c.detalles.map((d) => (d.id === detalle.id ? detalle : d)) }));
  }, []);

  async function verArchivo() {
    const ventana = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await api.blob(`/comprobantes/${id}/archivo`));
      if (ventana) ventana.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      ventana?.close();
      setError(err.message);
    }
  }

  async function agregarLinea() {
    setAgregando(true);
    setError('');
    try {
      const nueva = await registrar(api.post(`/comprobantes/${id}/detalles`, {}));
      setComprobante((c) => ({ ...c, detalles: [...c.detalles, nueva] }));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setAgregando(false);
    }
  }

  async function validarDatos() {
    setValidando(true);
    setError('');
    try {
      await Promise.allSettled([...pendientes.current]);
      setValidacion(await api.post(`/comprobantes/${id}/validar`));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setValidando(false);
    }
  }

  // HU11: el backend vuelve a validar todo dentro de la transacción. Un 409
  // (ya confirmado en otra pestaña, número repetido) recarga el comprobante.
  async function confirmarIngreso() {
    setConfirmando(true);
    setError('');
    try {
      await Promise.allSettled([...pendientes.current]);
      setConfirmacion(await api.post(`/comprobantes/${id}/confirmar`));
      setValidacion(null);
      await recargar();
    } catch (err) {
      if (err.status === 400 && err.detalles?.length) {
        setValidacion({ completo: false, problemas: err.detalles, avisos: [] });
      } else {
        setError(mensajeDeError(err));
        if (err.status === 409) {
          setValidacion(null);
          await recargar();
        }
      }
    } finally {
      setConfirmando(false);
    }
  }

  if (!comprobante) {
    return <div className="revisar revisar--cargando">{error || 'Cargando…'}</div>;
  }

  const editable = comprobante.estado === 'EN_REVISION';
  const normalizada = comprobante.respuestaIa?.normalizada;
  const leidas = new Map((normalizada?.lineas ?? []).map((l) => [l.nroLinea, l]));
  const activas = comprobante.detalles.filter((d) => d.estado !== 'DESCARTADO');
  const umbral = comprobante.umbralConfianza ?? 0.8;
  const paraRevisar = comprobante.detalles.filter((d) => asociacion(d, umbral).dudosa).length;
  const unidades = activas.reduce((s, d) => s + (d.cantidad != null ? Number(d.cantidad) : 0), 0);
  const importe = activas.reduce(
    (s, d) => s + (d.cantidad != null && d.precioUnitario != null ? Number(d.cantidad) * Number(d.precioUnitario) : 0),
    0,
  );

  return (
    <div className="revisar">
      <header className="revisar__barra">
        <Link className="revisar__volver" to={`/comprobantes/${id}/lectura`} aria-label="Volver a la lectura">
          <IconoVolver size={20} />
        </Link>
        <div>
          {/* HU18: un comprobante confirmado se consulta desde el archivo. */}
          <h1>{editable ? 'Revisar remito' : `${TIPO_COMPROBANTE[comprobante.tipo] ?? 'Comprobante'} ${comprobante.numero ?? ''}`.trim()}</h1>
          <p>
            {comprobante.proveedor?.razonSocial} · #{comprobante.id}
          </p>
        </div>
      </header>

      {comprobante.estado === 'CONFIRMADO' ? (
        <p className="revisar__confirmado" role="status">
          <IconoCheck size={18} /> Ingreso confirmado
          {comprobante.confirmadoEn ? ` el ${new Date(comprobante.confirmadoEn).toLocaleString('es-AR')}` : ''}
          {comprobante.confirmadoPor ? ` por ${comprobante.confirmadoPor.nombre}` : ''}. El stock ya se actualizó.
        </p>
      ) : (
        !editable && (
          <p className="revisar__aviso">
            Este comprobante no está en revisión (estado: {comprobante.estado}). Se muestra solo para consulta.
          </p>
        )
      )}
      {error && (
        <p className="revisar__error" role="alert">
          {error}
        </p>
      )}

      <div className="revisar__cuerpo">
        <aside className="revisar__archivo card">
          {vista ? (
            <img src={vista} alt="Comprobante original" />
          ) : (
            <div className="revisar__archivo-icono">
              <IconoComprobantes width={36} height={36} />
              <span>{comprobante.origenArchivo === 'PDF' ? 'PDF original' : 'Archivo original'}</span>
            </div>
          )}
          <button className="btn btn--secundario" onClick={verArchivo}>
            Ver archivo
          </button>
        </aside>

        <section className="revisar__datos">
          <Cabecera comprobante={comprobante} editable={editable} registrar={registrar} onGuardado={setComprobante} />

          {comprobante.posibleDuplicado?.length > 0 && (
            <p className="revisar__aviso">
              Posible duplicado: el número leído coincide con el comprobante{' '}
              {comprobante.posibleDuplicado.map((d) => `#${d.id}`).join(', ')} de este proveedor. Revisá el número.
            </p>
          )}
          {normalizada?.motivosRevision?.length > 0 && (
            <ul className="revisar__motivos">
              {normalizada.motivosRevision.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}

          <h2 className="revisar__subtitulo">
            Líneas <span>{activas.length} a ingresar</span>
            {editable && paraRevisar > 0 && <span className="revisar__para-revisar">{paraRevisar} para revisar</span>}
          </h2>
          <div className="revisar__lineas">
            {comprobante.detalles.map((d) => (
              <Linea
                key={d.id}
                comprobanteId={id}
                detalle={d}
                leida={leidas.get(d.nroLinea)}
                editable={editable}
                esPropietario={esPropietario}
                umbral={umbral}
                registrar={registrar}
                onCambio={reemplazarLinea}
              />
            ))}
          </div>
          {editable && (
            <button className="revisar__agregar" onClick={agregarLinea} disabled={agregando}>
              <IconoMas size={18} /> {agregando ? 'Agregando…' : 'Agregar línea'}
            </button>
          )}

          <div className="revisar__resumen card">
            <div>
              <span>Unidades a ingresar</span>
              <strong>{mostrarNumero(unidades)}</strong>
            </div>
            <div>
              <span>Suma de las líneas</span>
              <strong>{pesos(importe)}</strong>
            </div>
            <div>
              <span>Total impreso</span>
              <strong>{pesos(comprobante.totalDeclarado)}</strong>
            </div>
          </div>

          {editable && (
            <button className="btn btn--primario btn--bloque" onClick={validarDatos} disabled={validando}>
              {validando ? 'Validando…' : 'Validar datos'}
            </button>
          )}
          {validacion && (
            <ResultadoValidacion
              validacion={validacion}
              puedeConfirmar={editable}
              confirmando={confirmando}
              onConfirmar={confirmarIngreso}
            />
          )}
          {confirmacion && <ResumenIngreso confirmacion={confirmacion} />}
          {editable && <p className="revisar__pie">Nada entra a tu stock hasta que se confirme el ingreso.</p>}
        </section>
      </div>
    </div>
  );
}

function ResultadoValidacion({ validacion, puedeConfirmar, confirmando, onConfirmar }) {
  return (
    <div className={`revisar__validacion ${validacion.completo ? 'revisar__validacion--ok' : ''}`} role="status">
      {validacion.completo ? (
        <p className="revisar__validacion-titulo">
          <IconoCheck size={18} /> Datos completos. Revisá los avisos y confirmá el ingreso.
        </p>
      ) : (
        <>
          <p className="revisar__validacion-titulo">Faltan datos para confirmar:</p>
          <ul>
            {validacion.problemas.map((p) => (
              <li key={p.mensaje}>{p.mensaje}</li>
            ))}
          </ul>
        </>
      )}
      {validacion.avisos.length > 0 && (
        <ul className="revisar__validacion-avisos">
          {validacion.avisos.map((a) => (
            <li key={a.mensaje}>{a.mensaje}</li>
          ))}
        </ul>
      )}
      {validacion.completo && puedeConfirmar && (
        <button className="btn btn--primario btn--bloque revisar__confirmar" onClick={onConfirmar} disabled={confirmando}>
          {confirmando ? 'Confirmando…' : `Confirmar ingreso (${mostrarNumero(validacion.resumen.unidades)} unidades)`}
        </button>
      )}
    </div>
  );
}

function ResumenIngreso({ confirmacion }) {
  return (
    <div className="revisar__ingreso card">
      <h2 className="revisar__subtitulo">Stock actualizado</h2>
      <ul>
        {confirmacion.lineas.map((l) => (
          <li key={l.nroLinea}>
            <span>{l.producto.nombre}</span>
            <span>
              {mostrarNumero(l.stockAnterior)} + {mostrarNumero(l.cantidad)} → <strong>{mostrarNumero(l.stockNuevo)}</strong>
            </span>
          </li>
        ))}
      </ul>
      <Link className="btn btn--secundario btn--bloque" to="/productos">
        Ver productos
      </Link>
    </div>
  );
}

function Cabecera({ comprobante, editable, registrar, onGuardado }) {
  const inicial = () => ({
    numero: comprobante.numero ?? '',
    fechaEmision: comprobante.fechaEmision ? comprobante.fechaEmision.slice(0, 10) : '',
    tipo: comprobante.tipo,
    totalDeclarado: comprobante.totalDeclarado != null ? mostrarNumero(comprobante.totalDeclarado, 2) : '',
  });
  const [campos, setCampos] = useState(inicial);
  const [estado, setEstado] = useState({});
  const leido = comprobante.respuestaIa?.normalizada?.cabecera;

  async function guardar(campo, valor) {
    setEstado((e) => ({ ...e, [campo]: { guardando: true } }));
    try {
      const r = await registrar(api.patch(`/comprobantes/${comprobante.id}/cabecera`, { [campo]: valor }));
      onGuardado((c) => ({ ...c, ...r }));
      setEstado((e) => ({ ...e, [campo]: { ok: true } }));
    } catch (err) {
      setEstado((e) => ({ ...e, [campo]: { error: mensajeDeError(err) } }));
    }
  }

  function alSalir(campo) {
    const texto = campos[campo];
    if (campo === 'totalDeclarado') {
      const v = leerNumero(texto);
      if (Number.isNaN(v)) return setEstado((e) => ({ ...e, [campo]: { error: formatoInvalido } }));
      if (v === (comprobante.totalDeclarado != null ? Number(comprobante.totalDeclarado) : null)) return undefined;
      return guardar(campo, v);
    }
    const actual = campo === 'fechaEmision' ? inicial().fechaEmision : comprobante[campo] ?? '';
    if (texto === actual) return undefined;
    return guardar(campo, texto === '' ? null : texto);
  }

  const campo = (nombre, etiqueta, input, ayuda) => (
    <label className="revisar__campo">
      <span>{etiqueta}</span>
      {input}
      {estado[nombre]?.error && <small className="revisar__campo-error">{estado[nombre].error}</small>}
      {!estado[nombre]?.error && estado[nombre]?.ok && <small className="revisar__campo-ok">Guardado</small>}
      {!estado[nombre]?.error && !estado[nombre]?.ok && ayuda && <small>{ayuda}</small>}
    </label>
  );
  const props = (nombre) => ({
    value: campos[nombre],
    disabled: !editable,
    onChange: (e) => setCampos((c) => ({ ...c, [nombre]: e.target.value })),
    onBlur: () => alSalir(nombre),
  });

  return (
    <div className="revisar__cabecera card">
      {campo('numero', 'Número', <input {...props('numero')} placeholder="0001-00000000" />, leido?.numero && `Leído: ${leido.numero}`)}
      {campo('fechaEmision', 'Fecha de emisión', <input type="date" {...props('fechaEmision')} />)}
      {campo(
        'tipo',
        'Tipo',
        <select
          value={campos.tipo}
          disabled={!editable}
          onChange={(e) => {
            setCampos((c) => ({ ...c, tipo: e.target.value }));
            guardar('tipo', e.target.value);
          }}
        >
          <option value="REMITO">Remito</option>
          <option value="FACTURA">Factura</option>
          <option value="OTRO">Otro</option>
        </select>,
      )}
      {campo('totalDeclarado', 'Total impreso', <input inputMode="decimal" {...props('totalDeclarado')} placeholder="0,00" />)}
    </div>
  );
}

function Linea({ comprobanteId, detalle: d, leida, editable, esPropietario, umbral, registrar, onCambio }) {
  const a = asociacion(d, umbral);
  const [cantidad, setCantidad] = useState(d.cantidad != null ? mostrarNumero(d.cantidad) : '');
  const [precio, setPrecio] = useState(d.precioUnitario != null ? mostrarNumero(d.precioUnitario, 2) : '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eligiendo, setEligiendo] = useState(!d.productoId);
  // Sin coincidencia en el catálogo: al propietario se le propone el alta.
  const [creando, setCreando] = useState(a.sinCoincidencia && esPropietario);
  const descartada = d.estado === 'DESCARTADO';

  async function guardar(cambios) {
    setGuardando(true);
    setError('');
    try {
      const actualizado = await registrar(api.patch(`/comprobantes/${comprobanteId}/detalles/${d.id}`, cambios));
      onCambio(actualizado);
      return actualizado;
    } catch (err) {
      setError(mensajeDeError(err));
      return null;
    } finally {
      setGuardando(false);
    }
  }

  function alSalirNumero(campo, texto, actual) {
    const v = leerNumero(texto);
    if (Number.isNaN(v)) return setError(formatoInvalido);
    if (v === (actual != null ? Number(actual) : null)) return setError('');
    return guardar({ [campo]: v });
  }

  async function elegirProducto(producto) {
    const ok = await guardar({ productoId: producto.id });
    if (ok) {
      setEligiendo(false);
      setCreando(false);
    }
  }

  const subtotal = d.cantidad != null && d.precioUnitario != null ? Number(d.cantidad) * Number(d.precioUnitario) : null;
  const motivos = leida?.motivosRevision ?? [];

  return (
    <article
      className={`revisar__linea card ${descartada ? 'revisar__linea--descartada' : ''} ${editable && a.dudosa ? 'revisar__linea--dudosa' : ''}`}
    >
      <div className="revisar__linea-cabeza">
        <span className="revisar__nro">{d.nroLinea}</span>
        <div className="revisar__leido">
          {d.agregadaManualmente ? (
            <strong>Línea agregada a mano</strong>
          ) : (
            <>
              <strong>Leído: {d.descripcionExtraida ?? 'sin descripción'}</strong>
              <span>
                {d.codigoExtraido ? `Cód. ${d.codigoExtraido} · ` : ''}
                Cant. impresa: {leida?.cantidadTexto ? `«${leida.cantidadTexto}»` : 'sin dato'}
                {d.precioUnitarioExtraido != null ? ` · P. unit. ${pesos(d.precioUnitarioExtraido)}` : ''}
              </span>
            </>
          )}
        </div>
        {editable && (
          <button className="revisar__descartar" onClick={() => guardar({ descartada: !descartada })} disabled={guardando}>
            {descartada ? 'Restaurar' : 'Descartar'}
          </button>
        )}
      </div>

      {descartada ? (
        <p className="revisar__descartada-nota">Descartada: no se ingresará.</p>
      ) : (
        <>
          {motivos.length > 0 && (
            <ul className="revisar__linea-motivos">
              {motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}

          <div className="revisar__producto">
            {d.producto && !eligiendo ? (
              <div className="revisar__producto-elegido">
                {!d.producto.activo ? (
                  <span className="badge badge--sin-stock">Desactivado</span>
                ) : a.propuesta ? (
                  <span
                    className={`badge ${editable && a.dudosa ? 'badge--stock-bajo' : 'badge--ia'}`}
                    title="Propuesto automáticamente según la descripción leída"
                  >
                    {/* Confirmado el ingreso ya no hay nada que revisar. */}
                    {editable && a.dudosa ? 'Revisar' : 'Propuesto'} · {porciento(a.confianza)}
                  </span>
                ) : (
                  <span className="badge badge--en-stock">Asociado</span>
                )}
                <strong>{d.producto.nombre}</strong>
                {editable && a.propuesta && a.dudosa && (
                  <button className="revisar__enlace" onClick={() => guardar({ productoId: d.productoId })} disabled={guardando}>
                    Es correcto
                  </button>
                )}
                {editable && (
                  <button className="revisar__enlace" onClick={() => setEligiendo(true)}>
                    Cambiar
                  </button>
                )}
              </div>
            ) : editable ? (
              <>
                {a.sinCoincidencia && (
                  <p className="revisar__sin-coincidencia">No encontramos un producto parecido en el catálogo.</p>
                )}
                <BuscadorProducto onElegir={elegirProducto} />
                {esPropietario && !creando && (
                  <button className="revisar__enlace" onClick={() => setCreando(true)}>
                    No está en el catálogo: crear producto
                  </button>
                )}
                {esPropietario && creando && (
                  <AltaProducto nombreSugerido={sugerirNombre(d.descripcionExtraida)} onCreado={elegirProducto} onCancelar={() => setCreando(false)} />
                )}
                {!esPropietario && <small className="revisar__nota">Si el producto no existe, pedile al propietario que lo cree.</small>}
                {d.producto && (
                  <button className="revisar__enlace" onClick={() => setEligiendo(false)}>
                    Mantener {d.producto.nombre}
                  </button>
                )}
              </>
            ) : (
              <span className="badge badge--sin-stock">Sin producto</span>
            )}
          </div>

          <div className="revisar__numeros">
            <label className="revisar__campo">
              <span>Cantidad</span>
              <input
                inputMode="decimal"
                value={cantidad}
                disabled={!editable}
                placeholder="—"
                onChange={(e) => setCantidad(e.target.value)}
                onBlur={() => alSalirNumero('cantidad', cantidad, d.cantidad)}
              />
            </label>
            <label className="revisar__campo">
              <span>Precio unitario</span>
              <input
                inputMode="decimal"
                value={precio}
                disabled={!editable}
                placeholder="—"
                onChange={(e) => setPrecio(e.target.value)}
                onBlur={() => alSalirNumero('precioUnitario', precio, d.precioUnitario)}
              />
            </label>
            <div className="revisar__subtotal">
              <span>Subtotal</span>
              <strong>{pesos(subtotal)}</strong>
            </div>
          </div>
        </>
      )}
      {guardando && <small className="revisar__nota">Guardando…</small>}
      {error && (
        <small className="revisar__campo-error" role="alert">
          {error}
        </small>
      )}
    </article>
  );
}

function BuscadorProducto({ onElegir }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return undefined;
    }
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .get(`/productos?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setResultados(r.slice(0, 8)))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="revisar__buscador">
      <div className="input">
        <IconoBuscar size={18} color="var(--texto-suave)" />
        <input placeholder="Buscar producto del catálogo" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim().length >= 2 && (
        <ul className="revisar__resultados">
          {buscando && <li className="revisar__nota">Buscando…</li>}
          {!buscando && resultados.length === 0 && <li className="revisar__nota">Sin resultados.</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button onClick={() => onElegir(p)}>
                {p.nombre}
                {p.categoria ? <small> · {p.categoria.nombre}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AltaProducto({ nombreSugerido, onCreado, onCancelar }) {
  const [nombre, setNombre] = useState(nombreSugerido);
  const [unidadMedida, setUnidadMedida] = useState('UNIDAD');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function crear(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      onCreado(await api.post('/productos', { nombre, unidadMedida }));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="revisar__alta" onSubmit={crear}>
      <label className="revisar__campo">
        <span>Nombre del producto nuevo</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </label>
      <label className="revisar__campo">
        <span>Unidad de medida</span>
        <select value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)}>
          {UNIDADES.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {error && <small className="revisar__campo-error">{error}</small>}
      <div className="revisar__alta-acciones">
        <button type="submit" className="btn btn--primario" disabled={enviando || !nombre.trim()}>
          {enviando ? 'Creando…' : 'Crear y asociar'}
        </button>
        <button type="button" className="btn btn--secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
