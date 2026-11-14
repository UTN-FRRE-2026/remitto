# Remitto

TFI de UTN FRRe (Tecnicatura Universitaria en Programación): PWA de gestión de stock para un comercio minorista, con comprobantes de compra leídos por IA y revisión humana. Equipo: Agostina Jara, Ivan Sanchez y Maximiliano Stabile. Varios integrantes usan Claude Code con este archivo.

## Forma de trabajo

- Respondé en español argentino, con explicaciones claras y breves. Buscamos soluciones simples, entendibles y suficientes para un TFI.
- Revisá el código pertinente y avanzá con la tarea autorizada sin pedir aprobación por cada decisión técnica habitual. Consultá ante una ambigüedad importante de alcance, una decisión de producto o una acción destructiva. No amplíes el alcance ni agregues refactors o dependencias sin una necesidad concreta.
- Diferenciá lo verificado en la sesión de lo informado por el equipo, de la documentación y de resultados históricos. Indicá lo que no pudiste probar.
- Al retomar, comprobá rama, cambios locales y diferencia con `origin`. Un resumen anterior no reemplaza esa comprobación. Conservá los cambios locales ajenos a la tarea.

## Git

- No hagas commits, push, PR ni merge sin autorización explícita para ese paso.
- Usá la identidad Git configurada por quien esté trabajando; no fijes un autor ni cambies la configuración de Git.
- Convención observada: rama `feature/HUxx-descripcion` desde `main`, commits convencionales en español con la HU (`feat(stock): implementar salidas con carrito (HU13)`) y PR a `main`. No existe rama `develop`.
- Sin autorización: nada de `reset --hard`, `clean`, borrado de volúmenes ni reseteo de la base.

## Documentación

- [docs/entrega-tpi.md](docs/entrega-tpi.md): consigna de la primera entrega (16/11/2026), puntaje y entregables. Tenela en cuenta al priorizar.
- [docs/estado-proyecto.md](docs/estado-proyecto.md): última fotografía verificada y pendientes. Contrastala con Git y el código.
- [docs/plan-de-trabajo.md](docs/plan-de-trabajo.md): alcance, RF/RNF y tareas y criterios de cada HU. Leé solo las secciones de la tarea.
- [docs/maquetacion.md](docs/maquetacion.md): guía visual y mapa de pantallas. El HTML de `docs/referencias/` tiene fuentes e imágenes embebidas: abrilo o buscá en él solo cuando la tarea lo requiera, sin leerlo entero.
- [README.md](README.md): arranque, detalle de cada HU implementada y API.
- `RETOMAR.md` y `plan-HU8-HU11.md`, si aparecen en una copia local, son de una etapa cerrada: no son el plan ni el estado actual.

## Estructura y comandos

- Backend (`backend/`): JavaScript ESM, Express, Prisma y PostgreSQL. Módulos en `src/modules/<módulo>/` (rutas, esquemas Zod, servicios), IA en `src/ia/`, migraciones en `prisma/migrations/`, pruebas en `test/` con `node --test`.
- Frontend (`frontend/`): React + Vite + `vite-plugin-pwa`. Páginas en `src/pages/`, componentes en `src/components/`, tokens visuales en `src/styles/tokens.css`. Las vistas pendientes usan `EnConstruccion` en `src/App.jsx`.
- npm con un `package.json` y lockfile por aplicación; no hay uno en la raíz. `simulador/` todavía solo tiene un README (HU23).
- `backend/`: `npm run dev`, `npm test`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run seed`, `npm run conciliar-stock`, `npm run doc-bd` (regenera `docs/base-de-datos.md` desde Prisma).
- `frontend/`: `npm run dev`, `npm run build`, `npm run preview`. No hay lint ni pruebas de frontend.
- Desarrollo: PostgreSQL de Docker en `localhost:5433` (`docker compose up -d db`), API en `4000`, Vite en `5173` con proxy `/api`. Confirmá puertos y procesos antes de arrancar o detener servicios.
- `npm run db:reset` ejecuta `prisma migrate reset --force` y borra la base local; `reset-intentos` modifica comprobantes. No los ejecutes sin autorización. Si `prisma migrate dev` propone resetear, detenete y consultá.

## Reglas del producto y de los datos

- Un solo comercio con roles propietario y empleado. No es un punto de venta: las salidas son en unidades, sin precios de venta, cobros ni facturación.
- La lectura de IA es una propuesta: se conservan lo leído (`*Extraido`, `respuesta_ia`) y lo corregido por separado, y el stock solo entra con confirmación humana. Un comprobante confirmado no se vuelve a ingresar ni se resetea.
- Todo cambio de stock pasa por `registrarMovimiento` de `backend/src/modules/stock/stock.service.js`, en la misma transacción que su movimiento, con stock anterior y bloqueo de la fila del producto. Las operaciones con varios productos (ingresos, salidas, recuentos) los bloquean en orden de id para no trabarse entre sí; mantené ese orden. `stock_actual` debe coincidir con la suma de movimientos.
- Reutilizá los servicios existentes para nuevas entradas, salidas y ajustes, conservando las garantías de reenvío (idempotencia) y concurrencia.
- Usá `Prisma.Decimal` para cantidades y precios. Respetá las restricciones `CHECK` y las validaciones existentes.
- Los permisos se controlan en el backend; ocultar un botón no alcanza.
- Reutilizá los componentes y tokens existentes. Los datos y botones ilustrativos de la maqueta no crean requisitos.

## IA, secretos y entornos

- No hagas llamadas reales a Gemini sin autorización explícita. `backend/.env` puede tener una clave: no la muestres ni asumas que falta.
- Para probar sin red, arrancá el backend con `IA_SIMULACION=ok` y `IA_API_KEY` con un espacio (en PowerShell: `$env:IA_SIMULACION='ok'; $env:IA_API_KEY=' '; npm run dev`), sin tocar `.env`. La simulación se ignora con `NODE_ENV=production`; una lectura simulada registra `modeloIa` como `simulado:<modelo>`.
- No imprimas secretos ni subas `.env`, comprobantes o temporales. Revisá solo las variables necesarias.
- No modifiques Coolify, producción ni su configuración sin pedido explícito. No asumas que el despliegue coincide con el repo.

## Validación y cierre

- Ejecutá las pruebas pertinentes (`npm test` en `backend/`) y `npm run build` si cambia el frontend; agregá pruebas de comportamiento cuando corresponda. Para cambios solo de documentación, verificá enlaces, rutas y coherencia.
- Los datos del seed son ficticios. Evitá seeds, conciliaciones o reseteos innecesarios sobre una base con datos útiles.
- Al cerrar, informá cambios, validación ejecutada y limitaciones. Si cambió la continuidad, actualizá brevemente `docs/estado-proyecto.md` (fecha, commit, qué se verificó); no marques trabajo local como integrado.
