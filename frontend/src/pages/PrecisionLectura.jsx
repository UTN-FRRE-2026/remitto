import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { detallePrecision, fechaHora, porcentaje, rutaComprobante, tituloComprobante } from '../lib/comprobantes.js';
import { IconoVolver } from '../components/iconos.jsx';
import './Productos.css';
import './Catalogo.css';
import './Comprobantes.css';

// HU19 · Precisión de la lectura con IA: lo leído contra lo confirmado, en
// general y por comprobante. Solo cuentan los comprobantes confirmados.
export default function PrecisionLectura() {
  const navegar = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/comprobantes/precision')
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  return (
    <div className="catalogo comprobantes precision">
      <header className="catalogo__cabecera">
        <h1 className="catalogo__titulo precision__titulo">
          <Link to="/comprobantes" className="precision__volver" aria-label="Volver a los comprobantes">
            <IconoVolver size={20} />
          </Link>
          Precisión de la lectura
        </h1>
      </header>

      {error && <p className="error-texto">{error}</p>}
      {!datos && !error && <p className="card lista__estado">Calculando…</p>}
      {datos && <Resumen datos={datos} />}

      {datos && datos.comprobantes.length > 0 && (
        <div className="card lista">
          {datos.comprobantes.map((c) => (
            <div
              key={c.id}
              className="comprobante"
              onClick={() => navegar(rutaComprobante({ ...c, destino: 'VER' }))}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navegar(rutaComprobante({ ...c, destino: 'VER' }))}
            >
              <div className="comprobante__datos">
                <strong>{tituloComprobante(c)}</strong>
                <span>
                  {c.proveedor.razonSocial} · confirmado {fechaHora(c.confirmadoEn)}
                </span>
                <span className="comprobante__detalle">
                  {c.correctas} de {c.lineas} {c.lineas === 1 ? 'línea correcta' : 'líneas correctas'}
                  {detallePrecision(c) ? ` · ${detallePrecision(c)}` : ''}
                </span>
              </div>
              <div className="comprobante__lado">
                <strong className="precision__valor">{porcentaje(c.porcentaje)}</strong>
                {c.simulada && <span className="badge badge--ia">Simulada</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Resumen({ datos }) {
  const { general, meta, simuladas } = datos;
  const faltan = meta.comprobantes - general.comprobantes;
  return (
    <>
      <section className="card precision__resumen" aria-labelledby="precision-general">
        <h2 id="precision-general">Líneas leídas correctamente</h2>
        <strong className="precision__general">{porcentaje(general.porcentaje)}</strong>
        <p>
          {general.correctas} de {general.lineas} {general.lineas === 1 ? 'línea' : 'líneas'} en {general.comprobantes}{' '}
          {general.comprobantes === 1 ? 'comprobante confirmado' : 'comprobantes confirmados'}. Una línea es correcta si se confirmó con
          la cantidad y el precio que leyó la IA.
        </p>
        <p className={`precision__meta ${meta.cumple === true ? 'precision__meta--ok' : meta.cumple === false ? 'precision__meta--no' : ''}`}>
          {meta.cumple === null
            ? `Meta: ${meta.porcentaje} % sobre ${meta.comprobantes} comprobantes. Faltan ${faltan} ${faltan === 1 ? 'comprobante' : 'comprobantes'} para completar la muestra.`
            : meta.cumple
              ? `✔ Se cumple la meta: ${meta.porcentaje} % o más sobre ${general.comprobantes} comprobantes.`
              : `✘ Por debajo de la meta del ${meta.porcentaje} % (${general.comprobantes} comprobantes).`}
        </p>
        {simuladas > 0 && (
          <p className="precision__nota">
            No incluye {simuladas === 1 ? '1 comprobante' : `${simuladas} comprobantes`} con lectura simulada (pruebas sin IA real).
          </p>
        )}
      </section>

      {general.lineas > 0 && (
        <section className="card precision__desglose" aria-label="Detalle de las líneas">
          <dl>
            <div>
              <dt>Correctas</dt>
              <dd>{general.correctas}</dd>
            </div>
            <div>
              <dt>Corregidas</dt>
              <dd>
                {general.corregidas}
                {general.corregidas > 0 && (
                  <small>
                    {[
                      general.erroresCantidad && `${general.erroresCantidad} en la cantidad`,
                      general.erroresPrecio && `${general.erroresPrecio} en el precio`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Descartadas</dt>
              <dd>{general.descartadas}</dd>
            </div>
            <div>
              <dt>Agregadas a mano</dt>
              <dd>{general.omitidas}</dd>
            </div>
          </dl>
          <p className="precision__nota">
            Corregidas: la persona cambió la cantidad o el precio. Descartadas: la IA leyó un renglón que no era un producto.
            Agregadas a mano: líneas que la IA no leyó.
          </p>
        </section>
      )}

      {datos.comprobantes.length === 0 && <p className="card lista__estado">Todavía no hay comprobantes confirmados con lectura de IA.</p>}
    </>
  );
}
