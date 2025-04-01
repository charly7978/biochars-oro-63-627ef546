
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de dedo
 */

import { calculateVariance } from './signal-normalizer';

// Variables de estado global para tracking de señal
let consecutiveWeakSignalsCount = 0;
const MIN_SIGNAL_STRENGTH = 0.08; // Aumentado el umbral mínimo para señal válida
const MAX_WEAK_SIGNALS = 4; 

/**
 * Detecta la presencia de un dedo en la señal PPG
 * Requiere señales más fuertes para considerarse válido
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
      console.log("Señal demasiado débil/anémica para detección válida", {
        amplitude,
        min,
        max,
        variance,
        consecutiveWeakSignals: consecutiveWeakSignalsCount
      });
      return false;
    }
  } else {
    // Señal fuerte, resetear contador
    consecutiveWeakSignalsCount = Math.max(0, consecutiveWeakSignalsCount - 1);
  }
  
  // Criterios combinados para la detección de dedo
  const hasAmplitude = amplitude >= sensitivity * 0.05;
  const hasReasonableVariance = variance < 0.1 && variance > 0.0001;
  
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
  
  // Verificar señal anémica
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    confidence *= 0.3; // Penalizar fuertemente señales muy débiles
  } else if (amplitude < 0.01) {
    confidence *= 0.5;
  } else if (amplitude > 0.05) {
    confidence *= 1.2;
  }
  
  // La varianza debe ser razonable (ni muy baja ni muy alta)
  const variance = calculateVariance(buffer);
  
  if (variance < 0.0001 || variance > 0.1) {
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
