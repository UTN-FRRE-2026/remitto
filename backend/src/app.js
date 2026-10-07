import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env, esProduccion } from './config/env.js';
import routes from './routes.js';
import { manejadorErrores, noEncontrado } from './middlewares/error.js';

export function crearApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!esProduccion) app.use(morgan('dev'));

  app.use('/api', routes);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
