# Pruebas de punta a punta

Comprobaciones contra PostgreSQL real: permisos, SQL, reenvíos y concurrencia. `npm test` no usa base de datos; estas sí, siempre con una base descartable.

```bash
npm run e2e -- hu21-claves
```

Se pueden pasar varios escenarios: `npm run e2e -- hu21-claves hu22-salidas`.

## Qué hace `correr.mjs`

1. Lee `DATABASE_URL` de `backend/.env` y **se niega a seguir si no apunta a localhost**.
2. Crea una base con nombre único, `remitto_e2e_<fecha con milisegundos>_<proceso>_<6 caracteres aleatorios>`, en ese mismo servidor. La base de desarrollo no se toca.
3. Aplica las migraciones (`prisma migrate deploy`) y el seed.
4. Levanta la API en un puerto libre que asigna el sistema, con la IA simulada (`IA_SIMULACION=ok`, sin clave) y los archivos en una carpeta temporal.
5. **Comprueba que la API que responde es la suya** antes de enviar cualquier operación (ver Aislamiento).
6. Corre cada escenario (`e2e/<nombre>.mjs`), que imprime un renglón por control (`ok` o `MAL`).
7. Detiene su API y borra su base, aunque haya fallas.

Termina con código 0 si todos los controles pasaron, 1 si alguno falló y 2 si abortó por aislamiento (sin correr escenarios).

## Aislamiento

- **Base propia:**
  - el nombre lleva milisegundos, el número de proceso y 6 caracteres aleatorios;
  - si `CREATE DATABASE` falla, por ejemplo porque el nombre ya existe, aborta;
  - solo borra una base que creó él mismo.
- **Nombres permitidos:** solo `remitto_e2e_` seguido de minúsculas, dígitos y guiones bajos. Las bases habituales (`postgres`, `template0`, `template1`, `remitto` y la de `DATABASE_URL`) se rechazan antes de ejecutar SQL.
- **Puerto propio:** usa uno libre. Con `E2E_PUERTO`, si el puerto ya está ocupado, aborta antes de crear la base.
- **Proceso propio:** si su API termina al arrancar, aborta.
- **Marca en la base:** antes de cualquier operación, escribe una categoría con un nombre aleatorio directamente en su base y la busca a través de la API. Iniciar sesión no escribe nada. Si la marca no aparece, la API que responde no usa su base y aborta sin enviar operaciones.
- **Limpieza:** solo detiene su propio proceso, borra su base y borra su carpeta temporal.

`npm run e2e:aislamiento` (`verificar-aislamiento.mjs`) prueba todo esto:
- una API ajena en el puerto pedido;
- una API ajena que responde `health` y el inicio de sesión, pero no usa la base de prueba;
- la API propia que cae al arrancar;
- nombres de base no permitidos;
- un choque con una base existente, que no se borra;
- dos ejecuciones en paralelo.

## Variables

| Variable | Uso |
| --- | --- |
| `E2E_PUERTO` | Puerto fijo para la API de prueba; tiene que estar libre. |
| `E2E_CONSERVAR=1` | No borra la base al terminar, para inspeccionarla. |
| `E2E_VERBOSO=1` | Muestra los errores de la API. |
| `E2E_BASE` | Solo para verificar el aislamiento: nombre de la base (validado como arriba). |
| `E2E_URL_API` | Solo para verificar el aislamiento: dirección local a la que se envían los pedidos. |

## Requisitos

- El PostgreSQL de desarrollo encendido: `docker compose up -d db`, en `localhost:5433`.
- Dependencias instaladas (`npm install`) y el cliente de Prisma generado (`npm run prisma:generate`).

## Escenarios

| Archivo | Historia | Qué comprueba |
| --- | --- | --- |
| `hu21-claves.mjs` | HU21 | Permisos, la clave completa solo en el alta, el hash SHA-256 en la base, el último uso, la revocación (incluso con pedidos en curso) y `CHECK chk_clave_revocada`. |
| `hu22-salidas.mjs` | HU22 | Contrato publicado, autenticación, validación y atomicidad, venta por código de barras e id, reenvíos (200 y 409), stock negativo y su aviso en la valorización, kilos, carrito sin cambios, 25 reenvíos simultáneos, 52 operaciones simultáneas de dos cajas y carritos, revocación con 120 ventas en curso y el orden determinístico venta → revocación. |

Para agregar uno, crear `e2e/<nombre>.mjs` con una función por defecto que recibe `{ api, check, db, login, dueño, empleado, base }`. `db` es un `PrismaClient` conectado a la base descartable.
