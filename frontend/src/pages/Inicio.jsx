import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoRemitto, IconoCampana, IconoCamara, IconoProductos } from '../components/iconos.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { rutaComprobante, tituloComprobante, fechaHora, ESTADO_COMPROBANTE } from '../lib/comprobantes.js';
import { pesos } from '../lib/numeros.js';
import './Inicio.css';

function saludo() {
  const h = new Date().getHours();
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaLarga() {
  const f = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

// HU24: tipos de alerta, de más a menos grave (mismos textos que Alertas).
const TIPOS_ALERTA = [
  { tipo: 'STOCK_NEGATIVO', texto: 'Negativo', clase: 'badge--sin-stock' },
  { tipo: 'SIN_STOCK', texto: 'Sin stock', clase: 'badge--sin-stock' },
  { tipo: 'STOCK_BAJO', texto: 'Stock bajo', clase: 'badge--stock-bajo' },
];
const tipoAlerta = (tipo) => TIPOS_ALERTA.find((t) => t.tipo === tipo);
// Pendientes: cargados y no confirmados ni anulados (mismo criterio que el backend).
const ESTADOS_PENDIENTES = ['PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'ERROR'];
// Filtro de la pantalla Comprobantes para cada estado (agrupa sin leer y leyendo).
const FILTRO_COMPROBANTES = { PENDIENTE: 'EN_PROCESO', PROCESANDO: 'EN_PROCESO', EN_REVISION: 'EN_REVISION', ERROR: 'ERROR' };

// HU26: tablero de situación. Todo sale de GET /api/tablero, que lee la base
// en una sola foto: los números de las tarjetas coinciden entre sí. El valor
// del stock (costos) solo llega para el propietario.
export default function Inicio() {
  const { usuario, esPropietario } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/tablero')
      .then(setDatos)
      .catch((err) => setError(err.message));
  }, []);

  const nombreCorto = usuario?.nombre?.split(' ')[0] ?? '';
  const resumen = datos?.stock;
  const alertas = datos?.alertas;
  const comprobantes = datos?.comprobantes;
  const reponer = datos?.reponer ?? [];
  const valor = datos?.valorStock;

  return (
    <div className="inicio">
      <header className="topbar">
        <div className="topbar__marca">
          <span className="topbar__logo">
            <IconoRemitto size={20} />
          </span>
          <div>
            <strong>Remitto</strong>
            <span className="topbar__sub">Almacén Don Carlos</span>
          </div>
        </div>
        <div className="topbar__acciones">
          <button
            className="topbar__accion"
            onClick={() => navegar('/alertas')}
            aria-label={alertas?.totales.total ? `Alertas de stock: ${alertas.totales.total} activas` : 'Alertas de stock'}
          >
            <IconoCampana size={20} />
            {alertas?.totales.total > 0 && <span className="topbar__punto" />}
          </button>
          <button className="topbar__avatar" onClick={() => navegar('/cuenta')} aria-label="Mi cuenta">
            {(usuario?.nombre ?? '')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()}
          </button>
        </div>
      </header>

      <h1 className="inicio__saludo">
        {saludo()}, {nombreCorto}
      </h1>
      <p className="inicio__bajada">{fechaLarga()}</p>

      {/* Tarjeta de carga de remito */}
      <button className="cargar-card" onClick={() => navegar('/cargar')}>
        <div>
          <h2>Cargar un remito</h2>
          <p>Sacale una foto y Remitto registra la mercadería por vos.</p>
        </div>
        <span className="cargar-card__cam">
          <IconoCamara size={24} />
        </span>
      </button>

      {error && (
        <p className="error-texto inicio__error" role="alert">
          No se pudo cargar el tablero: {error}
        </p>
      )}

      {/* Indicadores */}
      <div className="indicadores">
        <div className="indicador indicador--verde">
          <span className="indicador__label">
            <IconoProductos size={16} /> Productos
          </span>
          <strong>{resumen?.totalProductos ?? '—'}</strong>
        </div>
        <div className="indicador indicador--dorado">
          <span className="indicador__label">⚠ Stock bajo</span>
          <strong>{resumen?.stockBajo ?? '—'}</strong>
        </div>
        <div className="indicador indicador--rojo">
          <span className="indicador__label">⊗ Sin stock</span>
          <strong>{resumen?.sinStock ?? '—'}</strong>
        </div>
        <div className="indicador indicador--azul">
          <span className="indicador__label">▤ En stock</span>
          <strong>{resumen?.enStock ?? '—'}</strong>
        </div>
      </div>

      {/* HU26: situación (alertas activas, comprobantes pendientes y valor del stock) */}
      <div className="situacion">
        <section className="card situacion__tarjeta" aria-labelledby="tit-alertas">
          <header className="situacion__cabecera">
            <h3 id="tit-alertas">Alertas activas</h3>
            <strong className="situacion__total">{alertas ? alertas.totales.total : '—'}</strong>
          </header>
          {alertas && (
            <>
              <div className="situacion__chips">
                {TIPOS_ALERTA.map((t) => (
                  <span key={t.tipo} className={`badge ${alertas.totales[t.tipo] ? t.clase : 'badge--inactivo'}`}>
                    {t.texto} · {alertas.totales[t.tipo]}
                  </span>
                ))}
              </div>
              {alertas.principales.length === 0 ? (
                <p className="situacion__vacio">No hay alertas de stock.</p>
              ) : (
                <ul className="situacion__lista">
                  {alertas.principales.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <span>{a.producto.nombre}</span>
                      <span className={`badge ${tipoAlerta(a.tipo)?.clase}`}>{tipoAlerta(a.tipo)?.texto}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button className="seccion__link situacion__enlace" onClick={() => navegar('/alertas')}>
            Ver alertas
          </button>
        </section>

        <section className="card situacion__tarjeta" aria-labelledby="tit-comprobantes">
          <header className="situacion__cabecera">
            <h3 id="tit-comprobantes">Comprobantes pendientes</h3>
            <strong className="situacion__total">{comprobantes ? comprobantes.total : '—'}</strong>
          </header>
          {comprobantes && (
            <>
              <div className="situacion__chips">
                {ESTADOS_PENDIENTES.map((e) => (
                  <button
                    key={e}
                    className={`badge ${comprobantes.porEstado[e] ? ESTADO_COMPROBANTE[e].clase : 'badge--inactivo'}`}
                    onClick={() => navegar(`/comprobantes?estado=${FILTRO_COMPROBANTES[e]}`)}
                  >
                    {ESTADO_COMPROBANTE[e].texto} · {comprobantes.porEstado[e]}
                  </button>
                ))}
              </div>
              {comprobantes.enRevision.length === 0 ? (
                <p className="situacion__vacio">No hay remitos esperando revisión.</p>
              ) : (
                <div className="situacion__revisar">
                  {comprobantes.enRevision.map((c) => (
                    <button key={c.id} className="reponer__item reponer__item--boton" onClick={() => navegar(rutaComprobante(c))}>
                      <div className="reponer__datos">
                        <strong>{c.proveedor.razonSocial}</strong>
                        <span>
                          {tituloComprobante(c)} · {fechaHora(c.cargadoEn)}
                        </span>
                      </div>
                      <span className="reponer__ratio">Revisar</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button className="seccion__link situacion__enlace" onClick={() => navegar('/comprobantes')}>
            Ver comprobantes
          </button>
        </section>

        {esPropietario && (
          <section className="card situacion__tarjeta" aria-labelledby="tit-valor">
            <header className="situacion__cabecera">
              <h3 id="tit-valor">Valor del stock</h3>
            </header>
            <strong className="situacion__monto">{valor ? pesos(valor.total) : '—'}</strong>
            {valor && (
              <p className="situacion__detalle">
                {valor.productosValorizados} {valor.productosValorizados === 1 ? 'producto' : 'productos'} a último precio de
                compra · al {fechaHora(datos.generadoEn)}
                {valor.productosSinPrecio > 0 && ` · ${valor.productosSinPrecio} sin precio`}
                {valor.productosStockNegativo > 0 && ` · ${valor.productosStockNegativo} con stock negativo`}
              </p>
            )}
            <button className="seccion__link situacion__enlace" onClick={() => navegar('/precios')}>
              Ver valorización
            </button>
          </section>
        )}
      </div>

      {/* Para reponer */}
      <div className="seccion__titulo">
        <h3>Para reponer</h3>
        {/* HU27: el propietario ve cuánto pedir a cada proveedor. */}
        <button
          className="seccion__link"
          onClick={() => navegar(esPropietario ? '/precios?vista=reposicion' : '/productos?estado=STOCK_BAJO')}
        >
          {esPropietario ? 'Ver sugerencia' : 'Ver todo'}
        </button>
      </div>

      <div className="card reponer">
        {datos && reponer.length === 0 && <p className="reponer__vacio">No hay productos para reponer.</p>}
        {reponer.map((p) => (
          <div key={p.id} className="reponer__item">
            <span className="reponer__icono" aria-hidden />
            <div className="reponer__datos">
              <strong>{p.nombre}</strong>
              <span>{p.categoria?.nombre ?? 'Sin categoría'}</span>
            </div>
            {p.estadoStock === 'SIN_STOCK' ? (
              <EstadoBadge estado="SIN_STOCK" />
            ) : (
              <span className="reponer__ratio">
                {p.stockActual} de {p.stockMinimo}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
