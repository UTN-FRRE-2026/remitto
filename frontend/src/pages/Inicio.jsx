import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoRemitto, IconoCampana, IconoCamara, IconoProductos } from '../components/iconos.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { rutaComprobante, tituloComprobante, fechaHora } from '../lib/comprobantes.js';
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

export default function Inicio() {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [reponer, setReponer] = useState([]);
  // HU18: remitos leídos que esperan revisión (se retoman desde acá).
  const [porRevisar, setPorRevisar] = useState(null);

  useEffect(() => {
    api.get('/productos/resumen').then(setResumen).catch(() => {});
    // "Para reponer": productos sin stock o por debajo del mínimo.
    Promise.all([
      api.get('/productos?estado=SIN_STOCK'),
      api.get('/productos?estado=STOCK_BAJO'),
    ])
      .then(([sin, bajo]) => setReponer([...sin, ...bajo].slice(0, 4)))
      .catch(() => {});
    api
      .get('/comprobantes?estado=EN_REVISION&limite=3')
      .then(setPorRevisar)
      .catch(() => {});
  }, []);

  const nombreCorto = usuario?.nombre?.split(' ')[0] ?? '';

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
          <button className="topbar__accion" aria-label="Notificaciones">
            <IconoCampana size={20} />
            <span className="topbar__punto" />
          </button>
          <button
            className="topbar__avatar"
            onClick={() => navegar('/cuenta')}
            aria-label="Mi cuenta"
          >
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

      {/* Para reponer */}
      <div className="seccion__titulo">
        <h3>Para reponer</h3>
        <button className="seccion__link" onClick={() => navegar('/productos?estado=STOCK_BAJO')}>
          Ver todo
        </button>
      </div>

      <div className="card reponer">
        {reponer.length === 0 && <p className="reponer__vacio">No hay productos para reponer.</p>}
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

      {/* HU18: comprobantes en revisión */}
      <div className="seccion__titulo">
        <h3>
          Remitos por revisar{porRevisar?.total ? ` · ${porRevisar.total}` : ''}
        </h3>
        <button className="seccion__link" onClick={() => navegar('/comprobantes')}>
          Ver comprobantes
        </button>
      </div>

      <div className="card reponer">
        {porRevisar?.comprobantes.length === 0 && <p className="reponer__vacio">No hay remitos esperando revisión.</p>}
        {porRevisar?.comprobantes.map((c) => (
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
    </div>
  );
}
