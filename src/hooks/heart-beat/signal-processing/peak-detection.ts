
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 * VERSIÓN MEJORADA: Más sensible a señales débiles
 */

// Diagnostics channel integration
export interface DiagnosticsData {
  timestamp: number;
  processTime: number;
  signalStrength: number;
  processorLoad: number;
  dataPointsProcessed: number;
  peakDetectionConfidence: number;
  processingPriority: 'high' | 'medium' | 'low';
}

// Global diagnostics collector
let diagnosticsBuffer: DiagnosticsData[] = [];
const MAX_DIAGNOSTICS_BUFFER = 100;

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements
 * VERSIÓN MEJORADA: Mucho más sensible
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Añadir diagnóstico sobre decisión de procesamiento
  const signalStrength = Math.abs(value);
  
  // UMBRAL MUCHO MÁS BAJO para aumentar sensibilidad
  const processingDecision = signalStrength >= 0.0035;
  
  // Determinar prioridad basada en la fuerza de la señal
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (signalStrength >= 0.03) {
    priority = 'high';
  } else if (signalStrength >= 0.01) {
    priority = 'medium';
  }
  
  // Registrar diagnóstico
  addDiagnosticsData({
    timestamp: Date.now(),
    processTime: 0,
    signalStrength,
    processorLoad: 0,
    dataPointsProcessed: 1,
    peakDetectionConfidence: processingDecision ? signalStrength * 20 : 0, // Aumento de confianza
    processingPriority: priority
  });
  
  // Diagnóstico de señales débiles
  if (signalStrength < 0.01 && processingDecision) {
    console.log("Peak-detection: Procesando señal DÉBIL:", {
      intensidad: signalStrength,
      umbralMínimo: 0.0035,
      prioridad: priority
    });
  }
  
  // Umbral más sensible para capturar señales reales
  return processingDecision;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 * VERSIÓN MEJORADA: Incluye diagnóstico detallado para depuración
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  const now = Date.now();
  
  // Registrar evento de señal débil en diagnósticos
  addDiagnosticsData({
    timestamp: now,
    processTime: 0,
    signalStrength: 0.003, // Valor muy bajo característico
    processorLoad: 0,
    dataPointsProcessed: 1,
    peakDetectionConfidence: 0,
    processingPriority: 'low'
  });
  
  console.log("Peak-detection: Señal demasiado débil para procesar", {
    timestamp: new Date(now).toISOString(),
    arrhythmiaCounter
  });
  
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    },
    isArrhythmia: false,
    // Adding transition state to ensure continuous color rendering
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    },
    // Add priority information for downstream processing
    priority: 'low'
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 * VERSIÓN MEJORADA: Mejor diagnóstico y manejo de prioridad
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const startTime = performance.now();
  const now = Date.now();
  
  // Determinar prioridad basada en la confianza del resultado y fuerza de señal
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (result.confidence > 0.4) {
    priority = 'high';
  } else if (result.confidence > 0.15) { // Bajado el umbral para medium
    priority = 'medium';
  }
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.02) { // Bajado el umbral de confianza
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // Elevar la prioridad si se detecta un pico
    priority = 'high';
    
    // Diagnóstico más detallado
    console.log("Peak-detection: PICO DETECTADO (control exclusivo por PPGSignalMeter)", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      valorAbsoluto: Math.abs(value),
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false,
      prioridad: priority
    });
  } else if (Math.abs(value) > 0.01 && result.confidence <= 0.02) {
    // Diagnóstico para señales con amplitud pero baja confianza
    console.log("Peak-detection: Señal con amplitud pero baja confianza", {
      amplitud: Math.abs(value),
      confianza: result.confidence,
      tiempo: new Date(now).toISOString()
    });
  }
  
  // Registrar diagnóstico con tiempo de procesamiento real
  const endTime = performance.now();
  addDiagnosticsData({
    timestamp: now,
    processTime: endTime - startTime,
    signalStrength: Math.abs(value),
    processorLoad: isMonitoringRef.current ? 1 : 0,
    dataPointsProcessed: 1,
    peakDetectionConfidence: result.confidence || 0,
    processingPriority: priority
  });
  
  // Añadir información de prioridad al resultado
  result.priority = priority;
}

/**
 * Add diagnostics data to the buffer
 * Implements circular buffer to prevent memory leaks
 */
export function addDiagnosticsData(data: DiagnosticsData): void {
  diagnosticsBuffer.push(data);
  if (diagnosticsBuffer.length > MAX_DIAGNOSTICS_BUFFER) {
    diagnosticsBuffer.shift();
  }
}

/**
 * Get all diagnostics data
 * Allows external systems to access diagnostics without affecting main processing
 */
export function getDiagnosticsData(): DiagnosticsData[] {
  return [...diagnosticsBuffer];
}

/**
 * Clear diagnostics buffer
 */
export function clearDiagnosticsData(): void {
  diagnosticsBuffer = [];
}

/**
 * Get average processing time from diagnostics
 * Useful for performance monitoring
 */
export function getAverageDiagnostics(): {
  avgProcessTime: number;
  avgSignalStrength: number;
  highPriorityPercentage: number;
} {
  if (diagnosticsBuffer.length === 0) {
    return {
      avgProcessTime: 0,
      avgSignalStrength: 0,
      highPriorityPercentage: 0
    };
  }
  
  const totalTime = diagnosticsBuffer.reduce((sum, data) => sum + data.processTime, 0);
  const totalStrength = diagnosticsBuffer.reduce((sum, data) => sum + data.signalStrength, 0);
  const highPriorityCount = diagnosticsBuffer.filter(data => data.processingPriority === 'high').length;
  
  return {
    avgProcessTime: totalTime / diagnosticsBuffer.length,
    avgSignalStrength: totalStrength / diagnosticsBuffer.length,
    highPriorityPercentage: (highPriorityCount / diagnosticsBuffer.length) * 100
  };
}
