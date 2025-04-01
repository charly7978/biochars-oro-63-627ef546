/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for checking signal quality and weak signals
 * Improved to reduce false positives and add rhythmic pattern detection
 */
import { checkSignalQuality, isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let signalPeriodicity = 0;
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 12; // Must have physiologically stable signal for this many frames

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 150; // Maximum time gap allowed between processing

// Parameters for enhanced finger detection
const PHYSIOLOGICAL_MIN_VARIANCE = 0.005;  // Mínima varianza de señal cardíaca real
const PHYSIOLOGICAL_MAX_VARIANCE = 0.8;    // Máxima varianza de señal cardíaca real
const MIN_PERIODICITY_SCORE = 0.3;         // Mínima periodicidad para considerar señal válida
const PATTERN_CONFIRMATION_THRESHOLD = 5;  // Número de detecciones de patrón para confirmar

/**
 * Analiza la periodicidad de la señal para validar detección de dedo
 * Basado en autocorrelación simplificada
 */
function analyzeSignalPeriodicity(values: Array<{time: number, value: number}>): number {
  if (values.length < 30) return 0;
  
  // Extraer solo los valores más recientes
  const recentValues = values.slice(-30).map(v => v.value);
  const n = recentValues.length;
  
  // Simplificado pero efectivo: buscar similitudes en la señal a diferentes delays
  let maxCorrelation = 0;
  
  // Probar diferentes retrasos correspondientes a rangos de HR fisiológicos
  // (40-180 BPM → ~330-1500ms → ~10-45 muestras a 30Hz)
  for (let delay = 10; delay <= 45; delay++) {
    let correlation = 0;
    let validPairs = 0;
    
    for (let i = 0; i < n - delay; i++) {
      correlation += recentValues[i] * recentValues[i + delay];
      validPairs++;
    }
    
    if (validPairs > 0) {
      correlation /= validPairs;
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
      }
    }
  }
  
  // Normalizar a un score de 0-1
  return Math.min(1, Math.max(0, maxCorrelation));
}

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * Now incorporates rhythmic pattern detection for more accurate finger detection
 * Improved with higher thresholds to reduce false positives
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  // Track signal history
  const now = Date.now();
  
  // Check for large time gaps which indicate processing interruption (finger removed)
  if (lastProcessTime > 0) {
    const timeDiff = now - lastProcessTime;
    if (timeDiff > MAX_ALLOWED_GAP_MS) {
      console.log(`Signal quality: Large processing gap detected (${timeDiff}ms) - resetting detection`);
      signalHistory = [];
      patternDetectionCount = 0;
      fingDetectionConfirmed = false;
      consecutiveStableFrames = 0;
      signalPeriodicity = 0;
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 6 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 6000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 15) {
    // Calcular estadísticos más robustos
    const values = signalHistory.slice(-15).map(p => p.value);
    
    // Media robusta (mediana)
    values.sort((a, b) => a - b);
    signalMean = values[Math.floor(values.length/2)];
    
    // Varianza robusta
    signalVariance = values.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / values.length;
    
    // Analizar periodicidad de la señal - característica clave de señal cardíaca
    signalPeriodicity = analyzeSignalPeriodicity(signalHistory);
    
    // Verificar que la varianza y periodicidad estén en rangos fisiológicos
    const isPhysiological = 
      signalVariance >= PHYSIOLOGICAL_MIN_VARIANCE && 
      signalVariance <= PHYSIOLOGICAL_MAX_VARIANCE &&
      signalPeriodicity >= MIN_PERIODICITY_SCORE;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Si acumulamos suficientes frames estables con buena periodicidad, confirmar detección
      if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && !fingDetectionConfirmed) {
        patternDetectionCount++;
        
        if (patternDetectionCount >= PATTERN_CONFIRMATION_THRESHOLD) {
          fingDetectionConfirmed = true;
          console.log("Finger detection CONFIRMED by physiological pattern analysis!", {
            time: new Date(now).toISOString(),
            variance: signalVariance,
            periodicity: signalPeriodicity,
            stableFrames: consecutiveStableFrames
          });
        }
      }
    } else {
      // Reducción gradual para evitar fluctuaciones rápidas
      consecutiveStableFrames = Math.max(0, consecutiveStableFrames - 2);
      
      // Si la señal deja de ser fisiológica por mucho tiempo, reiniciar detección
      if (consecutiveStableFrames < REQUIRED_STABLE_FRAMES/3 && fingDetectionConfirmed) {
        console.log("Non-physiological signal detected - degrading finger detection confidence", { 
          variance: signalVariance,
          periodicity: signalPeriodicity,
          stableFrames: consecutiveStableFrames
        });
        
        // Degradación gradual en vez de reinicio completo
        patternDetectionCount = Math.max(0, patternDetectionCount - 1);
        
        if (patternDetectionCount === 0) {
          fingDetectionConfirmed = false;
          console.log("Finger detection lost due to sustained non-physiological signal");
        }
      }
    }
  }
  
  // Si el dedo se ha confirmado por análisis de patrón, retornar señal fuerte
  if (fingDetectionConfirmed) {
    return {
      isWeakSignal: false,
      updatedWeakSignalsCount: 0
    };
  }
  
  // Use higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.35, // Aumentado para mayor robustez
    maxWeakSignalCount: config.maxWeakSignalCount || 8    // Aumentado para mayor estabilidad
  };
  
  // Llamada a la función original pero con mejores valores
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
  
  // Añadimos protección contra falsas detecciones
  if (!result.isWeakSignal && patternDetectionCount === 0) {
    // Requiere verificación adicional si nunca hemos detectado un patrón
    return {
      isWeakSignal: true,
      updatedWeakSignalsCount: Math.min(result.updatedWeakSignalsCount + 1, finalConfig.maxWeakSignalCount)
    };
  }
  
  return result;
}

