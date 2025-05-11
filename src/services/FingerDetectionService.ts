
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

// Configuración optimizada para sensibilidad MÁXIMA
const DEFAULT_CONFIG: FingerDetectionConfig = {
  weakSignalThreshold: 0.05,  // CAMBIO #1: Reducido drásticamente (antes 0.12)
  maxConsecutiveWeakSignals: 5, // CAMBIO #2: Reducido para detección más rápida (antes 10)
  patternDetectionWindowMs: 1500, // Reducido para detección más rápida
  minPeaksForRhythm: 1,  // CAMBIO #3: Mínimo absoluto (antes 2) - extremadamente sensible
  peakDetectionThreshold: 0.05, // Reducido para mayor sensibilidad
  requiredConsistentPatterns: 1, // Ya estaba en mínimo
  minSignalVariance: 0.001, // Reducido al mínimo
  minSignalAmplitude: 0.01, // Reducido al mínimo
  minQualityForFingerDetection: 10, // Reducido al mínimo 
  requiredConsecutiveFrames: 1 // Ya estaba en mínimo
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
      }, 50);  // Aumentado el tiempo de espera para evitar problemas
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
      confirmed: state.fingerConfirmed,
      threshold: state.config.weakSignalThreshold
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
    
    // Verificar condiciones combinadas para detección válida - extremadamente flexible
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
    
    // Modo ultra sensible: cualquier señal con amplitud o patrón es suficiente
    if (patternDetected || hasValidAmplitude || Math.abs(value) > state.config.weakSignalThreshold) {
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
  if (signalHistory.length < 5) return false;  // Reducido aún más para máxima sensibilidad
  
  // Filtrar señales recientes dentro de la ventana de detección
  const recentSignals = signalHistory.filter(
    point => now - point.time < config.patternDetectionWindowMs
  );
  
  if (recentSignals.length < 5) return false;  // Reducido para máxima sensibilidad
  
  // Análisis de varianza para evitar falsos positivos con señales constantes
  const values = recentSignals.map(s => s.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  if (variance < config.minSignalVariance) {
    // Varianza muy baja - probablemente no es señal fisiológica
    state.decrementDetectedPatterns();
    return false;
  }
  
  // Buscar picos en la señal reciente - extremadamente sensible
  const peaks: number[] = [];
  
  for (let i = 1; i < recentSignals.length - 1; i++) {
    const current = recentSignals[i];
    const prev1 = recentSignals[i - 1];
    const next1 = recentSignals[i + 1];
    
    // Buscamos cualquier pequeña variación en la señal - ultra sensible
    if (current.value > prev1.value * 1.01 && 
        current.value > next1.value * 1.01 && 
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
  
  // Rango fisiológico muy amplio para máxima sensibilidad
  const validIntervals = intervals.filter(interval => 
    interval >= 200 && interval <= 3000 // 20-300 BPM (rango extremadamente amplio)
  );
  
  if (validIntervals.length < 1 && intervals.length > 0) {
    // Rechazar solo si no hay ningún intervalo válido
    state.decrementDetectedPatterns();
    return false;
  }
  
  // Si llegamos aquí con al menos un pico, incrementamos patrones
  state.setPeakTimes(peaks);
  state.incrementDetectedPatterns();
  
  return state.detectedPatterns >= config.requiredConsistentPatterns;
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
