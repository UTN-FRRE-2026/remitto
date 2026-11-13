# Referencia de interfaz de Remitto

La fuente visual es [maquetacion.html](referencias/maquetacion.html), copia sin modificaciones del HTML provisto por el equipo. Abrilo en un navegador para ver las composiciones, imágenes y gráficos. Es una maqueta estática, no la aplicación. Se incluye HTML porque permite inspeccionar el texto y los estilos además de verlo; no se duplica en PDF.

Para trabajar en UI, consultá primero esta guía y los componentes/CSS actuales. Abrí solo la pantalla visual que necesites. El HTML contiene fuentes y SVG embebidos: leerlo entero como texto agrega mucho contexto poco útil.

## Sistema visual

| Elemento | Referencia | Uso |
| --- | --- | --- |
| Crema | `#F2E9D8` | Fondo general |
| Oscuro | `#2E2528` | Textos, títulos y menú lateral web |
| Verde salvia | `#A7B6A0` | Estados positivos y tarjetas |
| Verde salvia oscuro | `#4E6A4B` | Botones principales y navegación activa |
| Dorado suave | `#D4B56A` | Advertencias y líneas para revisar |
| Rojo | `#A60321` | Sin stock, errores y acciones que borran |
| Azul grisáceo | `#8298A3` | Funciones de IA |
| Tipografía | Plus Jakarta Sans, pesos 500–800 | Marca y textos |

La implementación ya define esta paleta en `frontend/src/styles/tokens.css`. Reutilizar esos tokens y los componentes existentes. La escala de referencia es: marca 44/800, título 27/800, sección 17/800, producto 15/700, texto 14/500 y detalle 12,5/500.

## Pantallas de referencia

| ID | Pantalla | Contenido principal |
| --- | --- | --- |
| P0 | Portada | Presentación del proyecto |
| P1 | Guía de estilo | Marca, paleta, tipografía, botones y estados |
| M1 | Inicio de sesión | Correo, contraseña y acceso al comercio |
| M2 | Inicio móvil | Carga de remito, indicadores y productos para reponer |
| M3 | Cargar remito | Captura con cámara, galería o PDF y proveedor |
| M4 | Leyendo con IA | Etapas de procesamiento y aviso de revisión previa al ingreso |
| M5 | Revisar remito | Asociaciones, confianza, líneas dudosas, productos nuevos y confirmación |
| M6 | Productos | Búsqueda, categorías y estados de stock |
| M7 | Nueva salida | Motivo, productos, cantidades y registro del carrito |
| M8 | Asistente | Preguntas, respuesta y representación de datos |
| D1 | Tablero web | Indicadores, entradas/salidas, reposición y comprobantes recientes |
| D2 | Revisión web | Archivo original junto a líneas editables y sus estados |
| D3 | Evolución de precios | Comparación por producto, proveedor y período |
| D4 | Integraciones | Claves, salidas externas y ejemplo de API |

## Criterios de uso

- Priorizar las tareas móviles de ingreso de mercadería y carrito. La web usa barra lateral y mayor espacio para tablas y documentos; conservar navegación y componentes que el proyecto ya haya adoptado.
- Distinguir visualmente estados de stock y niveles de confianza. Los errores deben explicar qué corregir.
- Mostrar por separado lo leído por IA y lo asociado o corregido. El stock se actualiza al confirmar, conforme a las reglas de negocio.
- Las cantidades, totales, porcentajes, proveedores, fechas y claves enmascaradas son ejemplos de presentación. No sirven como datos de prueba ni como validaciones contables.
- El alcance y los criterios de aceptación provienen del [plan](plan-de-trabajo.md). Elementos ilustrativos como «Olvidé mi contraseña», escaneo, comparaciones o ejemplos de rutas no autorizan funcionalidades adicionales ni cambian contratos implementados.
- La maqueta no cubre cada pantalla del backlog. Para una vista no ilustrada, extender el diseño existente con una solución simple y consistente.
