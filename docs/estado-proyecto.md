# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (12/11/2026)

Revisión de la copia local con Git, sin ejecutar pruebas, build ni la aplicación.

- `main` local coincide con `origin/main` en [`3a2c7e3`](https://github.com/UTN-FRRE-2026/remitto/commit/3a2c7e3bb647718c7d07dc0d1aac0112a57f56a1) (merge del PR #7, 01/11/2026). Antes de incorporar esta documentación no había cambios locales.
- Todas las ramas remotas (`feature/HU8-HU9-ingesta`, `feature/HU11-entradas-stock`, `feature/HU12-movimientos`, `feature/HU13-salidas`, `feature/barra-movimientos`, `chore/despliegue-coolify`) están integradas en `main`.
- No se consultaron PR abiertos ni Issues: la CLI `gh` no estaba disponible. Un PR abierto desde un fork no aparecería en esta revisión.

## Integrado en `main`

| Entrega | Evidencia |
| --- | --- |
| HU8 carga de comprobantes | [PR #1](https://github.com/UTN-FRRE-2026/remitto/pull/1) |
| HU9 extracción con Gemini | [PR #2](https://github.com/UTN-FRRE-2026/remitto/pull/2) |
| HU10 revisión | [PR #3](https://github.com/UTN-FRRE-2026/remitto/pull/3) |
| Despliegue con Coolify, compresión de fotos, scripts de mantenimiento | Merge directo de `chore/despliegue-coolify` y commits en `main` (26/10) |
| HU11 entradas de stock | [PR #4](https://github.com/UTN-FRRE-2026/remitto/pull/4) |
| HU12 movimientos y existencias | [PR #5](https://github.com/UTN-FRRE-2026/remitto/pull/5) |
| HU13 salidas con carrito | [PR #6](https://github.com/UTN-FRRE-2026/remitto/pull/6) |
| Movimientos en la barra inferior móvil | [PR #7](https://github.com/UTN-FRRE-2026/remitto/pull/7) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 inicio de sesión, HU2 roles (rutas protegidas y menú según rol), HU8 a HU13 |
| Base existente | HU7 PWA (`vite-plugin-pwa`); instalación en Android no comprobada aquí |
| Solo backend | HU3 usuarios (la pantalla es `EnConstruccion`); HU4 a HU6 catálogo: hay listado de productos y alta rápida desde la revisión, pero no pantallas para administrar productos, categorías ni proveedores |
| Sin implementar | HU14 a HU31. `/comprobantes`, `/asistente`, `/precios` e `/integraciones` son `EnConstruccion`; `simulador/` solo tiene un README |

## Calendario y prioridades

El plan preveía Sprint 1 del 29/09 al 16/10, Sprint 2 del 19/10 al 03/11, defensa el 11/11 y recuperatorios el 16/11 y el 30/11. El README todavía dice «Sprint 1 en curso» y propone HU14 como próxima historia; quedan 15 historias obligatorias del Sprint 2 sin empezar. La prioridad y el calendario efectivo los decide el equipo.

## Resultados históricos e informados

- El README registra verificaciones de octubre de 2026 para HU9 (pruebas unitarias, simulación de punta a punta, dos lecturas reales con Gemini y Docker).
- El equipo informó para la entrega de HU11: 87 pruebas unitarias, 21 controles de punta a punta y build correctos. No se volvieron a ejecutar.
- El README indica que producción corre en Coolify desde `main`; el despliegue no se verificó.

## Riesgos pendientes

- **Posible deadlock entre confirmación y salidas.** La confirmación de un comprobante (`comprobantes.revision.js`) bloquea los productos en el orden de las líneas; las salidas (`salidas.service.js`) los bloquean por id. Una confirmación y una salida simultáneas sobre los mismos productos podrían quedar en deadlock: PostgreSQL abortaría una con error, sin inconsistencia de stock. Detectado por lectura del código, no reproducido ni corregido; queda para una tarea propia.

## Mantenimiento

Actualizar al cerrar una tarea que cambie la continuidad: fecha, commit observado, alcance de la revisión y pruebas efectivamente ejecutadas. Distinguir trabajo local, publicado e integrado. Mantener la nota breve; Git y los PR conservan el detalle.
