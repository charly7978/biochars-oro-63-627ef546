
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de dedo
 * VERSIÓN ULTRA-SENSIBLE: Especializada para señales extremadamente débiles
 */

import { calculateVariance, applyAdaptiveLowPassFilter, correctOutliers } from './signal-normalizer';

// Variables de estado global para tracking de señal
let consecutiveWeakSignalsCount = 0;
// Umbrales EXTREMADAMENTE reducidos para detectar hasta las señales más débiles
const MIN_SIGNAL_STRENGTH = 0.003; // ULTRA-REDUCIDO para detectar señales extremadamente débiles
const MAX_WEAK_SIGNALS = 8; // Aumentado para mayor estabilidad con señales variables

// Nuevas variables para detección de patrones en señales débiles
let signalPatternBuffer: number[] = [];
let lastPatternTime = 0;
let patternDetectionConfidence = 0;
const PATTERN_BUFFER_SIZE = 30; // 1 segundo a 30fps
const MIN_PATTERN_CONFIDENCE = 0.15; // Umbral bajo para detectar patrones débiles

/**
 * Detecta la presencia de un dedo en la señal PPG
 * ULTRA-SENSIBLE a señales extremadamente débiles
 */
export function detectFingerPresence(
  buffer: number[],
  sensitivity: number = 0.3 // Reducido para aumentar sensibilidad
): boolean {
  if (buffer.length < 5) return false;
  
  // Pre-procesamiento especial para señales débiles
  const processedBuffer = preprocessWeakSignalBuffer(buffer);
  
  // Amplitud como medida principal pero con umbral MUY reducido
  const min = Math.min(...processedBuffer);
  const max = Math.max(...processedBuffer);
  const amplitude = max - min;
  
  // Varianza como medida secundaria - más sensible a microvariaciones
  const variance = calculateVariance(processedBuffer);
  
  // Detección de patrones para señales extremadamente débiles
  const hasPattern = detectPatternInWeakSignal(processedBuffer);
  
  // Verificar señal anémica (demasiado débil)
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    consecutiveWeakSignalsCount++;
    
    // Aunque sea débil, si detectamos patrón, podría ser un dedo
    if (hasPattern && patternDetectionConfidence > MIN_PATTERN_CONFIDENCE * 2) {
      console.log("Finger-detector: Señal EXTREMADAMENTE DÉBIL pero con PATRÓN DETECTADO", {
        amplitude,
        patternConfidence: patternDetectionConfidence,
        consecutiveWeakSignals: consecutiveWeakSignalsCount
      });
      
      // Reiniciar contador parcialmente para estabilizar detección
      consecutiveWeakSignalsCount = Math.max(0, consecutiveWeakSignalsCount - 2);
      return true;
    }
    
    // Si hay demasiadas señales débiles consecutivas, no hay dedo
    if (consecutiveWeakSignalsCount > MAX_WEAK_SIGNALS) {
      console.log("Finger-detector: Señal demasiado débil para detección válida", {
        amplitude,
        min,
        max,
        variance,
        consecutiveWeakSignals: consecutiveWeakSignalsCount,
        threshold: MIN_SIGNAL_STRENGTH,
        patternConfidence: patternDetectionConfidence
      });
      return false;
    }
  } else {
    // Señal fuerte, resetear contador más rápidamente
    consecutiveWeakSignalsCount = Math.max(0, consecutiveWeakSignalsCount - 2);
  }
  
  // Criterios combinados para detección de dedo - EXTREMADAMENTE SENSIBLE
  // Umbrales drásticamente reducidos para captar señales ultra débiles
  const hasAmplitude = amplitude >= sensitivity * 0.03; // Umbral ultra reducido
  const hasReasonableVariance = variance < 0.25 && variance > 0.00001; // Mucho más permisivo
  
  // Incluir detección de patrones en la decisión
  const fingerDetected = (hasAmplitude && hasReasonableVariance) || 
                        (hasPattern && patternDetectionConfidence > MIN_PATTERN_CONFIDENCE);
  
  // Diagnóstico para señales débiles pero detectables
  if (fingerDetected) {
    if (amplitude < MIN_SIGNAL_STRENGTH * 3) {
      console.log("Finger-detector: Señal ULTRA-DÉBIL pero DETECTABLE", {
        amplitud: amplitude,
        varianza: variance,
        umbralMínimo: MIN_SIGNAL_STRENGTH,
        señalesDebilesSeguidas: consecutiveWeakSignalsCount,
        tienePatrón: hasPattern,
        confianzaPatrón: patternDetectionConfidence
      });
    }
  } else if (patternDetectionConfidence > 0) {
    // Incluso sin confirmación, registrar progreso de detección de patrones
    console.log("Finger-detector: Patrón fisiológico en desarrollo", {
      amplitud: amplitude,
      confianzaPatrón: patternDetectionConfidence,
      umbralConfianza: MIN_PATTERN_CONFIDENCE
    });
  }
  
  return fingerDetected;
}

/**
 * Pre-procesa un buffer de señal débil para mejorar detección
 * NUEVO: Especialmente para señales extremadamente débiles
 */
