
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Worker real para procesamiento de señal en segundo plano
 */
import { WorkerMessageType, WorkerMessage } from './SignalWorker';
import { getWasmProcessor } from '../wasm/WasmProcessor';

// Establecer contexto del worker
const ctx: Worker = self as any;

// Estado local del worker
let isInitialized = false;
let processingConfig = {
  useWasm: true,
  sampleRate: 30,
  filterQ: 0.01,
  filterR: 0.1,
  minPeakDistance: 5,
  peakThreshold: 0.5
};

// Caché para valores recientes
let recentValues: number[] = [];
const MAX_RECENT_VALUES = 300;

// Procesador WASM
let wasmProcessor: any = null;

/**
 * Inicializa el worker
 */
async function initialize(): Promise<boolean> {
  if (isInitialized) return true;
  
  try {
    console.log("[SignalWorker] Inicializando worker real");
    
    // Inicializar el procesador WASM si está habilitado
    if (processingConfig.useWasm) {
      wasmProcessor = getWasmProcessor();
      await wasmProcessor.initialize();
      console.log("[SignalWorker] Procesador WASM inicializado con éxito");
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("[SignalWorker] Error en inicialización:", error);
    return false;
  }
}

/**
 * Procesa un valor de señal
 */
function processSignal(value: number): number {
  // Añadir el valor al histórico
  recentValues.push(value);
  if (recentValues.length > MAX_RECENT_VALUES) {
    recentValues.shift();
  }
  
  // Aplicar filtro Kalman usando WASM si está disponible
  if (wasmProcessor && processingConfig.useWasm) {
    const filtered = wasmProcessor.applyKalmanFilter(
      [value], 
      processingConfig.filterQ, 
      processingConfig.filterR
    );
    return filtered[0];
  }
  
  // Implementación de respaldo si WASM no está disponible
  let x = 0;
  let p = 1;
  const q = processingConfig.filterQ; 
  const r = processingConfig.filterR;
  
  // Predicción
  p = p + q;
  
  // Corrección
  const k = p / (p + r);
  x = x + k * (value - x);
  p = (1 - k) * p;
  
  return x;
}

/**
 * Procesa un lote de valores
 */
function processBatch(values: number[]): number[] {
  // Añadir valores al histórico
  recentValues.push(...values);
  if (recentValues.length > MAX_RECENT_VALUES) {
    recentValues = recentValues.slice(-MAX_RECENT_VALUES);
  }
  
  // Filtrar usando WASM si está disponible
  if (wasmProcessor && processingConfig.useWasm) {
    return wasmProcessor.applyKalmanFilter(
      values, 
      processingConfig.filterQ, 
      processingConfig.filterR
    );
  }
  
  // Implementación de respaldo
  const result = new Array(values.length);
  let x = 0;
  let p = 1;
  const q = processingConfig.filterQ;
  const r = processingConfig.filterR;
  
  for (let i = 0; i < values.length; i++) {
    // Predicción
    p = p + q;
    
    // Corrección
    const k = p / (p + r);
    x = x + k * (values[i] - x);
    p = (1 - k) * p;
    
    result[i] = x;
  }
  
  return result;
}

/**
 * Aplica filtros adicionales
 */
function applyFilter(values: number[], filterType: string): number[] {
  // Verificar que tenemos datos suficientes
  if (values.length === 0) {
    return values;
  }
  
  switch (filterType) {
    case 'kalman':
      return wasmProcessor && processingConfig.useWasm 
        ? wasmProcessor.applyKalmanFilter(values, processingConfig.filterQ, processingConfig.filterR)
        : processBatch(values);
        
    case 'fft':
      return wasmProcessor && processingConfig.useWasm
        ? wasmProcessor.applyFFT(values)
        : values; // Fallback simple
        
    case 'wavelet':
      return wasmProcessor && processingConfig.useWasm
        ? wasmProcessor.applyWavelet(values, 0)
        : values; // Fallback simple
        
    default:
      return values;
  }
}

/**
 * Detecta picos en la señal
 */
function detectPeaks(values: number[]): number[] {
  if (values.length < 3) {
    return [];
  }
  
  if (wasmProcessor && processingConfig.useWasm) {
    return wasmProcessor.findPeaks(
      values, 
      processingConfig.minPeakDistance, 
      processingConfig.peakThreshold
    );
  }
  
  // Implementación de respaldo
  const peaks: number[] = [];
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && 
        values[i] > values[i + 1] && 
        values[i] > processingConfig.peakThreshold) {
      
      // Verificar distancia mínima
      if (peaks.length === 0 || 
          i - peaks[peaks.length - 1] >= processingConfig.minPeakDistance) {
        peaks.push(i);
      }
      // Quedarse con el pico más alto si hay dos cercanos
      else if (values[i] > values[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
      }
    }
  }
  
  return peaks;
}

/**
 * Maneja los mensajes entrantes
 */
ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  const { type, data, requestId } = message;
  
  try {
    switch (type) {
      case WorkerMessageType.INITIALIZE:
        const success = await initialize();
        sendResponse(requestId!, { success });
        break;
        
      case WorkerMessageType.PROCESS_SIGNAL:
        if (!isInitialized) await initialize();
        const processed = processSignal(data.value);
        sendResponse(requestId!, { processed });
        break;
        
      case WorkerMessageType.PROCESS_BATCH:
        if (!isInitialized) await initialize();
        const batchResult = processBatch(data.values);
        sendResponse(requestId!, { processed: batchResult });
        break;
        
      case WorkerMessageType.APPLY_FILTER:
        if (!isInitialized) await initialize();
        const filtered = applyFilter(data.values, data.filterType);
        sendResponse(requestId!, { filtered });
        break;
        
      case WorkerMessageType.DETECT_PEAKS:
        if (!isInitialized) await initialize();
        const peaks = detectPeaks(data.values);
        sendResponse(requestId!, { peaks });
        break;
        
      default:
        console.warn(`[SignalWorker] Tipo de mensaje desconocido: ${type}`);
        sendError(requestId!, `Tipo de mensaje desconocido: ${type}`);
    }
  } catch (error) {
    console.error(`[SignalWorker] Error procesando mensaje tipo ${type}:`, error);
    sendError(requestId!, `Error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Envía una respuesta al hilo principal
 */
function sendResponse(requestId: string, data: any): void {
  const response: WorkerMessage = {
    type: WorkerMessageType.RESULT,
    data,
    requestId
  };
  
  ctx.postMessage(response);
}

/**
 * Envía un error al hilo principal
 */
function sendError(requestId: string, errorMessage: string): void {
  const response: WorkerMessage = {
    type: WorkerMessageType.ERROR,
    data: { error: errorMessage },
    requestId
  };
  
  ctx.postMessage(response);
}

// Configurar manejador de errores
ctx.onerror = (error: ErrorEvent) => {
  console.error('[SignalWorker] Error no capturado:', error.message);
  
  // Notificar al hilo principal
  ctx.postMessage({
    type: WorkerMessageType.ERROR,
    data: { error: error.message },
    requestId: 'uncaught-error'
  });
  
  return true; // Prevenir propagación
};

// Inicializar worker en segundo plano
initialize().then(success => {
  console.log(`[SignalWorker] Inicialización completada, estado: ${success ? 'exitoso' : 'con errores'}`);
});
