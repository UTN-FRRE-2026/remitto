# Pruebas de punta a punta

Comprobaciones contra PostgreSQL real: permisos, SQL, reenvíos y concurrencia. `npm test` no usa base de datos; estas sí, siempre con una base descartable.

```bash
npm run e2e -- hu21-claves
```

Se pueden pasar varios escenarios: `npm run e2e -- hu21-claves hu22-salidas`.

## Qué hace `correr.mjs`

1. Lee `DATABASE_URL` de `backend/.env` y **se niega a seguir si no apunta a localhost**.
2. Crea `remitto_e2e_<fecha>` en ese mismo servidor. La base de desarrollo no se toca.
3. Aplica las migraciones (`prisma migrate deploy`) y el seed.
4. Levanta la API en el puerto `E2E_PUERTO` (4100 por defecto), con la IA simulada (`IA_SIMULACION=ok`, sin clave) y los archivos en una carpeta temporal.
5. Corre cada escenario (`e2e/<nombre>.mjs`), que imprime un renglón por control (`ok` o `MAL`).
6. Detiene la API y borra la base, aunque haya fallas. Con `E2E_CONSERVAR=1` la conserva para inspeccionarla; con `E2E_VERBOSO=1` muestra los errores de la API.

Termina con código 0 solo si todos los controles pasaron.

## Requisitos

- El PostgreSQL de desarrollo encendido: `docker compose up -d db`, en `localhost:5433`.
- Dependencias instaladas (`npm install`) y el cliente de Prisma generado (`npm run prisma:generate`).
- El puerto 4100 libre.

## Escenarios

| Archivo | Historia | Qué comprueba |
| --- | --- | --- |
| `hu21-claves.mjs` | HU21 | Permisos, la clave completa solo en el alta, el hash SHA-256 en la base, el último uso, la revocación (incluso con pedidos en curso) y `CHECK chk_clave_revocada`. |

Para agregar uno, crear `e2e/<nombre>.mjs` con una función por defecto que recibe `{ api, check, db, login, dueño, empleado, base }`. `db` es un `PrismaClient` conectado a la base descartable.