function preprocessWeakSignalBuffer(buffer: number[]): number[] {
  // Clonar buffer para no modificar original
  const processedBuffer = [...buffer];
  
  // Aplicar corrección de outliers
  for (let i = 0; i < processedBuffer.length; i++) {
    if (i > 0) {
      // Corregir outliers con ventana de histórico
      processedBuffer[i] = correctOutliers(
        processedBuffer[i], 
        processedBuffer.slice(0, i)
      );
      
      // Aplicar filtro adaptativo de paso bajo
      processedBuffer[i] = applyAdaptiveLowPassFilter(
        processedBuffer[i],
        processedBuffer.slice(0, i)
      );
    }
  }
  
  return processedBuffer;
}

/**
 * Detecta patrones característicos en señales extremadamente débiles
 * NUEVO: Usa análisis de periodicidad para detectar latidos en señales casi imperceptibles
 */
function detectPatternInWeakSignal(buffer: number[]): boolean {
  // Actualizar buffer de patrones
  const now = Date.now();
  
  // Reiniciar detección si ha pasado demasiado tiempo
  if (now - lastPatternTime > 2000) {
    signalPatternBuffer = [];
    patternDetectionConfidence = 0;
  }
  
  lastPatternTime = now;
  
  // Añadir último valor al buffer de patrones
  if (buffer.length > 0) {
    signalPatternBuffer.push(buffer[buffer.length - 1]);
    
    // Mantener buffer de tamaño fijo
    if (signalPatternBuffer.length > PATTERN_BUFFER_SIZE) {
      signalPatternBuffer.shift();
    }
  }
  
  // Necesitamos suficientes muestras para análisis
  if (signalPatternBuffer.length < PATTERN_BUFFER_SIZE * 0.8) {
    return false;
  }
  
  // Análisis de autocorrelación básica para detectar periodicidad
  // Este es un enfoque simplificado para detectar patrones repetitivos
  let maxCorrelation = 0;
  
  // Buscar patrones en diferentes periodos (40-180 BPM ~ 10-30 muestras a 30fps)
  for (let period = 10; period <= 30; period++) {
    let correlation = 0;
    let count = 0;
    
    // Calcular correlación para este periodo
    for (let i = period; i < signalPatternBuffer.length; i++) {
      correlation += signalPatternBuffer[i] * signalPatternBuffer[i - period];
      count++;
    }
    
    // Normalizar correlación
    if (count > 0) {
      correlation /= count;
      maxCorrelation = Math.max(maxCorrelation, correlation);
    }
  }
  
  // Actualizar confianza de detección de patrón
  // Usar alpha pequeño para cambios graduales
  const alpha = 0.1;
  patternDetectionConfidence = 
    (1 - alpha) * patternDetectionConfidence + alpha * Math.abs(maxCorrelation);
  
  // Umbral extremadamente bajo para señales ultra débiles
  return patternDetectionConfidence > MIN_PATTERN_CONFIDENCE;
}

/**
 * Evalúa la confianza de la detección de dedo
 * ULTRA-SENSIBLE: Incorpora múltiples factores para aumentar sensibilidad
 */
export function evaluateFingerDetectionConfidence(
  buffer: number[],
  quality: number
): number {
  if (buffer.length < 5) return 0;
  
  // Pre-procesar buffer para mejor análisis
  const processedBuffer = preprocessWeakSignalBuffer(buffer);
  
  // La confianza base aumenta con la calidad de la señal
  let confidence = quality / 100;
  
  // La amplitud debe ser suficiente - UMBRAL ULTRA BAJO
  const min = Math.min(...processedBuffer);
  const max = Math.max(...processedBuffer);
  const amplitude = max - min;
  
  // Incluir análisis de patrones en la confianza
  const patternFactor = Math.min(1, patternDetectionConfidence * 2);
  
  // Combinar factores
  confidence = (confidence * 0.6) + (patternFactor * 0.4);
  
  // Verificar señal - PENALIZACIÓN MENOS SEVERA para señales débiles
  if (amplitude < MIN_SIGNAL_STRENGTH) {
    confidence *= 0.6; // Penalizar menos para detectar señales extremadamente débiles
    console.log("Finger-detector: Confianza reducida por señal extremadamente débil", {
      amplitud: amplitude,
      umbralMínimo: MIN_SIGNAL_STRENGTH,
      confianzaOriginal: quality / 100,
      confianzaPatrón: patternFactor,
      confianzaFinal: confidence
    });
  } else if (amplitude < MIN_SIGNAL_STRENGTH * 3) {
    confidence *= 0.8; // Penalización ligera
  } else if (amplitude > MIN_SIGNAL_STRENGTH * 6) {
    confidence *= 1.2; // Bonificación para señales fuertes
  }
  
  // La varianza debe ser razonable (ni muy baja ni muy alta)
  const variance = calculateVariance(processedBuffer);
  
  // Umbrales más permisivos para señales débiles
  if (variance < 0.000005 || variance > 0.2) {
    confidence *= 0.8;
  }
  
  // Limitar resultado final
  return Math.min(1, Math.max(0, confidence));
}

/**
 * Resetear detector de dedo
 * Incluye reseteo de todas las variables de estado
 */
export function resetFingerDetector() {
  consecutiveWeakSignalsCount = 0;
  signalPatternBuffer = [];
  lastPatternTime = 0;
  patternDetectionConfidence = 0;
  console.log("Finger-detector: Detector de dedo COMPLETAMENTE reiniciado, incluyendo análisis de patrones");
}