/**
 * Reset signal quality detection state
 * Also resets finger pattern detection
 */
export function resetSignalQualityState() {
  signalHistory = [];
  patternDetectionCount = 0;
  fingDetectionConfirmed = false;
  signalMean = 0;
  signalVariance = 0;
  signalPeriodicity = 0;
  consecutiveStableFrames = 0;
  lastProcessTime = 0;
  console.log("Signal quality state reset, including enhanced pattern detection");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 */
export function isFingerDetected(): boolean {
  // Uso de criterios múltiples para mayor robustez
  return fingDetectionConfirmed || 
         (patternDetectionCount >= PATTERN_CONFIRMATION_THRESHOLD/2 && 
          consecutiveStableFrames >= REQUIRED_STABLE_FRAMES * 0.7 &&
          signalPeriodicity >= MIN_PERIODICITY_SCORE * 1.2);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Si la detección de dedo está confirmada, usar umbral más bajo
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES/2) {
    return Math.abs(value) >= 0.15; // Umbral reducido para dedos confirmados
  }
  
  // Verificación progresiva basada en confianza de detección
  if (patternDetectionCount >= PATTERN_CONFIRMATION_THRESHOLD/2 && signalPeriodicity >= MIN_PERIODICITY_SCORE) {
    return Math.abs(value) >= 0.25; // Umbral intermedio para detectores en proceso de confirmación
  }
  
  // Umbral alto para evitar falsos positivos en señales débiles o ruidosas
  return Math.abs(value) >= 0.35; // Incrementado desde 0.30
}

/**
 * Creates default signal processing result when signal is too weak
 * Keeps compatibility with existing code
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
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Devuelve información de debug sobre la calidad de señal
 */
export function getSignalQualityDebugInfo() {
  return {
    fingDetectionConfirmed,
    patternDetectionCount,
    consecutiveStableFrames,
    signalMean,
    signalVariance,
    signalPeriodicity,
    historyLength: signalHistory.length,
    thresholds: {
      minVariance: PHYSIOLOGICAL_MIN_VARIANCE,
      maxVariance: PHYSIOLOGICAL_MAX_VARIANCE,
      minPeriodicity: MIN_PERIODICITY_SCORE,
      requiredStableFrames: REQUIRED_STABLE_FRAMES,
      patternConfirmation: PATTERN_CONFIRMATION_THRESHOLD
    }
  };
}
