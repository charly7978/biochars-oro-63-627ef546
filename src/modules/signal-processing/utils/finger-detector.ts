
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de dedo
 */

import { calculateVariance } from './signal-normalizer';

// Variables de estado global para tracking de señal
let consecutiveWeakSignalsCount = 0;
const MIN_SIGNAL_STRENGTH = 0.15; // AUMENTADO considerablemente el umbral mínimo para señal válida
const MAX_WEAK_SIGNALS = 3; // Reducido para detección más rápida de problemas

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
      console.log("ALERTA: Señal EXTREMADAMENTE DÉBIL/ANÉMICA para detección válida", {
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
    // Señal fuerte, resetear contador
    consecutiveWeakSignalsCount = Math.max(0, consecutiveWeakSignalsCount - 1);
  }
  
  // Criterios combinados para la detección de dedo - REQUIERE MAYOR AMPLITUD
  const hasAmplitude = amplitude >= sensitivity * 0.1; // Duplicado el requerimiento
  const hasReasonableVariance = variance < 0.15 && variance > 0.0001;
  
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
  
  // Verificar señal anémica - PENALIZACIÓN MUCHO MÁS SEVERA
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    confidence *= 0.2; // Penalizar MUY fuertemente señales muy débiles
    console.log("Confianza severamente reducida por señal anémica", {
      amplitud: amplitude,
      umbralMínimo: MIN_SIGNAL_STRENGTH,
      confianzaOriginal: quality / 100,
      confianzaReducida: confidence
    });
  } else if (amplitude < 0.01) {
    confidence *= 0.4; // Penalización más fuerte
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
