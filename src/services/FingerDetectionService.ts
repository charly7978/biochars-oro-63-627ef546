/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { create } from 'zustand';

/**
 * Interfaz para la configuración del detector de dedo
 */
interface FingerDetectionConfig {
  // Umbral para señal débil (reducido para mayor sensibilidad)
  weakSignalThreshold: number;
  
  // Cantidad de señales débiles consecutivas para confirmar pérdida de dedo
  maxConsecutiveWeakSignals: number;
  
  // Duración mínima para la detección de patrones (ms)
  patternDetectionWindowMs: number;
  
  // Picos mínimos para detectar un ritmo
  minPeaksForRhythm: number;
  
  // Umbral para detección de picos
  peakDetectionThreshold: number;
  
  // Patrones consistentes necesarios para confirmar presencia de dedo
  requiredConsistentPatterns: number;
  
  // Varianza mínima de señal para evitar falsos positivos
  minSignalVariance: number;
  
  // Amplitud mínima de señal (min-max) para considerar válida
  minSignalAmplitude: number;
  
  // Calidad mínima de señal para detección de dedo (reducida para mayor sensibilidad)
  minQualityForFingerDetection: number;
  
  // Frames consecutivos necesarios para confirmar detección
  requiredConsecutiveFrames: number;
}

/**
 * Datos de punto de señal para análisis de patrones
 */
interface SignalPoint {
  time: number;
  value: number;
}

/**
 * Estado de detección del dedo
 */
interface FingerDetectionState {
  // Estado de detección
  isFingerDetected: boolean;
  fingerConfirmed: boolean;
  fingerDetectionStartTime: number | null;
  
  // Historial de datos para análisis de patrones
  signalHistory: SignalPoint[];
  peakTimes: number[];
  
  // Contadores de calidad y patrones
  detectedPatterns: number;
  consecutiveWeakSignals: number;
  signalQuality: number;
  consecutiveGoodFrames: number;
  
  // Configuración avanzada
  config: FingerDetectionConfig;
  
  // Métricas adicionales para análisis
  lastDetectionConfidence: number;
  lastSignalAmplitude: number;
  lastSignalVariance: number;
  perfusionIndex: number;
  
  // Funciones para actualizar estado
  setFingerDetected: (detected: boolean) => void;
  setFingerConfirmed: (confirmed: boolean) => void;
  setFingerDetectionStartTime: (time: number | null) => void;
  addSignalPoint: (point: SignalPoint) => void;
  setPeakTimes: (peaks: number[]) => void;
  incrementDetectedPatterns: () => void;
  decrementDetectedPatterns: () => void;
  resetDetectedPatterns: () => void;
  setConsecutiveWeakSignals: (count: number) => void;
  incrementConsecutiveWeakSignals: () => void;
  decrementConsecutiveWeakSignals: () => void;
  setSignalQuality: (quality: number) => void;
  incrementConsecutiveGoodFrames: () => void;
  resetConsecutiveGoodFrames: () => void;
  updateDetectionMetrics: (metrics: {
    confidence?: number;
    amplitude?: number;
    variance?: number;
    perfusionIndex?: number;
  }) => void;
  resetDetection: () => void;
  
  // Método principal de procesamiento
  processSignal: (value: number, quality?: number) => boolean;
}

// Configuración optimizada para mejor detección (más sensible - reducidos umbrales aún más)
const DEFAULT_CONFIG: FingerDetectionConfig = {
  weakSignalThreshold: 0.12, // Reducido de 0.15 para mayor sensibilidad
  maxConsecutiveWeakSignals: 10, // Aumentado para evitar pérdidas rápidas
  patternDetectionWindowMs: 3000,
  minPeaksForRhythm: 2,  // Reducido para facilitar detección
  peakDetectionThreshold: 0.10, // Reducido para mayor sensibilidad
  requiredConsistentPatterns: 1, // Reducido para detectar más rápido
  minSignalVariance: 0.01, // Reducido para mayor sensibilidad
  minSignalAmplitude: 0.05, // Reducido para mayor sensibilidad
  minQualityForFingerDetection: 20, // Reducido para facilitar detección
  requiredConsecutiveFrames: 1 // Reducido para confirmar más rápido
};

