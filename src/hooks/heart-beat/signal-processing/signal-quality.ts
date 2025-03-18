/**
 * Functions for checking signal quality and weak signals
 * Implementación drásticamente mejorada para eliminar falsos positivos
 */
import { checkSignalQuality, isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 30; // Drásticamente aumentado (era 15)

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 100; // Reducido de 150 - más estricto

// New: Requerir mayor cantidad de tiempo con señal válida
let validSignalStartTime = 0;
const MINIMUM_VALID_TIME_MS = 1500; // Requiere 1.5 segundos de señal consistente

/**
 * Verifica si la señal es demasiado débil para ser un dedo real
 * Umbrales drásticamente incrementados para evitar falsos positivos
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
      validSignalStartTime = 0;
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 4 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 4000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 15) { // Aumentado de 10
    const values = signalHistory.slice(-15).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    signalVariance = values.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / values.length;
    
    // Verificación fisiológica mucho más estricta
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    
    // Requiere un rango mínimo para ser fisiológicamente válido (corazón real)
    const hasValidRange = range > 0.35; // Requiere amplitud significativa
    
    // Calcular derivadas para detectar oscilaciones cardíacas
    const derivatives = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    // Contar cambios de signo (oscilaciones)
    let signChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) ||
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Requiere oscilaciones como un latido cardíaco real
    const hasValidOscillations = signChanges >= 4; // Aumentado de 3
    
    // Verificación de rango de varianza fisiológica
    // Un corazón real tiene una varianza característica
    const hasValidVariance = signalVariance > 0.025 && signalVariance < 0.6;
    
    // Solo incrementar contador si TODAS las verificaciones pasan
    const isPhysiological = hasValidRange && hasValidOscillations && hasValidVariance;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Iniciar temporizador de tiempo mínimo si es el primer frame estable
      if (consecutiveStableFrames === 1) {
        validSignalStartTime = now;
      }
      
    } else {
      consecutiveStableFrames = 0;
      validSignalStartTime = 0;
      
      // Si habíamos confirmado detección pero la señal ya no es fisiológica, resetear
      if (fingDetectionConfirmed) {
        console.log("Non-physiological signal detected - resetting finger detection", { 
          variance: signalVariance,
          range: range,
          oscillations: signChanges
        });
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Verificar si ha pasado suficiente tiempo con señales estables
  const hasMinimumValidTime = validSignalStartTime > 0 && (now - validSignalStartTime) >= MINIMUM_VALID_TIME_MS;
  
  // Verificar patrones rítmicos solo si tenemos suficientes frames estables Y tiempo mínimo
  // Esto previene detecciones falsas de ruido aleatorio
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && 
      hasMinimumValidTime && 
      !fingDetectionConfirmed) {
    
    const patternResult = isFingerDetectedByPattern(signalHistory, patternDetectionCount);
    patternDetectionCount = patternResult.patternCount;
    
    // Confirmar detección de dedo solo si consistentemente hemos detectado patrones
    if (patternResult.isFingerDetected) {
      fingDetectionConfirmed = true;
      console.log("Finger detected by rhythmic pattern after strict physiological validation!", {
        time: new Date(now).toISOString(),
        variance: signalVariance,
        stableFrames: consecutiveStableFrames,
        validTime: now - validSignalStartTime,
        oscillations: "verified"
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Usar umbrales mucho más altos si no se especifican
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.45, // Drásticamente aumentado
    maxWeakSignalCount: config.maxWeakSignalCount || 4    
  };
  
  // Si la detección de dedo fue confirmada previamente pero tenemos muchas señales débiles consecutivas,
  // deberíamos resetear el estado de detección de dedo
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 1.5) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    validSignalStartTime = 0;
    console.log("Finger detection lost due to consecutive weak signals:", consecutiveWeakSignalsCount);
  }
  
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
  
  // Si hay dedo confirmado pero la señal es débil, damos beneficio de la duda por más tiempo
  if (fingDetectionConfirmed && result.isWeakSignal) {
    // Mayor tolerancia para detección de dedo confirmada
    return {
      isWeakSignal: result.updatedWeakSignalsCount >= finalConfig.maxWeakSignalCount * 1.5,
      updatedWeakSignalsCount: result.updatedWeakSignalsCount
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
  consecutiveStableFrames = 0;
  lastProcessTime = 0;
  validSignalStartTime = 0;
  console.log("Signal quality state reset, including pattern detection");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 * Ahora usa umbrales mucho más estrictos
 */
export function isFingerDetected(): boolean {
  // Requiere confirmación explícita y alto número de frames estables
  return fingDetectionConfirmed && (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses MUCH higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Si la detección de dedo está confirmada por patrón, permitir procesamiento incluso si la señal es ligeramente débil
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES) {
    return Math.abs(value) >= 0.28; // Umbral más alto incluso con dedo confirmado
  }
  
  // Umbral mucho más alto para evitar procesar señales débiles (probablemente ruido)
  return Math.abs(value) >= 0.45; // Drásticamente aumentado
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
    }
  };
}
