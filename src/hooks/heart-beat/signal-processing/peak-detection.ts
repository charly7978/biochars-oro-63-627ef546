
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 * Enhanced with improved algorithms for more accurate heartbeat detection
 */

// Configuración optimizada para detección de picos PPG
const PEAK_CONFIG = {
  // Valores fisiológicos de HR: [40, 200] BPM
  MIN_PEAK_DISTANCE_MS: 300, // Distancia mínima entre picos (300ms = 200 BPM máx)
  MAX_PEAK_DISTANCE_MS: 1500, // Distancia máxima entre picos (1500ms = 40 BPM mín)
  DETECTION_WINDOW: 8,        // Ventana para detección de picos locales
  THRESHOLD_FACTOR: 0.6,      // Factor para umbral adaptativo
  MIN_PEAK_HEIGHT: 0.012,     // Altura mínima de pico para considerarse válido
  EDGE_IGNORE: 2              // Ignorar muestras en los bordes para evitar falsos positivos
};

// Historial de valores para cálculos adaptativos
let valueHistory: number[] = [];
const VALUE_HISTORY_SIZE = 50;
let lastValidPeaks: {time: number, value: number}[] = [];
const MAX_VALID_PEAKS = 8;
let adaptiveThreshold = 0.025;
let lastPeakValue = 0;

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements
 * Mejorado con umbral adaptativo
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Mantener historial para umbral adaptativo
  valueHistory.push(Math.abs(value));
  if (valueHistory.length > VALUE_HISTORY_SIZE) {
    valueHistory.shift();
  }
  
  // Calcular umbral adaptativo si hay suficiente historial
  if (valueHistory.length > 10) {
    const sortedValues = [...valueHistory].sort((a, b) => a - b);
    const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    
    // Umbral más sensible pero adaptativo al ruido actual
    adaptiveThreshold = Math.max(0.008, q1 * 0.5);
  }
  
  // Evaluar señal contra umbral adaptativo
  return Math.abs(value) >= adaptiveThreshold;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
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
    }
  };
}

/**
 * Enhanced peak detection algorithm based on derivative techniques
 * Implementación inspirada en algoritmo Pan-Tompkins adaptado a señales PPG
 */
export function detectPeak(
  value: number,
  recentValues: number[],
  timeSinceLastPeak: number
): { isPeak: boolean, confidence: number } {
  if (recentValues.length < PEAK_CONFIG.DETECTION_WINDOW + 4) {
    return { isPeak: false, confidence: 0 };
  }
  
  // No evaluar picos si no ha pasado tiempo suficiente desde el último
  if (timeSinceLastPeak < PEAK_CONFIG.MIN_PEAK_DISTANCE_MS) {
    return { isPeak: false, confidence: 0 };
  }
  
  // Calcular la primera derivada (pendiente)
  const derivatives: number[] = [];
  for (let i = 1; i < recentValues.length; i++) {
    derivatives.push(recentValues[i] - recentValues[i-1]);
  }
  
  // Calcular la segunda derivada para detectar puntos de inflexión
  const secondDerivatives: number[] = [];
  for (let i = 1; i < derivatives.length; i++) {
    secondDerivatives.push(derivatives[i] - derivatives[i-1]);
  }
  
  // Estimar posición actual en la ventana
  const currentIndex = recentValues.length - 1;
  
  // Un pico PPG se caracteriza por:
  // 1. La primera derivada cambia de positiva a negativa (pendiente de subida a bajada)
  // 2. La segunda derivada es negativa en el pico (curvatura hacia abajo)
  
  const isPositiveSlope = derivatives[currentIndex-2] > 0;
  const isNegativeSlope = derivatives[currentIndex-1] < 0;
  const isNegativeCurvature = secondDerivatives[currentIndex-2] < 0;
  
  // Altura suficiente sobre la línea base
  const recentMean = recentValues.slice(-10).reduce((sum, v) => sum + v, 0) / 10;
  const peakHeight = value - recentMean;
  
  // Verificación de máximo local (más alto que los puntos cercanos)
  let isLocalMaximum = true;
  for (let i = 1; i <= PEAK_CONFIG.DETECTION_WINDOW; i++) {
    // Solo comprobar hasta donde tenemos datos
    if (currentIndex - i >= 0 && recentValues[currentIndex - i] >= value) {
      isLocalMaximum = false;
      break;
    }
  }
  
  // Validez fisiológica - debe haber una pendiente significativa
  const significantRise = Math.max(...derivatives.slice(-5)) > adaptiveThreshold * 1.5;
  
  // Combinación de criterios para detección de pico
  const isPeak = isPositiveSlope && 
                 isNegativeSlope && 
                 isNegativeCurvature && 
                 isLocalMaximum && 
                 peakHeight > PEAK_CONFIG.MIN_PEAK_HEIGHT &&
                 significantRise;
  
  // Calcular confianza basada en las características del pico
  let confidence = 0;
  if (isPeak) {
    // Factores de confianza:
    const heightFactor = Math.min(1, peakHeight / (PEAK_CONFIG.MIN_PEAK_HEIGHT * 3));
    const timingFactor = timeSinceLastPeak > PEAK_CONFIG.MIN_PEAK_DISTANCE_MS ? 
      Math.min(1, Math.max(0, (PEAK_CONFIG.MAX_PEAK_DISTANCE_MS - timeSinceLastPeak) / PEAK_CONFIG.MAX_PEAK_DISTANCE_MS)) : 0;
    const curvatureFactor = Math.min(1, Math.abs(secondDerivatives[currentIndex-2]) / 0.01);
    
    // Combinar factores con diferentes pesos
    confidence = (heightFactor * 0.5) + (timingFactor * 0.3) + (curvatureFactor * 0.2);
    
    // Registrar pico válido para cálculos futuros
    if (confidence > 0.4) {
      lastValidPeaks.push({time: Date.now(), value});
      if (lastValidPeaks.length > MAX_VALID_PEAKS) {
        lastValidPeaks.shift();
      }
      lastPeakValue = value;
    }
  }
  
  return { isPeak, confidence };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.05) {
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
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
      adaptiveThreshold
    });
  }
}

/**
 * Resetea el estado interno del detector de picos
 */
export function resetPeakDetector(): void {
  valueHistory = [];
  lastValidPeaks = [];
  adaptiveThreshold = 0.025;
  lastPeakValue = 0;
}
