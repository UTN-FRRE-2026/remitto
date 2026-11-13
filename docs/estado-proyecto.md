# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (13/11/2026)

- `origin/main` en `1da8c36` (merge del PR #8, documentación compartida). Todas las ramas remotas anteriores están integradas.
- **Trabajo local, sin commit ni PR:** HU14 en la rama `feature/HU14-recuento-stock`, creada desde `1da8c36`.
- No se consultaron PR abiertos ni Issues: la CLI `gh` no estaba disponible.

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
| Documentación compartida (`CLAUDE.md`, plan, maqueta, esta nota) | [PR #8](https://github.com/UTN-FRRE-2026/remitto/pull/8) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 inicio de sesión, HU2 roles (rutas protegidas y menú según rol), HU8 a HU13 |
| Implementada en rama local | HU14 recuento (`GET /api/recuentos/producto/:id`, `POST /api/recuentos`, pantalla `/recuento`) |
| Base existente | HU7 PWA (`vite-plugin-pwa`); instalación en Android no comprobada |
| Solo backend | HU3 usuarios (la pantalla es `EnConstruccion`); HU4 a HU6 catálogo: hay listado de productos y alta rápida desde la revisión, pero no pantallas para administrar productos, categorías ni proveedores |
| Sin implementar | HU15 a HU31. `/comprobantes`, `/asistente`, `/precios` e `/integraciones` son `EnConstruccion`; `simulador/` solo tiene un README |

## Validación de HU14 (13/11/2026, trabajo local)

- `npm test` en `backend/`: 108 pruebas correctas (9 nuevas en `test/recuentos.test.js`). `npm run build` del frontend correcto.
- Punta a punta contra una base descartable (`remitto_hu14`, creada con migraciones y seed, y eliminada al terminar), con la IA deshabilitada: 33 controles correctos. Incluyen ajustes y sin diferencia, decimales, reenvío, todo o nada, permisos, recuentos simultáneos, recuentos cruzados con salidas sin errores y conciliación sin descuadres.
- **Reenvío tras ABA** (señalado en la revisión): stock 10, recuento a 12 aplicado con la respuesta perdida, venta de 2 (vuelve a 10) y reenvío exacto. La primera versión, que solo comparaba el stock, lo aceptó y dejó 12 (deshizo la venta). Se corrigió comparando además la versión del producto (id de su último movimiento); con el arreglo responde 409 y el stock queda en 10. Hay una prueba unitaria del caso y se repitió de punta a punta y desde la pantalla.
- Recorrido en el navegador (móvil y escritorio): carga, diferencia en vivo, conflictos por movimientos mientras se contaba (incluido el ABA), resultado y ajustes en Movimientos. Nueva salida sigue funcionando con el buscador compartido.
- **Pendiente:** probar el recuento en un celular real (teclado numérico, foco al agregar un producto, uso con lector de códigos y lectura de los avisos) y después en producción. Solo se probó en el navegador del escritorio con viewport móvil.

## Calendario y prioridades

El plan preveía Sprint 1 del 29/09 al 16/10, Sprint 2 del 19/10 al 03/11, defensa el 11/11 y recuperatorios el 16/11 y el 30/11. Quedan 15 historias obligatorias del Sprint 2 sin empezar. La prioridad y el calendario efectivo los decide el equipo.

## Resultados históricos e informados

- El README registra verificaciones de octubre de 2026 para HU9 (pruebas unitarias, simulación de punta a punta, dos lecturas reales con Gemini y Docker).
- El equipo informó para la entrega de HU11: 87 pruebas unitarias, 21 controles de punta a punta y build correctos. No se volvieron a ejecutar.
- El README indica que producción corre en Coolify desde `main`; el despliegue no se verificó.

## Riesgos y correcciones

- **Deadlock descartado.** La versión anterior de esta nota advertía un posible deadlock entre la confirmación de comprobantes y las salidas. Era un error de lectura: `lineasAIngresar` ya ordena las líneas por producto, así que la confirmación (HU11), las salidas (HU13) y el recuento (HU14) bloquean los productos en orden de id y no se traban entre sí. Hay una prueba unitaria existente de ese orden; además, 15 rondas de recuentos y salidas cruzados sobre los mismos productos terminaron sin errores.

## Mantenimiento

Actualizar al cerrar una tarea que cambie la continuidad: fecha, commit observado, alcance de la revisión y pruebas efectivamente ejecutadas. Distinguir trabajo local, publicado e integrado. Mantener la nota breve; Git y los PR conservan el detalle.
