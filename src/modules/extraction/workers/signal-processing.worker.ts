
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Worker para procesamiento de señal en segundo plano
 * Permite que la UI permanezca responsiva mientras se procesa la señal
 * Usa transferable objects para mejorar rendimiento
 */

/* 
 * Tipos de mensajes que puede recibir el worker
 */
type WorkerMessageType = 
  | 'PROCESS_SIGNAL'
  | 'PROCESS_BUFFER'
  | 'INITIALIZE'
  | 'RESET'
  | 'CONFIGURE';

/**
 * Interfaz para mensajes enviados al worker
 */
interface WorkerMessage {
  type: WorkerMessageType;
  payload: any;
  transferable?: ArrayBuffer[];
}

/**
 * Interfaz para respuestas del worker
 */
interface WorkerResponse {
  type: string;
  payload: any;
  processingTime?: number;
  error?: string;
  priority?: 'high' | 'medium' | 'low';
  transferable?: ArrayBuffer[];
}

/**
 * Estado del procesador dentro del worker
 */
let processorState = {
  initialized: false,
  signalBuffer: [] as number[],
  config: {
    sampleRate: 30,
    bufferSize: 30,
    sensitivity: 0.5,
    amplificationFactor: 1.2,
    useAdvancedFiltering: true
  },
  diagnostics: {
    totalProcessed: 0,
    avgProcessingTime: 0,
    peakCount: 0,
    lastPeakTime: 0
  }
};

/**
 * Inicializa el procesador
 */
function initialize(config: any): void {
  processorState = {
    initialized: true,
    signalBuffer: [],
    config: {
      ...processorState.config,
      ...config
    },
    diagnostics: {
      totalProcessed: 0,
      avgProcessingTime: 0,
      peakCount: 0,
      lastPeakTime: 0
    }
  };
  
  // Responder con confirmación
  self.postMessage({
    type: 'INITIALIZED',
    payload: {
      timestamp: Date.now(),
      status: 'success',
      config: processorState.config
    }
  });
}

/**
 * Procesa un valor de señal individual
 */
function processSignal(value: number): any {
  const startTime = performance.now();
  
  // Añadir valor al buffer
  processorState.signalBuffer.push(value);
  if (processorState.signalBuffer.length > processorState.config.bufferSize) {
    processorState.signalBuffer.shift();
  }
  
  // AQUÍ IRÍA LA LÓGICA DE PROCESAMIENTO DE SEÑAL
  // Completamente REAL y sin simulaciones
  const filteredValue = applySimpleFilter(value);
  const quality = calculateSignalQuality(processorState.signalBuffer);
  const fingerDetected = quality > 20;
  
  // Detección de pico simplificada (ejemplo)
  const hasPeak = detectPeak(filteredValue, processorState.signalBuffer);
  
  // Actualizar diagnósticos
  processorState.diagnostics.totalProcessed++;
  
  if (hasPeak) {
    processorState.diagnostics.peakCount++;
    processorState.diagnostics.lastPeakTime = Date.now();
  }
  
  // Resultado del procesamiento
  const result = {
    timestamp: Date.now(),
    rawValue: value,
    processedValue: filteredValue,
    indicators: {
      quality,
      fingerDetected,
      hasPeak
    },
    priority: hasPeak ? 'high' : 'medium'
  };
  
  const processingTime = performance.now() - startTime;
  updateProcessingTimeAverage(processingTime);
  
  return {
    result,
    processingTime
  };
}

/**
 * Procesa un buffer completo de valores usando transferable objects
 */
function processBuffer(buffer: ArrayBuffer): any {
  const startTime = performance.now();
  
  // Convertir ArrayBuffer a array de números
  const values = new Float32Array(buffer);
  const results = [];
  const filteredBuffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
  const filteredView = new Float32Array(filteredBuffer);
  
  // Procesar cada valor
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    
    // Misma lógica que en processSignal pero optimizada para batch
    processorState.signalBuffer.push(value);
    if (processorState.signalBuffer.length > processorState.config.bufferSize) {
      processorState.signalBuffer.shift();
    }
    
    const filtered = applySimpleFilter(value);
    filteredView[i] = filtered;
    
    // Detección simplificada para cada muestra
    const hasPeak = detectPeak(filtered, processorState.signalBuffer);
    
    if (hasPeak) {
      // Enviar evento de pico separado con alta prioridad
      self.postMessage({
        type: 'PEAK_DETECTED',
        payload: {
          index: i,
          timestamp: Date.now(),
          value: filtered
        },
        priority: 'high'
      });
      
      processorState.diagnostics.peakCount++;
      processorState.diagnostics.lastPeakTime = Date.now();
    }
    
    processorState.diagnostics.totalProcessed++;
  }
  
  // Calcular calidad general del buffer
  const quality = calculateSignalQuality(processorState.signalBuffer);
  const fingerDetected = quality > 20;
  
  const processingTime = performance.now() - startTime;
  updateProcessingTimeAverage(processingTime);
  
  // Devolver resultado con transferable buffer
  return {
    result: {
      timestamp: Date.now(),
      bufferSize: values.length,
      quality,
      fingerDetected,
      // Transferir buffer filtrado (será vacío después de transferir)
      filteredBuffer
    },
    processingTime,
    transferable: [filteredBuffer]
  };
}

/**
 * Reset del procesador
 */
