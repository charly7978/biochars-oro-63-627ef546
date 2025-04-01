
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Exportaciones del módulo ML para procesamiento de señal
 */

// Exportar componentes principales
export * from './MLSignalProcessor';
export * from './MixedPrecisionModel';
export * from './DataTransformer';

// Exportar funciones de creación para facilitar el uso
import { createMLSignalProcessor } from './MLSignalProcessor';
import { createMixedPrecisionModel } from './MixedPrecisionModel';
import { createDataTransformer } from './DataTransformer';

// Exportar nuevos módulos de optimización
export * from '../wasm/WasmProcessor';
export * from '../workers/SignalWorker';
export * from '../filters/KalmanFilter';

// Reexportar funciones de creación
export {
  createMLSignalProcessor,
  createMixedPrecisionModel,
  createDataTransformer
};

// Exportar funciones de utilidad nuevas
import { getWasmProcessor } from '../wasm/WasmProcessor';
import { createSignalWorker } from '../workers/SignalWorker';
import { createKalmanFilter } from '../filters/KalmanFilter';

export {
  getWasmProcessor,
  createSignalWorker,
  createKalmanFilter
};