// Flag para evitar reinicios múltiples que causan ciclos infinitos
let isResettingState = false;

/**
 * Servicio centralizado para la detección de dedo usando Zustand
 * Implementa algoritmos avanzados basados en patrones rítmicos fisiológicos
 * No utiliza simulaciones, solo análisis real de la señal PPG
 */
export const useFingerDetection = create<FingerDetectionState>((set, get) => ({
  // Estado inicial
  isFingerDetected: false,
  fingerConfirmed: false,
  fingerDetectionStartTime: null,
  signalHistory: [],
  peakTimes: [],
  detectedPatterns: 0,
  consecutiveWeakSignals: 0,
  signalQuality: 0,
  consecutiveGoodFrames: 0,
  config: DEFAULT_CONFIG,
  lastDetectionConfidence: 0,
  lastSignalAmplitude: 0,
  lastSignalVariance: 0,
  perfusionIndex: 0,
  
  // Funciones para manipulación de estado
  setFingerDetected: (detected) => set({ isFingerDetected: detected }),
  
  setFingerConfirmed: (confirmed) => set({ fingerConfirmed: confirmed }),
  
  setFingerDetectionStartTime: (time) => set({ fingerDetectionStartTime: time }),
  
  addSignalPoint: (point) => {
    const now = Date.now();
    set(state => {
      // Mantener solo señales recientes dentro de la ventana
      const history = [
        ...state.signalHistory,
        point
      ].filter(p => now - p.time < state.config.patternDetectionWindowMs * 2);
      
      return { signalHistory: history };
    });
  },
  
  setPeakTimes: (peaks) => set({ peakTimes: peaks }),
  
  incrementDetectedPatterns: () => set(state => ({ 
    detectedPatterns: state.detectedPatterns + 1 
  })),
  
  decrementDetectedPatterns: () => set(state => ({
    detectedPatterns: Math.max(0, state.detectedPatterns - 1)
  })),
  
  resetDetectedPatterns: () => set({ detectedPatterns: 0 }),
  
  setConsecutiveWeakSignals: (count) => set({ consecutiveWeakSignals: count }),
  
  incrementConsecutiveWeakSignals: () => set(state => ({ 
    consecutiveWeakSignals: state.consecutiveWeakSignals + 1 
  })),
  
  decrementConsecutiveWeakSignals: () => set(state => ({ 
    consecutiveWeakSignals: Math.max(0, state.consecutiveWeakSignals - 1) 
  })),
  
  setSignalQuality: (quality) => set({ signalQuality: quality }),
  
  incrementConsecutiveGoodFrames: () => set(state => ({ 
    consecutiveGoodFrames: state.consecutiveGoodFrames + 1 
  })),
  
  resetConsecutiveGoodFrames: () => set({ consecutiveGoodFrames: 0 }),
  
  updateDetectionMetrics: (metrics) => set(state => ({
    lastDetectionConfidence: metrics.confidence ?? state.lastDetectionConfidence,
    lastSignalAmplitude: metrics.amplitude ?? state.lastSignalAmplitude,
    lastSignalVariance: metrics.variance ?? state.lastSignalVariance,
    perfusionIndex: metrics.perfusionIndex ?? state.perfusionIndex
  })),
  
  resetDetection: () => {
    // Avoid potential infinite loops by checking if already resetting
    if (isResettingState) return;
    
    try {
      isResettingState = true;
      
      set({
        isFingerDetected: false,
        fingerConfirmed: false,
        fingerDetectionStartTime: null,
        signalHistory: [],
        peakTimes: [],
        detectedPatterns: 0,
        consecutiveWeakSignals: 0,
        consecutiveGoodFrames: 0,
        lastDetectionConfidence: 0,
        lastSignalAmplitude: 0,
        lastSignalVariance: 0,
        perfusionIndex: 0
      });
      
      console.log("FingerDetectionService: Detection state reset");
    } finally {
      // Reset the flag after a short delay to ensure any pending state updates are processed
      setTimeout(() => {
        isResettingState = false;
      }, 10);
    }
  },
  
  /**
   * Función principal para procesar la señal y detectar dedo
   * Implementa algoritmos avanzados basados en patrones fisiológicos del PPG
   * @param value Valor actual de la señal PPG filtrada
   * @param quality Calidad opcional de la señal (0-100)
   * @returns Estado de detección de dedo actualizado
   */
  processSignal: (value, quality) => {
    // Avoid processing signals during reset operations
    if (isResettingState) return false;
    
    const state = get();
    const now = Date.now();
    
    // Debugging info
    console.log("FingerDetectionService: Processing signal", {
      value: value.toFixed(3),
      quality: quality || 'N/A',
      detectedPatterns: state.detectedPatterns,
      currentState: state.isFingerDetected ? 'detected' : 'not detected',
      confirmed: state.fingerConfirmed
    });
    
    // Añadir punto de señal al historial
    state.addSignalPoint({ time: now, value });
    
    // Si ya está confirmado, verificar pérdida de señal
    if (state.fingerConfirmed) {
      const isWeakSignal = Math.abs(value) < state.config.weakSignalThreshold;
      
      if (isWeakSignal) {
        state.incrementConsecutiveWeakSignals();
      } else {
        state.decrementConsecutiveWeakSignals();
      }
      
      // Si hay demasiadas señales débiles consecutivas, perdimos el dedo
      if (state.consecutiveWeakSignals > state.config.maxConsecutiveWeakSignals * 2) {
        state.setFingerConfirmed(false);
        state.resetDetectedPatterns();
        state.resetConsecutiveGoodFrames();
        state.setFingerDetected(false);
        console.log("FingerDetectionService: Detección de dedo perdida por señal débil prolongada");
        return false;
      }
      
      // Actualizar calidad si se proporciona
      if (quality !== undefined) {
        state.setSignalQuality(quality);
      }
      
      // La detección se mantiene confirmada
      return true;
    }
    
    // Si no está confirmado, intentar detectar patrones rítmicos
    const patternDetected = detectRhythmicPattern(state);
    
    // Calcular amplitud de la señal reciente para validación
    let amplitude = 0;
    let variance = 0;
    
    if (state.signalHistory.length >= 10) {
      const recentValues = state.signalHistory.slice(-10).map(p => p.value);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      amplitude = max - min;
      
      // Calcular varianza
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    }
    
    // Actualizar métricas
    state.updateDetectionMetrics({ 
      amplitude, 
      variance,
      confidence: patternDetected ? state.detectedPatterns / state.config.requiredConsistentPatterns : 0
    });
    
    // Verificar condiciones combinadas para detección válida - más flexibles ahora
    const hasValidAmplitude = amplitude >= state.config.minSignalAmplitude;
    const hasValidVariance = variance >= state.config.minSignalVariance;
    const hasValidQuality = quality === undefined || quality >= state.config.minQualityForFingerDetection;
    
    // Always print diagnostics to help debug finger detection
    console.log("FingerDetection diagnostics:", { 
      patternDetected, 
      amplitude, 
      variance,
      hasValidAmplitude,
      hasValidVariance,
      hasValidQuality,
      consecutiveGoodFrames: state.consecutiveGoodFrames 
    });
    
    let fingerDetected = false;
    
    // Modo más sensible: permitir detección incluso con menos condiciones
    if (patternDetected || hasValidAmplitude || (quality !== undefined && quality > 20)) {
      state.incrementConsecutiveGoodFrames();
      
      // Si hay suficientes frames consecutivos buenos, confirmar detección
      if (state.consecutiveGoodFrames >= state.config.requiredConsecutiveFrames) {
        // Si es la primera confirmación, registrar tiempo
        if (!state.fingerConfirmed) {
          state.setFingerConfirmed(true);
          console.log("FingerDetectionService: Dedo detectado y confirmado", {
            time: new Date(now).toISOString(),
            patterns: state.detectedPatterns,
            amplitude,
            variance,
            quality
          });
        }
        fingerDetected = true;
      }
    } else {
      state.resetConsecutiveGoodFrames();
    }
    
    state.setFingerDetected(fingerDetected);
    return fingerDetected;
  }
}));

