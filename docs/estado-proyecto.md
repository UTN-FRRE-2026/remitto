# Estado y continuidad de Remitto

Fotografía breve para retomar el trabajo. Git, los PR y el código son la fuente de verdad: contrastá esta nota antes de usarla.

## Referencia verificada (15/11/2026)

- `origin/main` en `0aea032` (merge del PR #36, corrección de HU25), comprobado el 15/11/2026. **En `main`:** HU1 a HU31, las 29 obligatorias y las 2 deseables.
- **Primera entrega del TPI: lunes 16/11/2026.** Consigna y entregables en [entrega-tpi.md](entrega-tpi.md).
- **HU7:** el equipo informó el 14/11 que instaló la PWA en un Android real y funciona (no verificado en esta revisión).
- Los PDF de la documentación probatoria están fuera del repositorio (`../remitto-entrega/`); se regeneraron el 14/11 con HU16 a HU20 y HU27 a HU29. **No incluyen HU21 a HU31**: hay que regenerarlos (requerimientos y manual; el diseño de la base no cambió).
- **Integración externa:**
  - HU21 (claves de integración): integrada por el [PR #27](https://github.com/UTN-FRRE-2026/remitto/pull/27), merge `708f9d9`.
  - HU22 (salidas desde un sistema externo): integrada por el [PR #28](https://github.com/UTN-FRRE-2026/remitto/pull/28), merge `b822eb9`. El contenido integrado es idéntico al último commit publicado de la rama (`77e614f`).
  - HU23 (simulador de ventas): integrada por el [PR #30](https://github.com/UTN-FRRE-2026/remitto/pull/30), merge `2dba88f`.
  - El respaldo del avance de HU21 (el stash `5373a09` y el patch de `retomar/`, en la copia local de Maxi) se conserva aunque ya no hace falta.
- **Migraciones nuevas:** `20261114140000_hu21_claves_integracion`, `20261114150000_hu22_pedido_externo` y `20261115120000_hu24_alertas_stock` (solo datos), todas en `main`. HU26 no agrega migraciones. Quien use una base local tiene que aplicarlas con `npx prisma migrate deploy` (sin reset). En producción, el contenedor las aplica al arrancar. El 15/11 las rutas de HU21 a HU31 respondían en producción (401 sin sesión), lo que indica el esquema al día; no se entró con usuario.
- PR #1 a #36 integrados en `main`.

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
| HU24 alertas de stock (con migración `hu24_alertas_stock`) | [PR #31](https://github.com/UTN-FRRE-2026/remitto/pull/31) |
| HU26 tablero de situación | [PR #32](https://github.com/UTN-FRRE-2026/remitto/pull/32) |
| HU25 asistente de consultas | [PR #33](https://github.com/UTN-FRRE-2026/remitto/pull/33) |
| HU31 orden de compra (deseable; dependencia nueva `pdfkit`) | [PR #34](https://github.com/UTN-FRRE-2026/remitto/pull/34) |
| HU30 escaneo del código en el carrito (deseable; dependencias nuevas `@zxing/browser` y `@zxing/library`) | [PR #35](https://github.com/UTN-FRRE-2026/remitto/pull/35) |
| Corrección de HU25 con Gemini real (período y argumentos del plan) | [PR #36](https://github.com/UTN-FRRE-2026/remitto/pull/36) |

HU1, HU2 y HU4 a HU7 llegaron con el scaffold inicial. Integrado no significa que se haya comprobado ahora cada criterio de aceptación.

## Avance por historia (lectura del código, no auditoría)

| Estado observado | Historias |
| --- | --- |
| Backend y pantalla | HU1 a HU6, HU8 a HU22, HU24 a HU29 |
| Simulador (sin pantalla) | HU23 (`simulador/simulador.mjs`, escenario `hu23-simulador`) |
| Backend y pantalla (deseables) | HU30 escaneo del código en el carrito y HU31 orden de compra |
| Probada por el equipo | HU7 PWA (`vite-plugin-pwa`): instalada en un Android real y funcionando (informado el 14/11/2026, no verificado en esta revisión) |

## Verificación final (15/11/2026, sobre `0aea032`)

- **Pruebas de todo `main`, con dependencias reinstaladas (`npm ci`):**
  - `npm test`: 257 correctas.
  - `npm run build` correcto.
  - `npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu26-tablero hu25-asistente hu31-orden-compra hu30-codigo`: 189 de 189.
  - `hu24-alertas`, aparte: 31 de 31.
- **`npm run e2e:aislamiento`: falló 1 de 26** («la API de prueba cae al arrancar» terminaba con código 1 y no 2).
  - Desde HU24, el seed importa `alertas.service`, que cargaba el cliente global y con él la configuración del servidor. La configuración inválida de la prueba hacía fallar el seed antes de que arrancara la API.
  - El ejecutor igual abortaba sin correr escenarios y borraba su base.
  - Corregido: `alertas.service` ya no importa el cliente global (la ruta le pasa `prisma`). Ahora 26 de 26; `hu24-alertas` y `hu26-tablero` 53 de 53.
- **Producción** (`remitto.blackandred.com.ar`), solo pedidos sin sesión:
  - `/api/health` responde y HTTP redirige a HTTPS (certificado de Let's Encrypt hasta el 24/01/2027);
  - las rutas de HU21 a HU31 existen (401 sin sesión);
  - el frontend publicado incluye el escáner de HU30.
  - No se verificó con usuario si ya corre la corrección de HU25 (PR #36).
- **Login:** el encabezado (logo, «Remitto» y el lema) nunca se veía.
  - La máscara del borde dentado tenía una sola capa con `repeat-x` de 20 px de alto, así que todo lo que estaba por encima quedaba transparente. Le pasaba a cualquier navegador, y así quedó también en la captura del manual del 13/11.
  - Se corrigió con una segunda capa sólida, comprobado en el navegador, y se reemplazó `docs/manual/01-inicio-sesion.png`.
- **Auditoría de criterios (HU1 a HU31 contra el código):** ningún criterio sin implementar. Se corrigió el botón «Olvidé mi contraseña», que no hacía nada: ahora explica que el propietario asigna una nueva desde Usuarios. Quedan para el equipo:
  - **Patrones del plan:** Repository no existe como capa; los servicios usan Prisma directamente, y varios lo reciben como `db` para transacciones y pruebas. Strategy elige el adaptador de IA (Gemini o simulado) y el tipo de archivo (imagen o PDF), no una estrategia por «imagen de baja calidad», que solo activa la revisión obligatoria (HU17). Adapter y Observer coinciden con el plan. Conviene explicarlo así en el Informe y en la defensa.
  - **Pruebas automáticas:** HU1 a HU7 y HU12 a HU20 solo tienen pruebas unitarias. Se agregó el escenario `hu11-ingreso` (HU8 a HU11), con 18 de 18 controles, para el flujo central: carga, lectura, revisión, todo o nada, 6 confirmaciones simultáneas con una sola entrada y la invariante del stock.
  - **Login:** precargaba el correo y la contraseña del propietario de ejemplo también en producción. Ahora solo se precargan en desarrollo (`npm run dev`); el build de producción no contiene la contraseña (verificado). Igual conviene cambiar `remitto123` en producción si ese usuario existe allí.
  - **Dependencias:** se actualizaron sin cambios de versión mayor `body-parser` 1.20.9, `multer` 2.5.0 y `qs` 6.16.2 (backend). Las 257 pruebas y el escenario de ingreso, que sube archivos, siguen correctos.
    - Quedan `zod` (alta: consumo de memoria con colecciones enormes) y `react-router` (moderada). Su arreglo exige pasar a una versión mayor, así que no se tocan antes de la entrega.

## Validación de HU30 (15/11/2026, integrada en el PR #35; pruebas ejecutadas en la rama `feature/HU30-escanear-codigo`)

- **Qué hay:**
  - `EscanerCodigo.jsx`: cámara trasera con ZXing (`@zxing/browser` 0.1.5 y `@zxing/library` 0.21.3, dependencias nuevas del frontend, fijadas). Se carga recién al abrir el escáner, en un chunk aparte que el service worker precachea.
  - Formatos EAN-13/8, UPC-A/E, Code 128/39 e ITF. Se cierra con el primer código leído y apaga la cámara, también con Cancelar o Escape.
  - Botón en el buscador de **Nueva salida** (`BuscadorProducto` con `escanear`). El recuento y los demás buscadores no cambian.
  - `GET /api/productos?codigo=`: coincidencia exacta entre los activos.
  - Sin migraciones.
- **Pruebas ejecutadas en esta rama:**
  - `npm test`: 253 correctas, 2 nuevas en `test/catalogo.test.js` (esquema y filtro exacto).
  - `npm run e2e -- hu30-codigo`: 11 de 11. **Mutación:** con búsqueda parcial (`contains`) fallan 4.
  - **Regresión:** `npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu26-tablero hu25-asistente hu31-orden-compra hu30-codigo` dio 188 de 189, y `hu24-alertas` aparte, 31 de 31. La falla es la de siempre, «la revocación cayó con ventas en curso» de HU22, que depende de los tiempos y falla igual en `main` (`e31ec10`).
  - `npm run build` correcto.
  - **Navegador** con una cámara simulada de Chromium (video con un EAN-13 generado) contra una base descartable, en 24 controles:
    - el código leído agrega el producto y un segundo escaneo suma uno;
    - un código desconocido muestra el aviso y no agrega nada;
    - un producto sin stock avisa y no entra;
    - sin cámara, explica y vuelve a la búsqueda;
    - la búsqueda por nombre y el lector tipo teclado siguen funcionando;
    - la salida descuenta lo escaneado;
    - 375 px sin desplazamiento horizontal, escritorio y sin errores de consola.
- **Códigos del seed:** son ficticios y su dígito verificador EAN no es válido, así que una cámara no los lee. No se cambiaron porque HU22, el contrato OpenAPI y sus pruebas los usan. Para la demo, cargar en un producto el código real de un envase.
- **No probado:** en un celular real (Android o iPhone), en producción (la cámara exige HTTPS) y con códigos impresos reales.

## Revisión de HU25, HU26 y HU31 (15/11/2026, sobre `e31ec10`)

Revisión del código integrado. Se volvieron a correr `npm test` (251) y los e2e de todas las historias (las de HU25, HU26 y HU31 correctas). No se corrigió nada.
- **HU25, alta (por probar con Gemini real):** los argumentos de cada herramienta se validan con `.strict()` y no aceptan `null` ni claves de más. Con un `soloVentas` en `sin_ventas`, un `periodo: null` o `{ dias: 7, desde: null }`, la consulta termina en «argumentos inválidos», sin reintento. El planificador simulado siempre manda argumentos exactos, por eso las pruebas no lo ven. Se arregla quitando los `null` y descartando las claves que la herramienta no usa antes de validar.
- **HU25, media:**
  - el frontend muestra «Ocurrió un error» en los 503 y 500 del asistente, porque el mensaje viene en `respuesta` y `api.js` lee `error`;
  - la «Última venta» de `sin_ventas` sale en UTC (`toISOString`), así que una venta a las 21:30 del 10/11 se muestra como 11/11.
- **HU25, bajas:**
  - la aclaración queda resuelta antes de ejecutar: si falla, hay que volver a preguntar;
  - `stock_producto` llama «sin stock» al negativo.
- **HU26:** nada grave. «Para reponer» del Inicio incluye productos sin stock y sin mínimo, que la sugerencia de HU27 excluye. Ya pasaba antes.
- **HU31:** nada grave.
  - Un `?proveedor=` mayor que un INT4 probablemente dé 500 en vez de 400; es el mismo patrón que el resto de los ids.
  - Helvetica de pdfkit no dibuja caracteres fuera de WinAnsi (−, ≥, emojis); los acentos y la ñ salen bien.
  - En un iPhone con la PWA instalada, `<a download>` puede abrir el visor en lugar de descargar (sin probar).

## Validación de HU31 (15/11/2026, integrada en el PR #34; pruebas ejecutadas en la rama `feature/HU31-orden-compra`)

- **Qué hay:**
  - `GET /api/reportes/reposicion/orden?proveedor=<id|sin>`, solo el propietario, que reutiliza `reposicion()` de HU27;
  - `backend/src/modules/reportes/ordenCompra.js` (`ordenDeCompra`, `nombreArchivo`, `generarPdf` con `pdfkit` 0.20.2, dependencia nueva, sin comprimir);
  - el botón por proveedor en Reposición;
  - `api.descargar()` en el frontend: `api.blob()` conserva su contrato y sigue devolviendo un Blob;
  - CORS expone `Content-Disposition`.
  - El PDF lleva el proveedor y una tabla de producto, cantidad y unidad, sin precios; los productos sin compras salen como lista «a definir».
  - Sin migraciones.
- **Pruebas ejecutadas en esta rama:**
  - `npm test`: 251 correctas, 6 nuevas en `test/orden-compra.test.js`:
    - el grupo de `sugerir` sin recalcular;
    - decimales, paquetes y unidades;
    - la lista sin proveedor;
    - un proveedor fuera de la sugerencia;
    - el nombre de archivo;
    - el parámetro;
    - el texto del PDF.
    - **El PDF de 60 renglones,** con nombres largos y acentos: 3 páginas con la cabecera repetida en cada una, todos los renglones completos con su cantidad y su unidad (texto extraído con `test/pdf-texto.js`), sin superposiciones entre renglones y con la cantidad entera en su columna (comprobado por las posiciones del texto).
  - `npm run e2e -- hu31-orden-compra`: 14 de 14 contra PostgreSQL.
  - **Regresión:**
    - `npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu26-tablero hu25-asistente hu31-orden-compra` dio 178 de 178, y `hu24-alertas` aparte, 31 de 31;
    - `npm run build` correcto.
  - **Revisión visual del PDF de 60 renglones** (dibujado con pdf.js en el navegador): nombres en dos líneas, cantidades de miles con decimales completas y alineadas, acentos correctos, la cabecera en las páginas 2 y 3, y el cierre «60 productos».
  - **Navegador** contra una base descartable:
    - los tres botones (dos proveedores y la lista sin proveedor) generan su PDF con el nombre esperado (200 en la red);
    - a 375 px, sin desplazamiento horizontal;
    - **regresión de `api.blob()`:** «Ver archivo» en la revisión de un comprobante sigue obteniendo el PDF original;
    - sin errores de consola.
- **No probado:** la descarga en un celular real (en la PWA instalada) ni en producción. `npm audit` informa vulnerabilidades previas de `body-parser` y `multer`, ajenas a esta historia.

## Corrección de HU25 con Gemini real (15/11/2026, integrada en el PR #36; pruebas ejecutadas en la rama `fix/HU25-plan-gemini`)

- **Qué se encontró:** fue la primera prueba con Gemini real (`gemini-3.1-flash-lite`), contra una base descartable con ventas, roturas y precios.
  - Los 8 tipos respondían, pero las herramientas con producto nunca recibían el período (0 de 10).
  - Gemini escribe las claves del JSON en orden alfabético: «periodo» queda antes que «producto», y como el modelo empieza por el producto ya no lo agregaba.
  - Por eso «¿Cuánta gaseosa cola vendí en octubre?» respondía «Del 17/10 al 15/11 se vendieron 12 u.» (los 30 días por defecto), cuando en octubre no hubo ventas.
  - Además, «¿Cuánto me aumentó la yerba con palo en los últimos tres meses?» llegaba con un `soloVentas` de más y terminaba en «argumentos inválidos».
  - Ni una regla en las instrucciones ni un ejemplo lo resolvían: se probó directamente con el SDK.
- **Corrección:**
  - `propertyOrdering` en el esquema del plan, con el producto primero;
  - antes de validar se descartan los `null` y las claves del plan que la herramienta no usa (quedan en la traza como `argumentosDescartados`); una clave ajena al plan, como `sql`, sigue rechazándose;
  - una regla para «desde octubre» (de ese día hasta hoy).
- **Pruebas:**
  - `npm test`: 255 correctas, 4 nuevas. Mutación: sin la limpieza falla la prueba del flujo.
  - `npm run e2e -- hu25-asistente`: 31 de 31 con la IA simulada.
  - **Gemini real**, 31 consultas: los 8 tipos, la aclaración y su elección con el mismo período, y «fuera de alcance».
    - Las 15 preguntas con producto y período lo recibieron.
    - «desde octubre» se tomaba como solo octubre hasta agregar la regla; después, de ese día hasta hoy (3 de 3).
    - Ningún «argumentos inválidos», ni ninguna clave descartada después del arreglo.
    - Tiempos de 1,3 a 7 s, con picos de 14 a 28 s propios de la capa gratuita.
- **Pendiente de la revisión de HU25 (no corregido en esta rama):**
  - el mensaje de los 503 y 500 en la pantalla;
  - la fecha en UTC de «Última venta»;
  - la aclaración resuelta antes de ejecutar.

## Validación de HU25 (15/11/2026, integrada en el PR #33)

- **Qué hay:**
  - el módulo `backend/src/modules/asistente/` (esquemas, 8 herramientas de lectura, servicio y rutas solo para el propietario);
  - `backend/src/ia/asistente.js`, `instruccionesAsistente.js` y `planSimulado.js`;
  - `planificar` en los adaptadores de Gemini y simulado;
  - la pantalla `Asistente.jsx`, con el acceso en el menú lateral y en Cuenta, solo para el propietario.
  - Sin migraciones: usa `consultas_agente`.
  - `sinMovimiento` (HU29) acepta `soloVentas` (por defecto `false`, sin cambios en HU29). `productos.listar` y `productos.resumen` ya aceptaban `db` (HU26).
- **Diseño:**
  - **El modelo solo devuelve un plan JSON** (herramienta y argumentos, aclaración o fuera de alcance).
  - **El backend valida y ejecuta** una herramienta habilitada en una transacción de solo lectura con `statement_timeout`, y arma el texto y la tabla o el gráfico.
  - **Límites:** 2 intentos sin reintentos del SDK y un presupuesto global de 30 s. Es el límite de espera; el objetivo de RNF2 es 3 s.
  - **Aclaración:** se guarda un plan pendiente. La elección ejecuta la misma herramienta y el mismo período sin volver al modelo.
- **Pruebas ejecutadas en esta rama:**
  - `npm test`: 242 correctas, 13 nuevas en `test/asistente.test.js`:
    - los 8 tipos con el planificador simulado;
    - los períodos nombrados y sus rechazos;
    - los argumentos;
    - la resolución de productos;
    - más de 20 resultados con totales del conjunto completo;
    - los rótulos de ventas y salidas;
    - el flujo con adaptador falso: reintento por JSON inválido, proveedor, herramienta ajena y argumentos inválidos;
    - el **presupuesto de tiempo con reloj simulado**: 25 s más 5 s restantes, 31 s sin segundo intento, y sin tiempo para la herramienta;
    - sin IA (503).
  - `npm run e2e -- hu25-asistente`: 31 de 31 contra PostgreSQL con la IA simulada:
    - los 8 tipos, cada uno contra una fuente independiente;
    - salidas frente a ventas;
    - «sin ventas» frente a HU29;
    - 20 de 26 filas, con el total del conjunto completo;
    - «en octubre» exacto;
    - la aclaración y la elección con el mismo período (400 y 409);
    - 5 fallas registradas, incluido el tiempo agotado a los 30 s;
    - los permisos y el registro de las 18 consultas.
  - **Mutaciones:**
    - sin la lista de herramientas habilitadas, falla el control de herramienta no habilitada;
    - con «sin ventas» igual a «sin salidas», falla el control del tipo 6.
  - **Regresión:** `npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu26-tablero hu25-asistente` dio 164 de 164, y `hu24-alertas` aparte, 31 de 31. El escenario de HU25 usa nombres específicos («gaseosa cola», «yerba mate») y calcula los totales por unidad, para no depender de los productos que crean otros escenarios.
  - `npm run build` correcto.
  - **Navegador**, con una base descartable y datos cargados por la API:
    - propietario: una pregunta sugerida (ranking de ventas con barras), una escrita con aclaración entre dos yerbas y la elección con el gráfico de precios del mismo período, una pregunta fuera de alcance y una tabla ancha a 375 px sin desplazamiento horizontal;
    - empleado: la API da 403, `/asistente` lo lleva al inicio y no ve el acceso ni en el menú ni en Cuenta.
- **Corrección por la revisión de la rama publicada:**
  - **Presupuesto de tiempo:** `maxWait` (la espera por una conexión) y `timeout` (la ejecución) podían sumar más que lo restante. Reproducido con reloj y base simulados: 9 s esperando la conexión y 22 s ejecutando daban una respuesta exitosa con `duracionMs` 31000.
    - Ahora el paso completo tiene un tope de reloj real igual al tiempo restante.
    - Ya con la conexión se recalcula lo que queda, que pasa a ser el `statement_timeout`; si la espera lo consumió, la herramienta no se ejecuta.
    - Al terminar, si el presupuesto venció, la consulta se registra con TIEMPO y su duración real.
  - **Evolución del precio:** con más de 20 proveedores devolvía todas las filas sin aviso. Ahora muestra 20, informa el total real («Se muestran 20 de 21 proveedores») y el gráfico muestra los mismos proveedores que la tabla, siempre con el del texto.
  - **Regresiones unitarias:**
    - espera por conexión más ejecución (9 s y 22 s, TIEMPO con 31000 ms);
    - conexión que consume el presupuesto (no se ejecuta);
    - proveedor, conexión y ejecución dentro de los 30 s (exitosa) y por encima (TIEMPO);
    - 21 proveedores (20 filas, 21 en total y el gráfico coherente).
    - Las dos fallaban con el commit anterior.
  - `npm test`: 244 correctas. `npm run e2e -- hu25-asistente`: 31 de 31.
- **No probado:** con Gemini real (planificador y tiempos), en un celular real ni en producción.

## Validación de HU26 (15/11/2026, integrada en el PR #32)

- **Qué hay:** `GET /api/tablero` (módulo `backend/src/modules/tablero/`) y el Inicio, que lo usa como único pedido.
  - Trae el resumen de stock, las alertas activas por tipo y las más graves, los comprobantes pendientes por estado (PENDIENTE, PROCESANDO, EN_REVISION y ERROR; los confirmados y anulados no cuentan) con los que esperan revisión, los 4 productos para reponer y, solo para el propietario, el valor del stock del mismo `valorizacion` de HU28.
  - Al empleado no le llega ese valor: el permiso se aplica en el backend.
  - No hay migraciones.
- **Una sola foto:**
  - una transacción interactiva `REPEATABLE READ` con `SET TRANSACTION READ ONLY`;
  - los servicios reutilizados reciben la transacción (`productos.resumen` y `productos.listar` pasaron a aceptar `db`, sin cambiar su comportamiento) y las consultas van una detrás de otra.
- **Pruebas ejecutadas en esta rama:**
  - `npm test`: 229 correctas, 5 nuevas en `test/tablero.test.js`.
  - `npm run e2e -- hu26-tablero`: 22 de 22.
    - Coincidencia de cada indicador con un cálculo propio en SQL, el valor igual a `/reportes/valorizacion` y los cambios después de confirmar, de una salida y de un recuento.
    - El empleado recibe el tablero sin valor ni precios; sin sesión, 401.
    - **Prueba determinística:** un recuento confirmado entre dos lecturas. Con `REPEATABLE READ` el tablero entero corresponde a la foto inicial, y la variante `READ COMMITTED` mezcla estados (resumen en A, alertas y valor en B).
    - **Ráfaga complementaria:** unas 830 lecturas con unos 85 recuentos concurrentes y 0 mezcladas.
  - **Mutación:** con `ReadCommitted` como aislamiento por defecto fallan la prueba determinística y la ráfaga (151 de 840 lecturas mezcladas).
  - **Regresión:** `npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu24-alertas hu26-tablero` dio 163 de 164. La que falla es de `hu24-alertas`, que necesita el stock del seed sin cambios (HU22 vende una leche) y está documentado que se corre aparte. Corrido solo: 31 de 31.
  - `npm run build` correcto.
  - **Navegador**, con una base descartable y datos cargados por la API:
    - propietario en escritorio y a 375 px: las tres tarjetas y los chips por estado; el chip «En revisión» abre Comprobantes filtrado;
    - la página hace un único pedido (`/tablero`);
    - el empleado ve solo alertas y comprobantes, y su respuesta no trae valor ni precios;
    - sin desplazamiento horizontal ni errores de consola.
- **Base local:** se aplicó `hu24_alertas_stock` con `npx prisma migrate deploy`, sin reset ni seed. Quedó al día, con 9 migraciones.
- **No probado:** en un celular real ni en producción.

## Validación de HU24 (15/11/2026, integrada en el PR #31)

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
