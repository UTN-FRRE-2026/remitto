# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (15/11/2026)

- `origin/main` en `2dba88f` (merge del PR #30, HU23), comprobado el 15/11/2026. **En `main`:** hasta HU23. **Solo en la rama `feature/HU24-alertas-stock`, sin integrar:** HU24.
- **Primera entrega del TPI: lunes 16/11/2026.** Consigna y entregables en [entrega-tpi.md](entrega-tpi.md).
- **HU7:** el equipo informó el 14/11 que instaló la PWA en un Android real y funciona (no verificado en esta revisión).
- Los PDF de la documentación probatoria están fuera del repositorio (`../remitto-entrega/`); se regeneraron el 14/11 con HU16 a HU20 y HU27 a HU29. **No incluyen HU21 ni HU22**: hay que regenerarlos.
- **Integración externa:**
  - HU21 (claves de integración): integrada por el [PR #27](https://github.com/UTN-FRRE-2026/remitto/pull/27), merge `708f9d9`.
  - HU22 (salidas desde un sistema externo): integrada por el [PR #28](https://github.com/UTN-FRRE-2026/remitto/pull/28), merge `b822eb9`. El contenido integrado es idéntico al último commit publicado de la rama (`77e614f`).
  - HU23 (simulador de ventas): integrada por el [PR #30](https://github.com/UTN-FRRE-2026/remitto/pull/30), merge `2dba88f`.
  - El respaldo del avance de HU21 (el stash `5373a09` y el patch de `retomar/`, en la copia local de Maxi) se conserva aunque ya no hace falta.
- **Migraciones nuevas:** `20261114140000_hu21_claves_integracion` y `20261114150000_hu22_pedido_externo` (en `main`), y `20261115120000_hu24_alertas_stock` (rama de HU24, solo datos). Quien use una base local tiene que aplicarlas con `npx prisma migrate deploy` (sin reset). En producción, el contenedor las aplica al arrancar; no se verificó.
- PR #1 a #30 integrados en `main`.

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
| HU16 equivalencias por proveedor (con migración `hu16_equivalencias`) | [PR #20](https://github.com/UTN-FRRE-2026/remitto/pull/20) |
| HU28 valorización de existencias | [PR #21](https://github.com/UTN-FRRE-2026/remitto/pull/21) |
| Correcciones de HU16 y HU28 (precedencia del catálogo, fecha de emisión no futura) | [PR #22](https://github.com/UTN-FRRE-2026/remitto/pull/22) |
| HU27 sugerencia de reposición y HU29 productos sin movimiento | [PR #23](https://github.com/UTN-FRRE-2026/remitto/pull/23) |
| HU19 precisión de la lectura y HU20 evolución de precios de compra | [PR #24](https://github.com/UTN-FRRE-2026/remitto/pull/24) |
| Estado de HU7 en Android y de los entregables de la primera entrega (documentación) | [PR #25](https://github.com/UTN-FRRE-2026/remitto/pull/25) y [PR #26](https://github.com/UTN-FRRE-2026/remitto/pull/26) |
| HU21 claves de integración (con migración `hu21_claves_integracion`) y ejecutor de pruebas de punta a punta | [PR #27](https://github.com/UTN-FRRE-2026/remitto/pull/27) |
| HU22 salidas desde un sistema externo, contrato OpenAPI (con migración `hu22_pedido_externo`) y corrección de HU28 (stock negativo en la valorización) | [PR #28](https://github.com/UTN-FRRE-2026/remitto/pull/28) |
| HU23 simulador de ventas | [PR #30](https://github.com/UTN-FRRE-2026/remitto/pull/30) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 a HU6, HU8 a HU22, HU27 a HU29 |
| Simulador (sin pantalla) | HU23 (`simulador/simulador.mjs`, escenario `hu23-simulador`) |
| Implementada en su rama, sin integrar | HU24 alertas de stock (`feature/HU24-alertas-stock`) |
| Probada por el equipo | HU7 PWA (`vite-plugin-pwa`): instalada en un Android real y funcionando (informado el 14/11/2026, no verificado en esta revisión) |
| Sin implementar | HU25 (HU26 parcial) y las deseables HU30 y HU31. `/asistente` es `EnConstruccion` |

## Validación de HU24 (15/11/2026, rama `feature/HU24-alertas-stock`, sin integrar)

- **Qué hay:** observador de movimientos en `registrarMovimiento` (misma transacción), módulo `alertas` (regla, evaluación con la fila del producto bloqueada, `GET /api/alertas`), recálculo al crear, editar, desactivar o reactivar un producto, migración de datos `hu24_alertas_stock` para el stock que ya estaba bajo, seed y pantalla Alertas (campana del Inicio con punto solo si hay activas, y menú lateral).
- `npm test`: 224 correctas (9 nuevas en `test/alertas.test.js`: regla, coherencia con `estadoStock`, ciclo de vida, observador y su falla). `npm run build` correcto. `npm run doc-bd` sin cambios (la migración no cambia el esquema).
- `npm run e2e -- hu24-alertas`: 31/31 contra una base descartable (detalle en `backend/e2e/README.md`), incluidas 40 salidas simultáneas (endpoint y carrito) con una sola alerta por situación.
- **Migración:** probada sobre una base descartable con 12 productos (negativos, cero, en el mínimo, decimales, desactivados, uno con alerta previa): el resultado coincide con `tipoAlerta()` y repetirla no duplica.
- **Pantalla** (IA simulada, base descartable): 16 controles, con el ingreso por comprobante resolviendo una alerta (camino de HU11, que el escenario e2e no cubre), coherencia entre alertas e indicadores en cada paso, 375 y 360 px sin desplazamiento horizontal, empleado sin el acceso a la reposición y menú lateral con scroll. Un control del script falló por un error del propio script (la salida preparada era inválida), no de la aplicación.
- **Regresiones:** `hu21-claves`, `hu22-salidas` y `hu23-simulador` corridos en esta rama: 110 de 111. El que falla, «la revocación cayó con ventas en curso», **también falla en `main`** en esta máquina (las 120 ventas terminan antes de que llegue la revocación); depende de los tiempos y no lo causa HU24. Las garantías de esa parte pasan.
- **No probado:** en producción ni en un celular real.

## Revisión de HU21 a HU23 (15/11/2026, sobre `2dba88f`)

Revisión del código integrado, sin hallazgos de severidad alta ni media. Menores, no corregidos:
- HU22: la idempotencia es por clave. Si la caja reintenta con una clave nueva una venta cuya respuesta se perdió, se descuenta dos veces. El contrato OpenAPI pide enviar los reenvíos pendientes antes de revocar.
- HU22: la validación de hasta 3 decimales usa una tolerancia que rechaza algunas cantidades válidas muy grandes (alrededor de 1e8) y acepta valores con más decimales, que la base redondea. El stock sigue cuadrando.

## Validación de HU23 (14/11/2026, integrada en el PR #30; pruebas ejecutadas en la rama `feature/HU23-simulador-ventas`)

- **Qué hay:**
  - `simulador/simulador.mjs`, sin dependencias: genera ventas reproducibles con semilla, las envía por la API de HU22 con una clave de HU21 en tandas paralelas, reintenta ante un 503 con `Retry-After` (la misma referencia y el mismo contenido) y compara el stock.
  - El escenario `backend/e2e/hu23-simulador.mjs` lo corre contra la base descartable del ejecutor; la base de desarrollo no se toca.
  - No hay cambios en la aplicación ni migraciones.
- **Stock esperado independiente:**
  - se calcula en enteros de milésimas desde el stock inicial leído de la base como texto;
  - cada referencia descuenta una sola vez;
  - los códigos de barras se resuelven con el catálogo de prueba conocido;
  - no usa cantidades, stocks ni ids de las respuestas.
- **Pruebas ejecutadas en esta rama:**
  - `npm test`: 215 correctas, 10 nuevas en `test/simulador.test.js`. Cubren la reproducibilidad, 120 referencias y 30 reenvíos, cantidades válidas, milésimas exactas, el esperado contando cada referencia una vez (contar un reenvío cambia el resultado), los cuerpos válidos para HU22, el 503 seguido de 201 (2 intentos HTTP, 1 venta, la espera de `Retry-After` y la misma petición), el límite de reintentos agotado (envío incompleto) y la regla de respuestas por referencia.
  - `npm run e2e -- hu21-claves hu22-salidas hu23-simulador`: 111 controles correctos (38 + 63 + 10).
  - **Corrida válida (semilla 2026):**
    - 150 envíos lógicos (120 ventas únicas y 30 reenvíos) y 150 intentos HTTP;
    - 120 respuestas 201 y 30 respuestas 200 con `repetida`, 0 incompletos y un 201 por referencia con el mismo id en sus reenvíos;
    - 120 salidas y 257 movimientos en la base;
    - **0 diferencias** en los 6 productos y el stock igual a la suma de movimientos.
  - **Control negativo, separado:** la venta `SIM-2026-0007` registrada otra vez como `SIM-2026-0007-BIS`; el comparador detecta exactamente la diferencia introducida (6 unidades del producto #13).
  - **Corrida adicional** con la semilla 7, 200 ventas y 60 reenvíos: 260 operaciones, 0 diferencias y el control negativo detectado.
- **Corrección por la revisión de la rama publicada:** los reenvíos paralelos se agregaban a tandas que ya tenían ocho envíos; con la semilla 2026 había una tanda de 11 envíos simultáneos. Ahora se eligen primero los reenvíos y las tandas se arman con cada venta junto a sus reenvíos paralelos, sin pasar de ocho. Se conservan los 120 primeros envíos, los 30 reenvíos y los 15 que comparten tanda con su primer envío. Una prueba nueva mide con un `fetch` simulado las llamadas en curso a la vez (semillas 2026, 7 y 1): el máximo es 8 y se usa el paralelismo completo. Con el armado anterior, la prueba falla. `npm test` 214 correctas; `npm run e2e -- hu23-simulador` 10/10, con los mismos resultados (150 operaciones, 0 diferencias y el control negativo detectado).
- **Corrección por la segunda revisión:** con más reenvíos paralelos que lugares, `generarVentas` quedaba en un bucle infinito. Reproducido con 100 ventas y 1401 reenvíos: hay 701 reenvíos paralelos y solo caben 700, 7 por venta; el proceso no terminó en 5 s. Ahora `validarConfiguracion` rechaza antes de generar:
  - `ventas` que no sea un entero positivo;
  - `reenvios` que no sea un entero no negativo;
  - más de `2 × ventas × 7` reenvíos, con un mensaje que indica el máximo.
  - Regresión unitaria: el caso reproducido se rechaza; el límite exacto (1400 con 100 ventas) se acepta en tandas de 8; los valores inválidos se rechazan; los valores por defecto siguen siendo 120 y 30.
  - `npm test` 215 correctas; `npm run e2e -- hu23-simulador` 10/10, con los mismos resultados por defecto.
- **No probado:** contra un punto de venta real ni contra producción. El simulador solo corre en el ejecutor de punta a punta, no contra una API arbitraria.

## Actualización documental tras integrar HU21 y HU22 (14/11/2026)

- **Comprobado en esta actualización:**
  - `origin/main` en `b822eb9`, con los merges `708f9d9` (PR #27) y `b822eb9` (PR #28), y el contenido igual a `77e614f`.
  - La base de desarrollo local de Maxi (`localhost:5433`, base `remitto`) recibió con `npx prisma migrate deploy` las migraciones `hu16_equivalencias`, `hu21_claves_integracion` y `hu22_pedido_externo`, sin reset ni seed.
  - `npx prisma migrate status` informa la base al día, con 8 migraciones.
  - Los conteos de datos son iguales antes y después, ningún producto quedó descuadrado y `chk_clave_revocada` y `chk_pedido_externo` quedaron validados.
- **No se repitieron pruebas de código:** esta actualización solo cambia documentación. Las pruebas de las dos secciones siguientes se ejecutaron durante el desarrollo, sobre las ramas, antes de integrarlas.

## Validación de HU22 (14/11/2026, integrada en el PR #28; pruebas ejecutadas en la rama `feature/HU22-salidas-integracion`)

- `POST /api/v1/integracion/salidas` reutiliza el núcleo del carrito (`registrarSalida`, extraído de HU13 sin cambiar su comportamiento). Contrato OpenAPI 3.0 en `backend/src/modules/integracion/openapi.json`, publicado en `GET /api/v1/integracion/openapi.json` y enlazado desde la pantalla Integraciones.
- **Decisiones:** la referencia es única por clave (índice existente desde el diseño inicial); un reenvío igual devuelve 200 y uno distinto 409; la venta se registra aunque deje stock negativo, con aviso; una línea inválida rechaza la venta entera; la clave se vuelve a comprobar dentro de la transacción (`FOR SHARE`) para que ninguna venta entre después de revocarla.
- **Defectos encontrados y corregidos:**
  - Con una ráfaga de operaciones sobre los mismos productos, las transacciones de salida (también las del carrito de HU13) fallaban con 500 (`P2028`, sin conexión libre en los 2 s por defecto de Prisma): 1 de 52 operaciones en una corrida y entre 24 y 43 de 120 en otras. Ahora esperan hasta 10 s (`maxWait`) y, si aun así no hay conexión, responden 503 con `Retry-After`. Después del cambio, 0 errores en 3 corridas seguidas.
  - Un cuerpo que no es JSON válido respondía 500; ahora 400 (y 413 si excede el límite).
  - El service worker de la PWA respondía la aplicación a cualquier navegación, incluso a `/api/...`: abrir el enlace al contrato desde la app instalada llevaba al inicio. Se excluye `/api/` (`navigateFallbackDenylist`), verificado en el `sw.js` generado. No se pudo probar en ejecución: el navegador integrado no registra service workers.
  - HU28: los productos con stock negativo (algo esperable con HU22) desaparecían de la valorización sin aviso. Ahora se listan aparte, sin sumar (commit propio).
- `npm test`: 204 correctas (8 nuevas en `test/integracion.test.js`, entre ellas que los ejemplos del contrato pasen la validación del backend y que campos, límites y unidades coincidan; la de valorización con stock negativo se actualizó). `npm run build` correcto.
- **Punta a punta reproducible:** `npm run e2e -- hu21-claves hu22-salidas` → 83 controles correctos (38 + 45). Los de HU22 cubren contrato publicado, 401 (sin clave, inexistente, token de persona), validación y atomicidad (400 sin descontar), venta por código de barras e id con líneas sumadas, cabecera y movimientos sin usuario, último uso, Movimientos «Punto de venta (Caja 1)», reenvío 200 en otro orden y con espacios, 409 con otro contenido, misma referencia en otra caja, stock negativo con aviso y en la valorización, kilos, carrito sin cambios (sigue rechazando sin stock y su reenvío), 25 envíos simultáneos de la misma venta (un 201 y 24 × 200, un solo descuento), 52 operaciones simultáneas (40 ventas de dos cajas y 12 carritos, productos en orden aleatorio) con el stock esperado igual al registrado, revocación con 120 ventas en curso (cada 201 tiene su venta, ningún 401 deja una, después 10 de 10 rechazadas), el orden determinístico venta en curso → revocación, y stock igual a la suma de movimientos.
- **Pruebas de mutación:** sin el `FOR SHARE` fallan 3 controles (la revocación se confirma antes que la venta en curso); sin el manejo del índice único fallan 2 (los reenvíos simultáneos dan 409). Restaurado, 45/45.
- Recorrido en el navegador de la app contra una base descartable: venta y reenvío por el proxy de la app, valorización con el recuadro de stock negativo a 375 px, Movimientos con «Venta · Punto de venta (Caja de prueba HU22)» y la ayuda de Integraciones con el ejemplo y el enlace al contrato.
- **No probado:** con un sistema de punto de venta real ni en producción (HTTPS, Coolify).
- **Corrección por la revisión de la rama publicada (reenvíos con el catálogo cambiado):** `registrarVenta` resolvía los códigos de barras antes de buscar la venta existente. Reproducido contra PostgreSQL: venta por código, cambio del código y reenvío exacto → 400; con el código borrado → 400; con el código pasado a otro producto → 409; y el mismo producto por `productoId` se aceptaba como reenvío.
  - Ahora cada venta guarda su petición normalizada en `salidas.pedido_externo` (migración `20261114150000_hu22_pedido_externo`, `CHECK chk_pedido_externo`). El reenvío se busca primero y se reconoce comparando las líneas normalizadas con sus identificadores originales, sin consultar el catálogo; la fecha no participa.
  - **Datos existentes:** la base de desarrollo local no tenía salidas, y en `main` el endpoint nunca existió. Igual, la migración no inventa peticiones: si encuentra ventas de integración sin petición, las conserva y deja el CHECK sin validar para ellas (rige para las nuevas); si no hay, lo valida. Probado en una base descartable en los dos casos (validado `true`; con una venta previa, validado `false`, la venta intacta y una nueva sin petición rechazada). Esas ventas previas se comparan como antes, por producto resuelto.
  - **Contrato:** documenta la regla de comparación y las respuestas 413 y 503 con `Retry-After`; la prueba del contrato las exige.
  - **Verificación:** `npm test` 205 correctas (normalización y firma de la petición, contrato); `npm run e2e -- hu22-salidas` 59/59: código cambiado, borrado, pasado a otro producto y producto desactivado (200, misma venta, sin descontar), fecha distinta (200), venta nueva con el código viejo (400), otra cantidad, otro producto o el mismo por `productoId` (409 sin tocar el stock), 10 reenvíos simultáneos con el código cambiado (una sola venta), petición guardada y el CHECK en la base. `prisma migrate diff` sin diferencias. Mutación: resolver los productos antes de buscar la venta da 5 fallas.
  - **Colisión de firmas (segunda revisión):** la primera firma concatenaba texto, y una línea con el código «a=1|c:b» y cantidad 1 equivalía a dos líneas «a» y «b». Ahora es una lista de tuplas `[tipo, identificador, cantidad]` ordenada y serializada con JSON, inequívoca para cualquier código, sin restringir los códigos y con la misma normalización. Prueba unitaria y regresión contra PostgreSQL: venta con la línea «COL-a=1|c:COL-b», reenvío de la misma referencia con «COL-a» y «COL-b» → 409 sin cambiar stock ni movimientos, y el reenvío original sigue en 200. `npm test` 205 correctas; `npm run e2e -- hu21-claves hu22-salidas` 101/101 (38 + 63). Mutación con la firma anterior: falla la prueba unitaria y la regresión da 200.
  - El control de la revocación con 120 ventas en curso dependía de los tiempos (en una corrida la revocación llegó después de todas): ahora repite hasta 3 rondas con otra clave hasta que se superponen, y comprueba las garantías en todas.

## Validación de HU21 (14/11/2026, integrada en el PR #27; pruebas ejecutadas en la rama `feature/HU21-claves-integracion`)

- Se recuperó el avance del 13/11 y se adaptó a `main` (`474b7b0`): conflicto en `routes.js` con los reportes; la migración pasó a `20261114140000_hu21_claves_integracion` para quedar después de las de HU16 y HU17. Se completaron la pantalla (estilos, ruta solo para el propietario, acceso desde Cuenta), el esquema `bearer` sin distinguir mayúsculas y la documentación. Las pruebas históricas no se tomaron como válidas: todo se volvió a correr.
- `npm test`: 196 correctas (12 de `test/claves.test.js`). `npm run build` correcto.
- **Punta a punta reproducible:** `npm run e2e -- hu21-claves` (nuevo ejecutor `backend/e2e/correr.mjs`, base descartable): 38 controles correctos. Permisos (401 sin sesión o con token inválido, 403 del empleado al listar, generar y revocar), la clave completa solo en el alta, SHA-256 en la base y la parte secreta en ninguna columna, último uso, 401 con clave revocada, inexistente o con formato inválido, token de persona y clave no intercambiables, revocación idempotente, `CHECK chk_clave_revocada` y 40 pedidos en curso mientras se revoca (todos 200 o 401; después, 20 de 20 rechazados).
- **Prueba de mutación:** sin el filtro `AND activa` en la validación, el escenario detecta 3 fallas; restaurado, 38/38.
- **Corrección por la revisión de la rama publicada (aislamiento del ejecutor E2E):** la primera versión aceptaba cualquier API que respondiera `/health` en su puerto (las pruebas podían escribir en otra base), usaba nombres de base con precisión de segundos y, si `CREATE DATABASE` fallaba por un nombre repetido, borraba la base de otra ejecución. Ahora usa un puerto libre (o aborta si el pedido está ocupado), detecta si su API cae al arrancar, comprueba con una marca aleatoria escrita en su base que la API que responde la usa, valida el nombre de la base antes de cualquier SQL (solo `remitto_e2e_…`, nunca una base habitual), genera nombres únicos (milisegundos, proceso y azar) y solo borra lo que creó. `npm run e2e:aislamiento`: 26 controles correctos (API ajena en el puerto, API ajena con health y login pero sin la marca, API propia que cae, 9 nombres no permitidos, choque con una base existente que se conserva, dos ejecuciones en paralelo). Mutaciones: sin el control de la marca, el ejecutor llegó a enviar `GET` y `POST /claves-integracion` a la API ajena (2 fallas); borrando sin haber creado, se perdió la base preexistente (1 falla). `npm run e2e -- hu21-claves` de nuevo 38/38.
- Migración: `prisma migrate diff` sin diferencias; las filas inconsistentes previas se normalizan antes de agregar el CHECK (probado con datos armados a mano).
- Recorrido en el navegador de la app contra una base descartable: generar (la clave mostrada autentica contra la API; el botón «Copiar» no se probó), «Ya la guardé» y recarga sin la clave, cancelar y confirmar la revocación (la clave revocada recibe 401), escritorio y 375 px sin desplazamiento horizontal, acceso desde Cuenta; el empleado no ve el acceso y `/integraciones` lo lleva al inicio.
- **No probado:** con un sistema de punto de venta real ni en producción. La copia al portapapeles depende de HTTPS (en `localhost` funciona; si falla, el texto queda seleccionado).

## Validación de HU19 y HU20 (14/11/2026, integrada en el PR #24)

- `npm test`: 184 correctas (6 nuevas en `test/precision-evolucion-precios.test.js`). `npm run build` correcto.
- Contra una base descartable con la IA simulada: tres remitos confirmados con fechas de emisión de junio, agosto y septiembre (precio corregido, línea descartada, línea agregada a mano). 45 controles de API y pantalla correctos con los valores calculados de antemano. Precisión: 66,7 %, 25 % y 100 % por comprobante; general 6 de 10 líneas (60 %) ponderado por líneas; las lecturas simuladas se listan y no entran en el general (para medirlo se marcaron como reales en la base); un comprobante en revisión no cuenta; meta sin veredicto con menos de 20. Evolución: orden por aumento (+18,8 %), historial ordenado por fecha, comparación entre proveedores (5,6 % más caro), período corto, producto sin precios, 404/400, empleado 403. Pantalla: precisión general y por comprobante, gráfico con leyenda, cursor y teclado, tabla de precios, búsqueda, a 390 px y en escritorio.
- No probado con lecturas reales de Gemini: la meta del 85 % sobre 20 remitos queda por medir con remitos del comercio.

## Validación de HU27 y HU29 (14/11/2026, integrada en el PR #23)

- `npm test`: 178 correctas (6 nuevas en `test/reposicion-sin-movimiento.test.js`). `npm run build` correcto.
- Contra una base descartable con la IA simulada (un ingreso que registra precios, salidas y un producto sin stock deseado): 32 controles de API y pantalla correctos con los valores calculados de antemano. Reposición: solo productos en el mínimo o por debajo, cantidades al deseado, agrupación por último proveedor con costo, «Sin proveedor registrado», sin deseado aparte. Sin movimiento: excluye los que tuvieron salidas y los sin stock, los recuentos no cuentan como salidas, orden por valor, período por defecto y elegido a mano, rango inválido. Permisos 403/401, pestañas, acceso desde el Inicio, empleado sin acceso y diseño a 390 px y escritorio.

## Revisión de HU16 y HU28 (14/11/2026, sobre `dec36a7`)

Revisión independiente de lo integrado en los PR #20 y #21: 166 pruebas y build correctos; migraciones consistentes con el esquema en una base descartable; concurrencia de las equivalencias y valorización verificadas contra PostgreSQL. Correcciones integradas en el PR #22:

- **HU16:** una equivalencia dudosa (0,79) reemplazaba la propuesta de HU15 aunque esta fuera confiable, por ejemplo un código de barras exacto de otro producto. Ahora una dudosa solo se usa si el catálogo no da una propuesta de 0,8 o más (`elegirPropuesta`).
- **HU28:** la fecha de emisión que corrige una persona no tenía tope; una fecha futura fijaba la vigencia del precio y dominaba el «último precio» para siempre. Ahora no puede ser posterior a hoy (backend y campo de la pantalla).
- `npm test`: 172 correctas (6 nuevas). `npm run build` correcto. Contra una base descartable: lectura con propuestas, fecha futura rechazada (400), confirmación y segunda lectura con equivalencias recordadas (5 controles).

**Pendientes de la revisión, no corregidos:**
- HU16: la ambigüedad se pierde si una sola corrección con un código nuevo pisa la fila por descripción, o si un mismo comprobante trae la misma descripción con dos productos; diferencias menores de normalización («1.000 GR» y «1000 GR»); «Recordado» puede tapar el aviso «Revisar». Las pruebas son solo de funciones puras.
- HU28 (a decidir): los productos desactivados con stock no aparecen en el reporte; un precio 0 cuenta como valorizado; ~~el stock negativo se excluye sin aviso~~ (corregido con HU22: se lista aparte); con tres categorías iguales los porcentajes no suman 100; el empleado ve «Precios y reportes» en el menú de escritorio. Las pruebas no ejecutan el SQL.
- `npm run doc-bd` lee el cliente de Prisma generado: correr antes `npm run prisma:generate`.

## Validación de HU28 (14/11/2026, integrada en el PR #21)

- `npm test`: 153 correctas (5 nuevas en `test/valorizacion.test.js`, una con 200 casos generados que comprueba que el total coincide con la suma por categoría pese al redondeo). `npm run build` correcto.
- Integración contra una base descartable (`remitto_hu28`, migraciones y seed, eliminada al terminar) con la IA simulada; los precios se crean confirmando remitos: 26 controles correctos. Cubren permisos (200 propietario, 403 empleado, 401 sin sesión), base sin precios (todo aparte), último precio por fecha de vigencia y no por orden de carga, total igual a la suma por categoría y a un cálculo independiente en SQL, productos sin precio aparte y sin duplicarse, grupo «Sin categoría» con kilos y centavos, producto desactivado fuera del reporte, y una salida que baja el total en stock × último precio.
- **Corrección por la revisión de los commits publicados** (mismo día): la primera versión leía productos y precios con dos consultas independientes, y un ingreso concurrente podía mezclar estados (antes 10 × 100 = 1.000, después 20 × 200 = 4.000, el reporte daba 2.000). Ahora stock y último precio se leen en una sola sentencia SQL (`LEFT JOIN LATERAL`), que ve una única foto de la base. Verificado contra PostgreSQL: con el ingreso entre las dos lecturas, la versión anterior da 2.000; con un escritor que alterna los dos estados mientras cuatro lectores piden el reporte, la versión anterior mezcló 55 a 72 de unas 7.000 lecturas y la corregida 0 de 13.362. Prueba de regresión en `npm test` (una sola consulta); `npm test` 154 correctas; integración completa de nuevo 26/26. El build y el recorrido de pantalla no se repitieron: el frontend no cambió.
- Recorrido automatizado en el navegador de la app: propietario en escritorio y a 375 px (total, categorías, despliegue de productos, productos sin precio, acceso desde Cuenta, sin desplazamiento horizontal) y empleado (mensaje y sin acceso en Cuenta).
- **Actualizada con `main` después de integrar HU16** (PR #20): merge sin reescribir los commits publicados; los conflictos fueron solo de documentación. Verificación conjunta: base descartable con las 6 migraciones (incluida `hu16_equivalencias`), `npm test` 166 correctas, `npm run build` correcto y 14 controles de equivalencias y valorización sobre la misma versión (aprendizaje al confirmar, asociación «Recordado» en el siguiente comprobante, valorización con el precio confirmado y el nuevo, total igual a la suma por categoría y al cálculo SQL, 403 del empleado, stock igual a la suma de movimientos). Las pruebas intensivas de concurrencia no se repitieron: esa lógica no cambió.
- **Pendiente:** revisarlo con los precios reales del comercio y en un celular real.

## Validación de HU16 (14/11/2026, integrada en el PR #20)

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
