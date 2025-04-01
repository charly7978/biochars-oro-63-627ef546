
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for checking signal quality and weak signals
 * VERSIÓN MEJORADA: Mucho más sensible a señales débiles
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
const REQUIRED_STABLE_FRAMES = 8; // REDUCIDO para confirmar detección más rápido

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 150; // Maximum time gap allowed between processing

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * VERSIÓN MEJORADA: Mucho más sensible a señales débiles
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
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 6 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 6000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 10) {
    const values = signalHistory.slice(-10).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    signalVariance = values.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / values.length;
    
    // Check if variance is within physiological range - CRITERIOS MÁS PERMISIVOS
    const isPhysiological = signalVariance > 0.0001 && signalVariance < 0.5; // MUCHO más permisivo
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Diagnóstico de señal fisiológica débil
      if (Math.abs(value) < 0.02 && signalVariance < 0.01) {
        console.log("Signal quality: Señal DÉBIL pero FISIOLÓGICA detectada", {
          valor: value,
          varianza: signalVariance,
          cuadrosEstables: consecutiveStableFrames
        });
      }
    } else {
      consecutiveStableFrames = 0;
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed) {
        console.log("ALERTA: Señal no fisiológica detectada - reiniciando detección", { 
          variance: signalVariance,
          isLowVariance: signalVariance <= 0.0001,
          isHighVariance: signalVariance >= 0.5
        });
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Check for rhythmic patterns only if we have enough stable frames
  // This prevents false detections from random noise
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && !fingDetectionConfirmed) {
    const patternResult = isFingerDetectedByPattern(signalHistory, patternDetectionCount);
    patternDetectionCount = patternResult.patternCount;
    
    // Only confirm finger if we have consistently detected patterns
    if (patternResult.isFingerDetected) {
      fingDetectionConfirmed = true;
      console.log("Dedo detectado mediante patrón rítmico después de validación fisiológica", {
        time: new Date(now).toISOString(),
        variance: signalVariance,
        stableFrames: consecutiveStableFrames
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Use MUCH lower thresholds to increase sensitivity - UMBRALES MUCHO MÁS BAJOS
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.012, // Reducido drásticamente
    maxWeakSignalCount: config.maxWeakSignalCount || 8     // Aumentado para mayor estabilidad
  };
  
  // If finger detection was previously confirmed but we have many consecutive weak signals,
  // we should reset the finger detection status
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 1.5) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    console.log("ALERTA: Detección de dedo perdida por señales débiles consecutivas:", consecutiveWeakSignalsCount);
  }
  
  // Verificación manual de señal débil para mayor transparencia
  const isVeryWeakSignal = Math.abs(value) < finalConfig.lowSignalThreshold;
  
  if (isVeryWeakSignal) {
    const updatedCount = consecutiveWeakSignalsCount + 1;
    const isWeak = updatedCount >= finalConfig.maxWeakSignalCount;
    
    if (isWeak) {
      console.log("ALERTA: Señal MUY débil detectada", {
        valor: value,
        umbral: finalConfig.lowSignalThreshold,
        cuentaDebiles: updatedCount,
        consideradaDebil: isWeak
      });
    }
    
    return {
      isWeakSignal: isWeak,
      updatedWeakSignalsCount: updatedCount
    };
  } else {
    return {
      isWeakSignal: false,
      updatedWeakSignalsCount: Math.max(0, consecutiveWeakSignalsCount - 1) // Reducción gradual
    };
  }
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
  console.log("Estado de calidad de señal reiniciado, incluyendo detección de patrones");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 */
export function isFingerDetected(): boolean {
  return fingDetectionConfirmed || (patternDetectionCount >= 2 && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * VERSIÓN MEJORADA: Umbrales mucho más bajos para mejor sensibilidad
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES) {
    return Math.abs(value) >= 0.006; // Umbral drásticamente reducido
  }
  
  // Higher threshold if pattern not confirmed, but still much lower than before
  return Math.abs(value) >= 0.012; // Umbral drásticamente reducido
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
