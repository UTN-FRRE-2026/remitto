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
| Implementadas | 18 (HU1 a HU15, HU17, HU18 y HU28) | 59 de 100 obligatorios |
| Parciales | 1 (HU26) | 3 |
| Pendientes obligatorias | 10 (HU16, HU19 a HU25, HU27 y HU29) | 38 |
| Deseables pendientes | 2 (HU30, HU31) | 5 (fuera de los 100) |

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
| RF3.5 | Reconocer equivalencias por proveedor | HU16 | Pendiente | La tabla `codigos_proveedor` existe pero no se usa |
| RF3.6 | Exigir revisión completa en comprobantes dudosos | HU17 | Implementado | Aviso de revisión obligatoria y «Marcar como revisada» por línea; no se confirma hasta revisarlas todas |
| RF3.7 | Consultar los comprobantes archivados | HU18 | Implementado | Pantalla Comprobantes, con filtros y acceso desde la ficha del proveedor · `GET /api/comprobantes` |
| RF3.8 | Medir la precisión de la extracción | HU19 | Pendiente | Lo leído y lo confirmado ya se guardan por separado |

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
| RF5.1 | Administrar claves de integración | HU21 | Pendiente | Avance fuera del repositorio (copia local de Stabile). La tabla `claves_integracion` existe |
| RF5.2 | Recibir salidas por el endpoint, sin duplicados y con contrato OpenAPI | HU22 | Pendiente | El servicio de salidas y la base ya contemplan la referencia externa |
| RF5.3 | Validar la integración con un simulador de ventas | HU23 | Pendiente | `simulador/` solo tiene un README |

### RF6 Alertas y reposición · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF6.1 | Generar alertas de stock bajo, sin stock y negativo | HU24 | Pendiente | La tabla `alertas_stock` existe, con una sola alerta activa por producto y tipo |
| RF6.2 | Sugerir la reposición | HU27 | Pendiente | El stock deseado ya se carga en cada producto |

### RF7 Agente de consultas · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF7.1 | Responder preguntas en lenguaje natural y registrar cada consulta | HU25 | Pendiente | `/asistente` está «En construcción». La tabla `consultas_agente` existe |

### RF8 Reportes · Mandatoria

| Sub. | Descripción | HU | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| RF8.1 | Valorización de existencias | HU28 | Implementado | Pantalla Precios y reportes: valor por categoría a último precio de compra y productos sin precio aparte · `GET /api/reportes/valorizacion` |
| RF8.2 | Productos sin movimiento | HU29 | Pendiente | — |
| RF8.3 | Evolución de precios de compra | HU20 | Pendiente | Los datos se registran en `precios_compra` |
| RF8.4 | Tablero de situación | HU26 | Parcial | El tablero muestra indicadores de stock, productos para reponer y remitos por revisar. Faltan las alertas activas y el valor del stock |

### RF9 Funcionalidades deseables · Deseable

| Sub. | Descripción | HU | Estado |
| --- | --- | --- | --- |
| RF9.1 | Lectura de códigos de barras con la cámara en el carrito | HU30 | Pendiente. El buscador acepta el código tipeado o el de un lector que actúe como teclado |
| RF9.2 | Exportar la sugerencia como orden de compra | HU31 | Pendiente |

## Requerimientos no funcionales

| ID | Tipo | Especificación | Estado |
| --- | --- | --- | --- |
| RNF1 | Seguridad | Sesión autenticada y HTTPS; contraseñas y claves como hash; credencial de IA solo en el servidor | **Cumplido en lo implementado.** Sesión con token y contraseñas con bcrypt. La clave de Gemini está solo en el backend. Las claves de integración dependen de HU21. HTTPS depende del despliegue en Coolify, no verificado en esta revisión |
| RNF2 | Rendimiento | Consultas en 3 s o menos; extracción de un comprobante en 30 s o menos | **Medición implementada:** cada lectura registra su duración y si cumple el objetivo. Falta medirlo con remitos reales en producción |
| RNF3 | Usabilidad | Comprobante de 20 líneas en menos de 3 minutos; baja confianza y errores indicados con claridad | **Parcial:** las líneas dudosas se destacan y la validación explica qué corregir. Falta cronometrar un comprobante real de 20 líneas |
| RNF4 | Compatibilidad | Instalable como PWA en Android y usable en escritorio | **Parcial:** PWA configurada. Las pantallas de catálogo y usuarios se probaron a 360 px y en escritorio con un navegador sin interfaz. Falta probar la instalación en un Android real |
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
| Documentación de la API | OpenAPI (Swagger) | Pendiente; corresponde a HU22 |
| Despliegue | Docker sobre VPS | Docker Compose en Coolify |
