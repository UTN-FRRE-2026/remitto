# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (13/11/2026)

- `origin/main` en `80008a9` (merge del PR #11, HU4 y HU6). Todas las ramas remotas anteriores están integradas.
- **Commit local, sin publicar ni PR:** HU5 (pantalla de categorías y filtro por categoría en Productos) en la rama `feature/HU5-categorias`, creada desde `80008a9`.
- **Trabajo en pausa, sin commit:** HU21 (claves de integración) quedó guardada solo en la copia local de Maxi: un stash de Git sobre la rama `feature/HU21-claves-integracion` y un patch equivalente en `retomar/HU21-en-progreso.patch`, fuera del repositorio, con las instrucciones para recuperarla. Tiene el backend con sus pruebas y la pantalla sin terminar. No está en `origin`.
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
| HU14 ajuste por recuento | [PR #9](https://github.com/UTN-FRRE-2026/remitto/pull/9) |
| HU15 asociación automática al catálogo | [PR #10](https://github.com/UTN-FRRE-2026/remitto/pull/10) |
| HU4 productos y HU6 proveedores (pantallas) | [PR #11](https://github.com/UTN-FRRE-2026/remitto/pull/11) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 inicio de sesión, HU2 roles (rutas protegidas y menú según rol; faltan pruebas de permisos), HU4, HU6, HU8 a HU15 |
| Implementada en rama local | HU5 categorías (alta, renombrado, eliminación y filtro en Productos) |
| En pausa (stash) | HU21 claves de integración |
| Base existente | HU7 PWA (`vite-plugin-pwa`); instalación en Android no comprobada |
| Solo backend | HU3 usuarios (la pantalla es `EnConstruccion`) |
| Sin implementar | HU16 a HU20 y HU22 a HU31. `/comprobantes`, `/asistente`, `/precios` e `/integraciones` son `EnConstruccion`; `simulador/` solo tiene un README |

## Validación de HU5 (13/11/2026, trabajo local)

- `npm test` en `backend/`: 130 pruebas correctas. `npm run build` correcto.
- Contra una base descartable (eliminada al terminar): 23 controles de API y de pantalla correctos (nombre repetido sin distinguir mayúsculas, permisos, renombrar, eliminar con productos que quedan sin categoría, filtro en Productos, redirección del empleado, sin desborde a 360 px).
- La unicidad sin distinguir mayúsculas se controla en el servicio, sin índice en la base: dos altas simultáneas como «Bebidas» y «bebidas» podrían pasar. No se agregó migración por ser un caso improbable.

## Validación de HU4 y HU6 (13/11/2026, integrada en el PR #11)

- `npm test` en `backend/`: 128 pruebas correctas (9 nuevas en `test/catalogo.test.js`). `npm run build` correcto.
- Punta a punta contra una base descartable (contenedor PostgreSQL temporal con migraciones y seed, eliminado al terminar): 25 controles correctos de API (altas, duplicados de código y CUIT, campos vacíos como null, categoría inexistente, permisos 401/403, edición sin tocar el stock, cambio de unidad bloqueado con movimientos, desactivación, búsquedas y reactivación).
- Recorrido en navegador sin interfaz (Chromium headless) con propietario en celular (360 px) y escritorio, y con empleado: alta, error de número y de código repetido, edición, desactivación y filtro, alta de proveedor con CUIT inválido y válido, accesos desde Cuenta y menú lateral, y redirección del empleado. Sin desplazamiento horizontal.
- **Pendiente:** probarlo en un celular real.

## Revisión de HU14 y HU15 (13/11/2026, sobre `main`)

Sin hallazgos graves en HU14. En HU15 la asociación propone como confiables (≥ 0,8) variantes de otro producto («sin palo» → «con palo», «light» → común, descripciones de una palabra) y no reconoce números sin unidad ni conversiones ml/l y g/kg; conviene ajustarla antes de probar con remitos reales. En ambas, las pruebas cubren solo funciones puras.

## Validación de HU15 (13/11/2026, integrada en el PR #10)

- `npm test` en `backend/`: 119 pruebas correctas (11 nuevas en `test/asociacion.test.js`). `npm run build` del frontend correcto.
- **Empate entre candidatos** (señalado en la revisión): con dos productos activos igual de compatibles y sin código de barras que los distinga, la primera versión dejaba la confianza en 0,8, que se mostraba como alta. Se corrigió: un empate queda limitado a 0,79 y siempre se destaca. Hay una prueba unitaria del caso. Los controles de punta a punta y el recorrido de pantalla se hicieron antes de este ajuste, que solo cambia el valor de confianza en los empates.
- Punta a punta contra una base descartable (`remitto_hu15`, creada con migraciones y seed, y eliminada al terminar), con la IA simulada: 19 controles correctos. Cubren coincidencia clara, dudosa por un producto casi duplicado, sin coincidencia por un producto desactivado, avisos y problemas de validación, cambios del empleado, alta y asociación, conservación de las correcciones, ausencia de relectura en revisión, stock sin cambios antes de confirmar y entradas con los productos elegidos.
- Recorrido de la revisión en el navegador, en escritorio (propietario) y tamaño móvil (empleado): propuesta confiable, línea dudosa destacada, sin coincidencia con el alta abierta, «Es correcto», cambio de producto, alta, persistencia al recargar y aviso al validar.
- **Pendiente:** probarlo con remitos reales leídos por Gemini y con un catálogo grande, para calibrar los umbrales; y en un celular real.

## Validación de HU14 (resultado histórico, integrada en el PR #9)

108 pruebas del backend, build, 33 controles de punta a punta y el caso ABA (reenvío después de que el stock cambió y volvió al mismo valor) comprobado desde la pantalla. **Pendiente:** probar el recuento en un celular real y en producción.

## Calendario y prioridades

El plan preveía Sprint 1 del 29/09 al 16/10, Sprint 2 del 19/10 al 03/11, defensa el 11/11 y recuperatorios el 16/11 y el 30/11. La prioridad y el calendario efectivo los decide el equipo; el orden de trabajo no depende del reparto por integrante del plan.

## Resultados históricos e informados

- El README registra verificaciones de octubre de 2026 para HU9 (pruebas unitarias, simulación de punta a punta, dos lecturas reales con Gemini y Docker).
- El equipo informó para la entrega de HU11: 87 pruebas unitarias, 21 controles de punta a punta y build correctos. No se volvieron a ejecutar.
- El README indica que producción corre en Coolify desde `main`; el despliegue no se verificó.

## Riesgos y correcciones

- **Deadlock descartado.** Una versión anterior de esta nota advertía un posible deadlock entre la confirmación de comprobantes y las salidas. Era un error de lectura: `lineasAIngresar` ya ordena las líneas por producto, así que la confirmación (HU11), las salidas (HU13) y el recuento (HU14) bloquean los productos en orden de id y no se traban entre sí.

## Mantenimiento

Actualizar al cerrar una tarea que cambie la continuidad: fecha, commit observado, alcance de la revisión y pruebas efectivamente ejecutadas. Distinguir trabajo local, publicado e integrado. Mantener la nota breve; Git y los PR conservan el detalle.