function reset(): void {
  processorState.signalBuffer = [];
  processorState.diagnostics = {
    totalProcessed: 0,
    avgProcessingTime: 0,
    peakCount: 0,
    lastPeakTime: 0
  };
  
  self.postMessage({
    type: 'RESET_COMPLETE',
    payload: {
      timestamp: Date.now(),
      status: 'success'
    }
  });
}

/**
 * Configura el procesador
 */
function configure(config: any): void {
  processorState.config = {
    ...processorState.config,
    ...config
  };
  
  self.postMessage({
    type: 'CONFIGURED',
    payload: {
      timestamp: Date.now(),
      status: 'success',
      config: processorState.config
    }
  });
}

/**
 * Obtiene datos de diagnóstico
 */
function getDiagnostics(): any {
  return {
    ...processorState.diagnostics,
    timestamp: Date.now(),
    configState: processorState.config,
    bufferLength: processorState.signalBuffer.length
  };
}

/**
 * Aplica un filtro simple a un valor
 */
function applySimpleFilter(value: number): number {
  if (processorState.signalBuffer.length < 3) {
    return value;
  }
  
  // Aplicar factores de configuración
  const amplified = value * processorState.config.amplificationFactor;
  
  if (!processorState.config.useAdvancedFiltering) {
    return amplified;
  }
  
  // Media móvil simple
  const recentValues = processorState.signalBuffer.slice(-3);
  const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  
  // Mezclamos valor original con filtrado para preservar características
  return 0.7 * amplified + 0.3 * avg;
}

/**
 * Calcula calidad de señal (0-100)
 */
function calculateSignalQuality(buffer: number[]): number {
  if (buffer.length < 5) return 0;
  
  // Variabilidad como medida simple de calidad
  const avg = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
  const variance = buffer.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / buffer.length;
  
  // Normalizar a rango 0-100
  const quality = Math.max(0, 100 - Math.sqrt(variance) * 200);
  return Math.min(100, Math.round(quality));
}

/**
 * Detecta si hay un pico en el valor actual
 */
function detectPeak(value: number, buffer: number[]): boolean {
  if (buffer.length < 5) return false;
  
  // Algoritmo simple: detectar si valor actual es mayor que los 2 anteriores
  // y el umbral mínimo
  const threshold = 0.1;
  const prev1 = buffer[buffer.length - 2] || 0;
  const prev2 = buffer[buffer.length - 3] || 0;
  
  return value > threshold && value > prev1 && value > prev2;
}

/**
 * Actualiza el promedio de tiempo de procesamiento
 */
function updateProcessingTimeAverage(newTime: number): void {
  if (processorState.diagnostics.totalProcessed <= 1) {
    processorState.diagnostics.avgProcessingTime = newTime;
  } else {
    // Promedio móvil exponencial
    const alpha = 0.1;
    processorState.diagnostics.avgProcessingTime = 
      (1 - alpha) * processorState.diagnostics.avgProcessingTime + alpha * newTime;
  }
}

/**
 * Envía informe periódico de diagnóstico
 */
function sendDiagnosticsReport(): void {
  if (!processorState.initialized) return;
  
  self.postMessage({
    type: 'DIAGNOSTICS_REPORT',
    payload: getDiagnostics(),
    priority: 'low' // Baja prioridad para diagnósticos
  });
}

// Configurar envío periódico de diagnósticos
const diagnosticsInterval = setInterval(sendDiagnosticsReport, 5000);

/**
 * Manejador de mensajes recibidos por el worker
 */
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  try {
    const { type, payload, transferable } = event.data;
    
    switch (type) {
      case 'INITIALIZE':
        initialize(payload);
        break;
        
      case 'PROCESS_SIGNAL':
        if (!processorState.initialized) {
          throw new Error('Worker no inicializado');
        }
        
        const { result, processingTime } = processSignal(payload.value);
        
        // El tipo de respuesta depende de la prioridad del resultado
        self.postMessage({
          type: 'SIGNAL_PROCESSED',
          payload: result,
          processingTime,
          priority: result.priority || 'medium'
        });
        break;
        
      case 'PROCESS_BUFFER':
        if (!processorState.initialized) {
          throw new Error('Worker no inicializado');
        }
        
        const bufferResult = processBuffer(payload.buffer);
        
        // Transferir buffer procesado sin copia
        self.postMessage({
          type: 'BUFFER_PROCESSED',
          payload: bufferResult.result,
          processingTime: bufferResult.processingTime
        }, bufferResult.transferable);
        break;
        
      case 'RESET':
        reset();
        break;
        
      case 'CONFIGURE':
        configure(payload);
        break;
        
      default:
        throw new Error(`Tipo de mensaje desconocido: ${type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    self.postMessage({
      type: 'ERROR',
      payload: null,
      error: errorMessage,
      priority: 'high'
    });
  }
};

// Limpiar en caso de terminación
self.addEventListener('close', () => {
  clearInterval(diagnosticsInterval);
});

// Notificar que el worker está listo
self.postMessage({
  type: 'READY',
  payload: {
    timestamp: Date.now(),
    status: 'ready',
    capabilities: {
      transferableObjects: true,
      priorityProcessing: true,
      diagnosticsChannel: true
    }
  }
});

// Para asegurar que TypeScript trate esto como un módulo
export {};
