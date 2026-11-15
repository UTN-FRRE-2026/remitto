# Lista de requerimientos de Remitto

Requerimientos funcionales, no funcionales y técnicos del [plan de trabajo](plan-de-trabajo.md#enunciado-de-los-requerimientos), con la historia de usuario que los implementa y su estado en `main` al 14/11/2026.

**Estados**

- **Implementado:** backend y pantalla en `main`.
- **Parcial:** existe una parte; se indica qué falta.
- **Pendiente:** sin implementar. Puede existir la tabla en la base, prevista desde el diseño inicial.

Para el detalle de lo verificado en cada entrega, ver [estado-proyecto.md](estado-proyecto.md). Para el funcionamiento y la API, ver el [README](../README.md).

## Resumen

| | Historias | Puntos del plan |
| --- | --- | --- |
| Implementadas | 29 (HU1 a HU29) | 100 de 100 obligatorios |
| Parciales | 0 | 0 |
| Pendientes obligatorias | 0 | 0 |
| Deseables implementadas | 2 (HU30 y HU31) | 5 (fuera de los 100) |
| Deseables pendientes | 0 | 0 |

## Requerimientos funcionales

### RF1 Usuarios y acceso · Mandatoria

| Sub. | Descripción | HU | Estado | Dónde |
| --- | --- | --- | --- | --- |
| RF1.1 | Iniciar sesión con correo y contraseña | HU1 | Implementado | Pantalla de inicio de sesión · `POST /api/auth/login` |
| RF1.2 | Acceder solo a las funciones del rol | HU2 | Implementado | Permisos en el backend (`exigirRol`) y menú según el rol. Verificado de punta a punta el 13/11 |
| RF1.3 | Administrar usuarios | HU3 | Implementado | Pantalla Usuarios · `/api/usuarios` |

### RF2 Catálogo · Mandatoria

| Sub. | Descripción | HU | Estado | Dónde |
| --- | --- | --- | --- | --- |
| RF2.1 | Administrar productos con stock mínimo y deseado | HU4 | Implementado | Pantalla Productos, con alta, edición y desactivación · `/api/productos` |
| RF2.2 | Administrar categorías | HU5 | Implementado | Pantalla Categorías y filtro en Productos · `/api/categorias` |
| RF2.3 | Administrar proveedores | HU6 | Implementado | Pantalla Proveedores · `/api/proveedores` |

### RF3 Ingesta de comprobantes · Mandatoria

| Sub. | Descripción | HU | Estado | Dónde / qué falta |
| --- | --- | --- | --- | --- |
| RF3.1 | Cargar un comprobante por foto o PDF | HU8 | Implementado | Pantalla Cargar remito · `POST /api/comprobantes` |
| RF3.2 | Extraer los ítems con IA | HU9 | Implementado | Pantalla Leyendo con IA · Gemini mediante un adaptador |
| RF3.3 | Asociar los ítems al catálogo con nivel de confianza | HU15 | Implementado | Propuesta y confianza en la revisión. Falta calibrarla con remitos reales |
| RF3.4 | Revisar y confirmar, con alta de productos nuevos | HU10 | Implementado | Pantalla Revisar remito |
| RF3.5 | Reconocer equivalencias por proveedor | HU16 | Implementado | Se aprenden al confirmar y se proponen en el siguiente comprobante del proveedor («Recordado») · tabla `codigos_proveedor` |
| RF3.6 | Exigir revisión completa en comprobantes dudosos | HU17 | Implementado | Aviso de revisión obligatoria y «Marcar como revisada» por línea; no se confirma hasta revisarlas todas |
| RF3.7 | Consultar los comprobantes archivados | HU18 | Implementado | Pantalla Comprobantes, con filtros y acceso desde la ficha del proveedor · `GET /api/comprobantes` |
| RF3.8 | Medir la precisión de la extracción | HU19 | Implementado | Comprobantes › Precisión de la lectura: porcentaje de líneas leídas correctamente, general y por comprobante, con la meta del 85 % sobre 20 comprobantes · `GET /api/comprobantes/precision`. Falta medirla con remitos reales |

### RF4 Gestión de stock · Mandatoria

| Sub. | Descripción | HU | Estado | Dónde |
| --- | --- | --- | --- | --- |
| RF4.1 | Registrar las entradas de un comprobante confirmado | HU11 | Implementado | «Confirmar ingreso» en la revisión |
| RF4.2 | Consultar existencias y movimientos | HU12 | Implementado | Pantallas Productos y Movimientos · `/api/movimientos` |
| RF4.3 | Registrar salidas con el carrito | HU13 | Implementado | Pantalla Nueva salida · `/api/salidas` |
| RF4.4 | Ajustar el stock por recuento | HU14 | Implementado | Pantalla Recuento · `/api/recuentos` |

### RF5 Integración con sistemas externos · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF5.1 | Administrar claves de integración | HU21 | Implementado | Pantalla Integraciones · `/api/claves-integracion`. La clave se muestra una vez; en la base quedan su prefijo y su hash SHA-256. Revocación y último uso. Verificado de punta a punta (`backend/e2e/hu21-claves.mjs`) |
| RF5.2 | Recibir salidas por el endpoint, sin duplicados y con contrato OpenAPI | HU22 | Implementado | `POST /api/v1/integracion/salidas` con la clave de HU21, el mismo servicio que el carrito, reenvíos sin duplicar (índice único por clave y referencia) y contrato en `GET /api/v1/integracion/openapi.json`. Verificado de punta a punta con concurrencia (`backend/e2e/hu22-salidas.mjs`) |
| RF5.3 | Validar la integración con un simulador de ventas | HU23 | Implementado | `simulador/simulador.mjs`, ejecutado con `npm run e2e -- hu23-simulador`: 120 ventas y 30 reenvíos (150 operaciones de salida) y 0 diferencias entre el stock esperado y el registrado, más un control negativo que detecta un doble descuento |

### RF6 Alertas y reposición · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF6.1 | Generar alertas de stock bajo, sin stock y negativo | HU24 | Implementado | Observador de movimientos: cada movimiento (comprobante, carrito, recuento y endpoint de integración) abre o resuelve la alerta del producto, con una sola activa por producto (`uq_alerta_activa`). Pantalla Alertas desde la campana del Inicio · `GET /api/alertas` |
| RF6.2 | Sugerir la reposición | HU27 | Implementado | Precios y reportes › Reposición: cantidad hasta el stock deseado, agrupada por último proveedor · `GET /api/reportes/reposicion` |

### RF7 Agente de consultas · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF7.1 | Responder preguntas en lenguaje natural y registrar cada consulta | HU25 | Implementado | Pantalla Asistente (solo el propietario) · `/api/asistente/consultas`. 8 tipos de preguntas con 8 herramientas de lectura habilitadas; el modelo solo elige la herramienta y el backend arma la respuesta con datos reales; cada consulta queda en `consultas_agente`. Verificado con la IA simulada contra PostgreSQL (`backend/e2e/hu25-asistente.mjs`); falta probarlo con Gemini real |

### RF8 Reportes · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF8.1 | Valorización de existencias | HU28 | Implementado | Pantalla Precios y reportes: valor por categoría a último precio de compra y productos sin precio aparte · `GET /api/reportes/valorizacion` |
| RF8.2 | Productos sin movimiento | HU29 | Implementado | Precios y reportes › Sin movimiento: período elegible, stock, valor y última salida · `GET /api/reportes/sin-movimiento` |
| RF8.3 | Evolución de precios de compra | HU20 | Implementado | Precios y reportes › Evolución de precios: productos que más aumentaron, gráfico por proveedor ordenado por fecha y comparación del último precio · `GET /api/reportes/precios` |
| RF8.4 | Tablero de situación | HU26 | Implementado | Inicio · `GET /api/tablero`: alertas activas por tipo, comprobantes pendientes por estado, valor del stock (solo el propietario, igual a HU28), resumen de stock y para reponer, leídos en una sola foto de la base (transacción REPEATABLE READ). Verificado contra PostgreSQL (`backend/e2e/hu26-tablero.mjs`) |

### RF9 Funcionalidades deseables · Deseable

| Sub. | Descripción | HU | Estado |
| --- | --- | --- | --- |
| RF9.1 | Lectura de códigos de barras con la cámara en el carrito | HU30 | Implementado. Nueva salida: botón de escaneo en el buscador (ZXing); el código leído agrega el producto y uno desconocido muestra un aviso · `GET /api/productos?codigo=` (coincidencia exacta). La búsqueda por nombre y el lector tipo teclado siguen disponibles |
| RF9.2 | Exportar la sugerencia como orden de compra | HU31 | Implementado. Precios y reportes › Reposición: un PDF por proveedor con producto, cantidad y unidad, más el proveedor · `GET /api/reportes/reposicion/orden` (solo el propietario) |

## Requerimientos no funcionales

| ID | Tipo | Especificación | Estado |
| --- | --- | --- | --- |
| RNF1 | Seguridad | Sesión autenticada y HTTPS; contraseñas y claves como hash; credencial de IA solo en el servidor | **Cumplido en lo implementado.** Sesión con token y contraseñas con bcrypt. La clave de Gemini está solo en el backend. Las claves de integración se guardan como hash SHA-256 (HU21). HTTPS depende del despliegue en Coolify, no verificado en esta revisión |
| RNF2 | Rendimiento | Consultas en 3 s o menos; extracción de un comprobante en 30 s o menos | **Medición implementada:** cada lectura registra su duración y si cumple el objetivo. Falta medirlo con remitos reales en producción. El asistente (HU25) registra la duración de cada consulta; con Gemini real todavía no se midió |
| RNF3 | Usabilidad | Comprobante de 20 líneas en menos de 3 minutos; baja confianza y errores indicados con claridad | **Parcial:** las líneas dudosas se destacan y la validación explica qué corregir. Falta cronometrar un comprobante real de 20 líneas |
| RNF4 | Compatibilidad | Instalable como PWA en Android y usable en escritorio | **Cumplido:** PWA configurada e instalada por el equipo en un Android real, donde funciona (14/11/2026). Las pantallas también se probaron a 360-390 px y en escritorio con un navegador sin interfaz |
| RNF5 | Integridad | Reglas principales en la base; stock en la misma transacción que su movimiento | **Cumplido:** claves únicas, `CHECK` e índices parciales (ver [base-de-datos.md](base-de-datos.md)), y todo cambio de stock pasa por `registrarMovimiento` dentro de una transacción |
| RNF6 | Mantenibilidad | Proveedor de IA reemplazable por su adaptador; despliegue con Docker | **Cumplido:** adaptadores en `backend/src/ia/adaptadores/` (Gemini y simulado) y despliegue con Docker Compose en Coolify |

## Requerimientos técnicos

| Tecnología | Previsto en el plan | Estado |
| --- | --- | --- |
| Backend | Node.js + Express | En uso |
| Frontend | React (PWA) | En uso, con Vite y `vite-plugin-pwa` |
| Base de datos | PostgreSQL | En uso (PostgreSQL 16) |
| ORM | Prisma | En uso |
| Maquetación | Figma | Maqueta en [referencias/maquetacion.html](referencias/maquetacion.html) |
| Gestión | GitHub y Trello | Repositorio con PR por historia en GitHub |
| Inteligencia Artificial | API de modelo multimodal con capa gratuita | Gemini, mediante el adaptador de `backend/src/ia/` |
| Documentación de la API | OpenAPI (Swagger) | Contrato OpenAPI 3.0 de la integración (HU22), publicado en `/api/v1/integracion/openapi.json`. La API interna se documenta en el README |
| Despliegue | Docker sobre VPS | Docker Compose en Coolify |
