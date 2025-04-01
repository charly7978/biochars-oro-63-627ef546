
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
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
 * Now with improved prioritization based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Añadir diagnóstico sobre decisión de procesamiento
  const signalStrength = Math.abs(value);
  const processingDecision = signalStrength >= 0.008;
  
  // Determinar prioridad basada en la fuerza de la señal
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (signalStrength >= 0.05) {
    priority = 'high';
  } else if (signalStrength >= 0.02) {
    priority = 'medium';
  }
  
  // Registrar diagnóstico
  addDiagnosticsData({
    timestamp: Date.now(),
    processTime: 0,
    signalStrength,
    processorLoad: 0,
    dataPointsProcessed: 1,
    peakDetectionConfidence: processingDecision ? signalStrength * 10 : 0,
    processingPriority: priority
  });
  
  // Umbral más sensible para capturar señales reales mientras filtra ruido
  return processingDecision; // Reducido aún más para mayor sensibilidad
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 * Now includes diagnostics and priority information
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  // Registrar evento de señal débil en diagnósticos
  addDiagnosticsData({
    timestamp: Date.now(),
    processTime: 0,
    signalStrength: 0.005, // Valor bajo característico
    processorLoad: 0,
    dataPointsProcessed: 1,
    peakDetectionConfidence: 0,
    processingPriority: 'low'
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
 * Now with priority-based processing and diagnostics
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
  
  // Determinar prioridad basada en la confianza del resultado
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (result.confidence > 0.5) {
    priority = 'high';
  } else if (result.confidence > 0.2) {
    priority = 'medium';
  }
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.05) {
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // Elevar la prioridad si se detecta un pico
    priority = 'high';
    
    // EL BEEP SOLO SE MANEJA EN PPGSignalMeter CUANDO SE DIBUJA UN CÍRCULO
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      // Log transition state if present
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false,
      prioridad: priority
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
