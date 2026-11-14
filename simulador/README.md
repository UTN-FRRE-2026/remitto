# Simulador de ventas — Remitto

Simulador de un punto de venta que valida la integración (RF5.3 / HU23). Informa ventas aleatorias por el endpoint de HU22 (`POST /api/v1/integracion/salidas`), con una clave de integración de HU21, e incluye reenvíos duplicados intencionales. Al terminar compara el stock esperado con el registrado.

## Cómo se ejecuta

Corre como escenario del ejecutor de pruebas de punta a punta. El ejecutor crea una base descartable, levanta su propia API con la IA simulada y comprueba que esa API usa su base. La base de desarrollo no se toca.

```bash
cd backend && npm run e2e -- hu23-simulador
```

Requiere el PostgreSQL de desarrollo encendido (`docker compose up -d db`). Variables opcionales:

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `SIM_SEMILLA` | 2026 | Semilla del generador: la misma semilla produce las mismas ventas. |
| `SIM_VENTAS` | 120 | Ventas distintas (cada una con su referencia). |
| `SIM_REENVIOS` | 30 | Reenvíos intencionales de ventas ya generadas. |

## Qué hace (`simulador.mjs`, sin dependencias)

1. **Ventas reproducibles** (`generarVentas`):
   - cada venta tiene de 1 a 4 líneas sobre 6 productos de prueba (uno por kilo);
   - cada producto se identifica, al azar, por `codigoBarras` o por `productoId`;
   - las cantidades se generan como enteros en milésimas (enteras para los productos por unidad);
   - a veces el mismo producto se repite en dos líneas.
2. **Reenvíos:** repiten la misma referencia y contenido, a veces con las líneas en otro orden. La mitad sale en paralelo con el primer envío de esa venta y la otra mitad, al final.
3. **Envío** (`simular`):
   - en tandas de hasta 8 pedidos en paralelo (cada venta con sus reenvíos paralelos en la misma tanda);
   - ante un 503 reenvía la misma petición después de `Retry-After`, hasta 3 reintentos;
   - si algún envío no termina en 201 o 200, queda **incompleto** y la corrida falla.
4. **Stock esperado** (`stockEsperado`), sin mirar las respuestas:
   - parte del stock inicial leído de la base;
   - resta cada venta **una sola vez por referencia**;
   - resuelve los códigos de barras con el catálogo de prueba conocido;
   - todo en enteros de milésimas.
5. **Comparación** (`compararStock`): contrasta el esperado con `stock_actual` leído de la base, producto por producto.

## Resultado

La salida muestra dos bloques separados:

- **Corrida válida:**
  - envíos lógicos (ventas únicas y reenvíos), intentos HTTP, respuestas 201 y 200, y envíos incompletos;
  - una tabla de stock esperado y registrado por producto;
  - los dos criterios de HU23: al menos cien operaciones de salida y cero diferencias.
  - Además comprueba:
    - que cada referencia tenga exactamente un 201 y el resto 200 con `repetida` y el mismo id;
    - que en la base haya una salida por venta;
    - que el stock coincida con la suma de movimientos.
- **Control negativo:** después de la corrida válida registra a propósito un descuento adicional: la venta `0007` otra vez, con la referencia nueva `…-BIS`. El comparador tiene que detectar exactamente esa diferencia. Demuestra que la comparación detecta un doble descuento, y sus diferencias no cuentan para la corrida válida.

Las funciones puras y los reintentos tienen pruebas unitarias en `backend/test/simulador.test.js`, sin red.
