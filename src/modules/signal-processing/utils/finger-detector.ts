
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de dedo
 */

import { calculateVariance } from './signal-normalizer';

// Variables de estado global para tracking de señal
let consecutiveWeakSignalsCount = 0;
const MIN_SIGNAL_STRENGTH = 0.08; // REDUCIDO para detectar señales más débiles
const MAX_WEAK_SIGNALS = 5; // Aumentado para mayor estabilidad

/**
 * Detecta la presencia de un dedo en la señal PPG
 * Más sensible a señales débiles
 */
export function detectFingerPresence(
  buffer: number[],
  sensitivity: number = 0.6
): boolean {
  if (buffer.length < 10) return false;
  
  // Amplitud como medida principal
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const amplitude = max - min;
  
  // Varianza como medida secundaria
  const variance = calculateVariance(buffer);
  
  // Verificar señal anémica (demasiado débil)
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    consecutiveWeakSignalsCount++;
    
    // Si hay demasiadas señales débiles consecutivas, no hay dedo
    if (consecutiveWeakSignalsCount > MAX_WEAK_SIGNALS) {
      console.log("ALERTA: Señal débil para detección válida", {
        amplitude,
        min,
        max,
        variance,
        consecutiveWeakSignals: consecutiveWeakSignalsCount,
        threshold: MIN_SIGNAL_STRENGTH
      });
      return false;
    }
  } else {
    // Señal fuerte, resetear contador más rápidamente
    consecutiveWeakSignalsCount = Math.max(0, consecutiveWeakSignalsCount - 2);
  }
  
  // Criterios combinados para la detección de dedo - MÁS SENSIBLE
  const hasAmplitude = amplitude >= sensitivity * 0.08; // Reducido el requerimiento
  const hasReasonableVariance = variance < 0.20 && variance > 0.00005; // Más permisivo
  
  // Diagnóstico para señales débiles pero detectables
  if (hasAmplitude && hasReasonableVariance && amplitude < MIN_SIGNAL_STRENGTH * 2) {
    console.log("Finger-detector: Señal DÉBIL pero DETECTABLE", {
      amplitud: amplitude,
      varianza: variance,
      umbralMínimo: MIN_SIGNAL_STRENGTH,
      señalesDebilesSeguidas: consecutiveWeakSignalsCount
    });
  }
  
  return hasAmplitude && hasReasonableVariance;
}

/**
 * Evalúa la confianza de la detección de dedo
 * Incorpora verificación de fuerza mínima de señal
 */
export function evaluateFingerDetectionConfidence(
  buffer: number[],
  quality: number
): number {
  if (buffer.length < 5) return 0;
  
  // La confianza aumenta con la calidad de la señal
  let confidence = quality / 100;
  
  // La amplitud debe ser suficiente
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const amplitude = max - min;
  
  // Verificar señal - PENALIZACIÓN MENOS SEVERA para señales débiles
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    confidence *= 0.4; // Penalizar menos para detectar señales débiles
    console.log("Confianza reducida por señal débil", {
      amplitud: amplitude,
      umbralMínimo: MIN_SIGNAL_STRENGTH,
      confianzaOriginal: quality / 100,
      confianzaReducida: confidence
    });
  } else if (amplitude < MIN_SIGNAL_STRENGTH * 2) {
    confidence *= 0.6; // Penalización moderada
  } else if (amplitude > MIN_SIGNAL_STRENGTH * 4) {
    confidence *= 1.2; // Bonificación para señales fuertes
  }
  
  // La varianza debe ser razonable (ni muy baja ni muy alta)
  const variance = calculateVariance(buffer);
  
  if (variance < 0.00005 || variance > 0.15) {
    confidence *= 0.7;
  }
  
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Resetear detector de dedo
 * Incluye reseteo de contador de señales débiles
 */
export function resetFingerDetector() {
  consecutiveWeakSignalsCount = 0;
  console.log("Detector de dedo reiniciado, contador de señales débiles reseteado");
}