/**
 * Función auxiliar para detectar patrones rítmicos en la señal
 * Implementa análisis avanzado de patrones cardíacos
 */
function detectRhythmicPattern(state: FingerDetectionState): boolean {
  const { signalHistory, config } = state;
  const now = Date.now();
  
  // Verificar si hay suficientes datos - reducido para mayor sensibilidad
  if (signalHistory.length < 10) return false;  // Reducido desde 15
  
  // Filtrar señales recientes dentro de la ventana de detección
  const recentSignals = signalHistory.filter(
    point => now - point.time < config.patternDetectionWindowMs
  );
  
  if (recentSignals.length < 10) return false;  // Reducido desde 15
  
  // Análisis de varianza para evitar falsos positivos con señales constantes
  const values = recentSignals.map(s => s.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  if (variance < config.minSignalVariance) {
    // Varianza muy baja - probablemente no es señal fisiológica
    state.decrementDetectedPatterns();
    return false;
  }
  
  // Buscar picos en la señal reciente - más sensible
  const peaks: number[] = [];
  
  for (let i = 2; i < recentSignals.length - 2; i++) {
    const current = recentSignals[i];
    const prev1 = recentSignals[i - 1];
    const prev2 = recentSignals[i - 2];
    const next1 = recentSignals[i + 1];
    const next2 = recentSignals[i + 2];
    
    // Buscamos cualquier pequeña variación en la señal - muy sensible a propósito
    if (current.value > prev1.value * 1.05 && 
        current.value > prev2.value * 1.05 && 
        current.value > next1.value * 1.05 && 
        current.value > next2.value * 1.05 && 
        Math.abs(current.value) > config.peakDetectionThreshold) {
      peaks.push(current.time);
    }
  }
  
  // Necesitamos suficientes picos para establecer un patrón
  if (peaks.length < config.minPeaksForRhythm) {
    state.decrementDetectedPatterns();
    return false;
  }
  
  // Calcular intervalos entre picos
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  // Rango fisiológico ampliado para mayor flexibilidad
  const validIntervals = intervals.filter(interval => 
    interval >= 250 && interval <= 2500 // 24-240 BPM (rango bastante amplio)
  );
  
  if (validIntervals.length < Math.floor(intervals.length * 0.5)) { // Reducido a 50%
    // Si menos del 50% de intervalos son fisiológicamente plausibles, rechazar el patrón
    state.decrementDetectedPatterns();
    return false;
  }
  
  // Verificar consistencia en los intervalos (ritmo)
  let consistentIntervals = 0;
  const maxDeviation = 300; // ms (aumentado para mayor tolerancia)
  
  for (let i = 1; i < validIntervals.length; i++) {
    if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
      consistentIntervals++;
    }
  }
  
  // Si tenemos intervalos consistentes, incrementar contador de patrones
  if (consistentIntervals >= config.minPeaksForRhythm - 1) {
    state.setPeakTimes(peaks);
    state.incrementDetectedPatterns();
    
    return state.detectedPatterns >= config.requiredConsistentPatterns;
  } else {
    // Reducir contador si el patrón no es consistente
    state.decrementDetectedPatterns();
    return false;
  }
}

/**
 * Función utilitaria para calcular el índice de perfusión
 * basado en valores PPG recientes
 */
export function calculatePerfusionIndex(recentValues: number[]): number {
  if (recentValues.length < 5) return 0;
  
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const dc = (min + max) / 2;
  
  if (dc === 0) return 0;
  
  const ac = max - min;
  return (ac / Math.abs(dc)) * 100;
}

export default useFingerDetection;
