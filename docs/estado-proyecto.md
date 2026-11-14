# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (14/11/2026)

- `origin/main` en `c203c4e` (merge del PR #19, HU17). Todas las ramas remotas están integradas.
- **Primera entrega del TPI: lunes 16/11/2026.** Consigna y entregables en [entrega-tpi.md](entrega-tpi.md).
- **Trabajo local, con commit y sin publicar:** HU16 (equivalencias por proveedor) en la rama `feature/HU16-equivalencias-proveedor`, a nombre de Agostina Jara. No se publicó porque en la máquina donde se hizo solo hay credenciales de GitHub de otro integrante.
- Los PDF de la documentación probatoria se generaron el 14/11 fuera del repositorio (`../remitto-entrega/`).
- **Trabajo en pausa, sin commit:** HU21 (claves de integración) quedó guardada solo en la copia local de Maxi: un stash de Git sobre la rama `feature/HU21-claves-integracion` y un patch equivalente en `retomar/HU21-en-progreso.patch`, fuera del repositorio, con las instrucciones para recuperarla. Tiene el backend con sus pruebas y la pantalla sin terminar. No está en `origin`.
- PR #1 a #19 integrados en `main`.

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
| HU5 categorías (pantalla y filtro en Productos) | [PR #12](https://github.com/UTN-FRRE-2026/remitto/pull/12) |
| HU3 usuarios (pantalla) y verificación de permisos de HU2 | [PR #13](https://github.com/UTN-FRRE-2026/remitto/pull/13) |
| Ajuste de la asociación de HU15 | [PR #14](https://github.com/UTN-FRRE-2026/remitto/pull/14) |
| Consigna de la primera entrega | [PR #15](https://github.com/UTN-FRRE-2026/remitto/pull/15) |
| Lista de requerimientos y diseño de la base de datos | [PR #16](https://github.com/UTN-FRRE-2026/remitto/pull/16) |
| Manual del usuario | [PR #17](https://github.com/UTN-FRRE-2026/remitto/pull/17) |
| HU18 comprobantes archivados | [PR #18](https://github.com/UTN-FRRE-2026/remitto/pull/18) |
| HU17 revisión obligatoria en comprobantes dudosos (con migración: columna `revisada`) | [PR #19](https://github.com/UTN-FRRE-2026/remitto/pull/19) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 a HU6, HU8 a HU15, HU17, HU18 |
| Implementada en rama local, sin publicar | HU16 equivalencias por proveedor |
| En pausa (stash) | HU21 claves de integración |
| Base existente | HU7 PWA (`vite-plugin-pwa`); instalación en Android no comprobada |
| Sin implementar | HU19, HU20 y HU22 a HU31 (HU26 parcial). `/asistente`, `/precios` e `/integraciones` son `EnConstruccion`; `simulador/` solo tiene un README |

## Validación de HU16 (14/11/2026, rama local `feature/HU16-equivalencias-proveedor`)

- `npm test`: 158 correctas (10 nuevas en `test/equivalencias.test.js`). `npm run build` correcto.
- Integración contra una base descartable (`remitto_hu16`, migraciones y seed, eliminada al terminar) con la IA simulada: 28 controles correctos. Cubren el registro al confirmar (una fila por línea, descripción normalizada y código), la corrección de la persona registrada, la asociación automática en el siguiente comprobante del mismo proveedor con confianza 1 (criterio 1), la separación entre proveedores, la marca «Recordado» al editar la cantidad y su desaparición al elegir otro producto, el contador de confirmaciones, el cambio de producto con una sola fila por descripción (criterio 2), las líneas descartadas, los productos desactivados, dos confirmaciones simultáneas del mismo proveedor sin filas duplicadas, el stock sin cambios antes de confirmar y la consistencia del stock con la suma de movimientos.
- Recorrido automatizado en el navegador de la app, en escritorio y a 375 px: «Recordado · N veces» con su explicación, editar la cantidad conserva la marca, cambiar el producto pasa a «Asociado», persistencia al recargar y sin desplazamiento horizontal.
- **Corrección por la revisión de los commits publicados** (mismo día): el primer diseño guardaba código y descripción en la misma fila y perdía aprendizaje. (1) `ABC01`/A y después `ABC01`/B → la descripción A dejaba de reconocerse. (2) `LE01`/«LECHE 1 L» → producto 10 y `LE02`/«LECHE 1 L» → producto 20 → `LE01` se perdía y se proponía el producto 20 con confianza 1. Ahora hay filas por código y filas por descripción (migración `hu16_equivalencias`: la descripción es única solo en las filas sin código, con un índice parcial), el código manda, y una descripción ambigua o un código nuevo con una descripción ya vista se proponen con 0,79 para revisar. Verificado: los dos casos reproducidos contra PostgreSQL antes y después del arreglo (4 fallas → 15/15 controles), la base rechaza una segunda fila por descripción, `prisma migrate diff` sin diferencias, `npm test` 160 correctas (regresiones de ambos casos), la integración completa de nuevo 28/28 y una descripción ambigua de punta a punta (propuesta con 0,79, sin «Recordado», aviso al validar). El recorrido de pantalla no se repitió: el frontend no cambió.
- Además corrige `npm run doc-bd` en Windows: con fin de línea CRLF se perdían las explicaciones de las restricciones SQL.
- **Pendiente:** probarlo con remitos reales leídos por Gemini y en un celular real.

## Validación de HU17 (14/11/2026, integrada en el PR #19)

- `npm test`: 148 correctas (4 nuevas en `test/revision.test.js`). `npm run build` correcto.
- Migración aplicada en una base descartable; `prisma migrate diff` contra el esquema sin diferencias.
- 23 controles de API y pantalla con la IA simulada: un comprobante de baja calidad exige marcar cada línea (validar y confirmar dan 400 sin las marcas, sin cambiar el estado), marcar y deshacer, línea manual revisada, confirmación con todas revisadas, marca bloqueada después de confirmar, comprobante normal sin exigencia, aviso y cuenta en pantalla a 390 px.
- **Base local:** quien trabaje con base local tiene que aplicar la migración (`npx prisma migrate deploy` o `npm run prisma:migrate`).

## Validación de HU18 (14/11/2026, integrada en el PR #18)

- `npm test`: 144 correctas (4 nuevas en `test/listado-comprobantes.test.js`). `npm run build` correcto.
- Contra una base descartable con la IA simulada (eliminada al terminar): 31 controles de API y pantalla correctos, con comprobantes confirmado, en revisión de baja calidad, con error y sin leer. Cubren filtros por estado, proveedor, fecha y número, conteos, paginación, permisos, retomar la revisión, consulta del confirmado, acceso desde el Inicio y la ficha del proveedor, y diseño a 390 px y escritorio.

## Ajuste de la asociación de HU15 (13/11/2026, integrado en el PR #14)

Corrige lo encontrado en la revisión: números sin unidad, conversión ml/l y g/kg, punto de miles, `C.C.` y `1/2 KG`; variantes propuestas como confiables (palabra leída que el producto no tiene o descripción que cubre poco del nombre → tope 0,79); abreviatura en un solo sentido («PAÑALES» ya no se asocia con «Pan»); empates resueltos por menor id; el aviso «Revisar» ya no aparece en comprobantes confirmados; rendimiento aproximadamente 2,5 veces mejor.

- `npm test`: 140 correctas (6 nuevas en `test/asociacion.test.js`; los casos claros anteriores siguen pasando). `npm run build` correcto.
- No se volvió a probar de punta a punta: `comprobantes.procesamiento.js` no cambió y las líneas de la lectura simulada están cubiertas por las pruebas unitarias.
- **Pendiente:** calibrar con remitos reales leídos por Gemini. La regla de la palabra sobrante es conservadora: si los remitos traen marcas que el catálogo no tiene, más líneas van a quedar destacadas.

## Validación de HU3 y permisos de HU2 (13/11/2026, integrada en el PR #13)

- `npm test` en `backend/`: 134 pruebas correctas (4 nuevas en `test/usuarios.test.js`). `npm run build` correcto.
- Contra una base descartable (eliminada al terminar): 44 controles de API y de pantalla correctos. Incluyen los permisos de HU2 que el plan pedía probar (401 sin sesión o con token inválido; 403 del empleado en usuarios, altas del catálogo y conciliación; 200 en sus consultas) y HU3: correo único sin distinguir mayúsculas, login con mayúsculas, cambio de contraseña, desactivación que corta una sesión abierta, reactivación y protección del propio propietario.
- Las pruebas de permisos son de punta a punta (script local, no en `npm test`): `npm test` no usa base de datos y `autenticar` relee el usuario en cada pedido.

## Validación de HU5 (13/11/2026, integrada en el PR #12)

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
