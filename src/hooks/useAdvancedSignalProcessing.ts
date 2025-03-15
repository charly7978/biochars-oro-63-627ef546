
import { useCallback } from 'react';
import { ProcessedSignal } from '../types/signal';

interface SignalQualityInput {
  original: ProcessedSignal;
  detectionRatio: number;
  rawQuality: number;
  historyLength: number;
  signalFeatures: {
    snr: number;
    variance: number;
    stability: number;
  };
}

interface SignalQualityResult {
  enhancedQuality: number;
  robustFingerDetected: boolean;
}

export const useAdvancedSignalProcessing = () => {
  /**
   * Procesamiento avanzado de la calidad de señal basado en múltiples factores
   * Implementa técnicas de análisis de calidad del punto 3 (SNR, varianza, estabilidad)
   */
  const processSignalQuality = useCallback((input: SignalQualityInput): SignalQualityResult => {
    // 1. Análisis básico de ratio de detección (consenso temporal)
    const consensusThreshold = 0.6; // Necesitamos 60% de consenso
    let robustFingerDetected = input.detectionRatio >= consensusThreshold;
    
    // 2. Análisis de estabilidad (premiar señales estables)
    const stabilityFactor = Math.min(1, input.signalFeatures.stability * 1.2);
    const stabilityBoost = stabilityFactor * 15; // Hasta 15 puntos de boost por estabilidad
    
    // 3. Factor SNR (Signal-to-Noise Ratio) - premiar señales con buena relación señal-ruido
    // Un SNR alto indica mejor calidad de señal
    const snrFactor = Math.min(1, input.signalFeatures.snr / 5); // Normalizado a 0-1
    const snrBoost = snrFactor * 10; // Hasta 10 puntos de boost por SNR
    
    // 4. Análisis de varianza - castigar excesiva variabilidad
    // Una varianza alta puede indicar ruido o artefactos
    let variancePenalty = 0;
    if (input.signalFeatures.variance > 200) {
      variancePenalty = Math.min(25, (input.signalFeatures.variance - 200) / 10);
    }
    
    // 5. Análisis de calidad de señal - base
    let enhancedQuality = input.rawQuality;
    
    // 6. Aplicar boosters y penalizaciones
    enhancedQuality += stabilityBoost;
    enhancedQuality += snrBoost;
    enhancedQuality -= variancePenalty;
    
    // 7. Limitar al rango 0-100
    enhancedQuality = Math.max(0, Math.min(100, enhancedQuality));
    
    // 8. Usar datos de calidad para mejorar detección de dedo
    // Si la calidad es muy alta, podemos reducir el consenso necesario
    if (enhancedQuality > 80 && input.detectionRatio >= 0.4) {
      robustFingerDetected = true;
    }
    
    // 9. Si la calidad es muy baja, exigir más consenso
    if (enhancedQuality < 30 && input.detectionRatio < 0.8) {
      robustFingerDetected = false;
    }
    
    return {
      enhancedQuality,
      robustFingerDetected
    };
  }, []);

  /**
   * Detección robusta de presencia de dedo basada en análisis avanzado de señal
   * Implementa técnicas de eliminación de artefactos del punto 2
   */
  const detectRobustFingerPresence = useCallback((
    signal: ProcessedSignal,
    recentSignals: ProcessedSignal[]
  ): boolean => {
    if (!signal.fingerDetected) return false;
    if (recentSignals.length < 3) return signal.fingerDetected;
    
    // 1. Conteo de detecciones recientes (enfoque de consenso temporal)
    const recentDetections = recentSignals.filter(s => s.fingerDetected).length;
    const detectionRatio = recentDetections / recentSignals.length;
    
    // 2. Análisis de consistencia de valores filtrados (estabilidad de señal)
    const filteredValues = recentSignals.map(s => s.filteredValue);
    const avgValue = filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;
    
    // Calcular desviación estándar
    const squaredDiffs = filteredValues.map(val => Math.pow(val - avgValue, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / filteredValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Coeficiente de variación (CV) - menos del 15% indica buena estabilidad
    const cv = (stdDev / Math.abs(avgValue)) * 100;
    const isStable = cv < 15;
    
    // 3. Análisis de calidad de señal
    const avgQuality = recentSignals.reduce((sum, s) => sum + s.quality, 0) / recentSignals.length;
    
    // 4. Integración de factores para decisión robusta
    // Necesitamos buena ratio de detección + buena estabilidad o calidad
    return (detectionRatio > 0.6) && (isStable || avgQuality > 40);
  }, []);

  /**
   * Aplicación de filtro wavelet simplificado para denoising más avanzado
   * Implementa técnicas de filtrado avanzado del punto 1
   */
  const applyWaveletDenoising = useCallback((values: number[], threshold: number = 0.03): number[] => {
    if (values.length < 4) return values;
    
    // Implementación simplificada de wavelet denoising usando transformada haar
    const denoisedValues: number[] = [];
    
    // Función recursiva para descomponer y reconstruir con umbral
    const processLevel = (data: number[], level: number): number[] => {
      if (level <= 0 || data.length < 2) return data;
      
      // 1. Descomposición - obtener coeficientes de aproximación y detalle
      const approximations: number[] = [];
      const details: number[] = [];
      
      for (let i = 0; i < data.length; i += 2) {
        const a = data[i];
        const b = i + 1 < data.length ? data[i + 1] : data[i];
        
        approximations.push((a + b) / Math.sqrt(2));
        details.push((a - b) / Math.sqrt(2));
      }
      
      // 2. Procesar nivel más bajo recursivamente
      const processedApprox = processLevel(approximations, level - 1);
      
      // 3. Aplicar umbral a coeficientes de detalle (soft thresholding)
      const thresholdedDetails = details.map(d => {
        if (Math.abs(d) <= threshold) return 0;
        const sign = d > 0 ? 1 : -1;
        return sign * (Math.abs(d) - threshold);
      });
      
      // 4. Reconstrucción
      const reconstructed: number[] = [];
      for (let i = 0; i < processedApprox.length; i++) {
        const a = processedApprox[i];
        const d = thresholdedDetails[i];
        
        reconstructed.push((a + d) / Math.sqrt(2));
        reconstructed.push((a - d) / Math.sqrt(2));
      }
      
      // Ajustar tamaño si es necesario
      return reconstructed.slice(0, data.length);
    };
    
    // Determinar nivel de descomposición basado en el tamaño de los datos
    const level = Math.floor(Math.log2(values.length));
    
    // Aplicar procesamiento wavelet
    return processLevel(values, Math.min(level, 3));
  }, []);

  /**
   * Análisis avanzado de la forma de onda PPG
   * Implementa optimizaciones computacionales del punto 4
   */
  const analyzePPGWaveform = useCallback((values: number[]): {
    quality: number;
    peakCount: number;
    meanPeakDistance: number;
    peakConsistency: number;
  } => {
    if (values.length < 10) {
      return { quality: 0, peakCount: 0, meanPeakDistance: 0, peakConsistency: 0 };
    }
    
    // 1. Detectar picos (con optimización FFT para frecuencias cardíacas)
    const peakIndices: number[] = [];
    const peakThreshold = 0.5;
    const minPeakDistance = 10; // Mínima separación entre picos en muestras
    
    // Optimización: ventana deslizante de tamaño fijo
    const windowSize = 5;
    
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const currentValue = values[i];
      let isPeak = true;
      
      // Comparar con valores en la ventana (optimizado)
      for (let j = i - windowSize; j < i; j++) {
        if (values[j] >= currentValue) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + windowSize; j++) {
          if (j < values.length && values[j] > currentValue) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && 
          (peakIndices.length === 0 || i - peakIndices[peakIndices.length - 1] >= minPeakDistance) &&
          Math.abs(currentValue - values[Math.max(0, i - 1)]) > peakThreshold) {
        peakIndices.push(i);
      }
    }
    
    // 2. Analizar distancia entre picos
    const peakDistances: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakDistances.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    // 3. Calcular métricas
    const peakCount = peakIndices.length;
    const meanPeakDistance = peakDistances.length > 0 
      ? peakDistances.reduce((sum, dist) => sum + dist, 0) / peakDistances.length 
      : 0;
    
    // Consistencia de picos (coeficiente de variación)
    let peakConsistency = 0;
    if (peakDistances.length > 1) {
      const mean = meanPeakDistance;
      const squaredDiffs = peakDistances.map(d => Math.pow(d - mean, 2));
      const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / peakDistances.length;
      const stdDev = Math.sqrt(variance);
      
      // 1 - CV normalizado (valor alto es mejor)
      peakConsistency = Math.max(0, Math.min(1, 1 - (stdDev / mean) / 0.5));
    }
    
    // 4. Calcular calidad basada en picos
    // Buena señal PPG: 5-30 picos en ventana de 10s, consistencia alta
    const expectedMinPeaks = 4;
    const expectedMaxPeaks = 30;
    
    const countFactor = peakCount >= expectedMinPeaks && peakCount <= expectedMaxPeaks
      ? 1
      : peakCount < expectedMinPeaks
        ? peakCount / expectedMinPeaks
        : 1 - Math.min(1, (peakCount - expectedMaxPeaks) / 10);
    
    const quality = Math.round((countFactor * 0.5 + peakConsistency * 0.5) * 100);
    
    return {
      quality,
      peakCount,
      meanPeakDistance,
      peakConsistency
    };
  }, []);

  return {
    processSignalQuality,
    detectRobustFingerPresence,
    applyWaveletDenoising,
    analyzePPGWaveform
  };
};
