import { env } from '../config/env.js';
import * as gemini from './adaptadores/gemini.adapter.js';
import * as claude from './adaptadores/claude.adapter.js';

// RNF6: adaptador del proveedor de IA configurado (IA_PROVEEDOR). El resto
// del backend no conoce el proveedor.
const ADAPTADORES = { gemini, claude };

export const adaptadorReal = () => ADAPTADORES[env.ia.proveedor];
