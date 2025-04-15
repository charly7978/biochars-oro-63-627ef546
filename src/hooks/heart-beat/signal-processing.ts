/**
 * Utility functions for heart beat signal processing
 * Solo procesa datos reales
 */
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

interface SignalQualityConfig {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Check if signal is too weak
 * Solo datos reales
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignals: number,
  config: SignalQualityConfig
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Verificar si la señal es débil basado en su amplitud
  const isCurrentlyWeak = Math.abs(value) < lowSignalThreshold;
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isCurrentlyWeak
    ? consecutiveWeakSignals + 1
    : Math.max(0, consecutiveWeakSignals - 1);
  
  // Determinar si la señal debe considerarse como débil en general
  const isWeakSignal = updatedWeakSignalsCount > maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Update last valid BPM value
 * Solo datos reales
 */
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  if (result && result.bpm > 40 && result.bpm < 200 && result.confidence > 0.5) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Process result when confidence is low
 * Solo datos reales
 */
export function processLowConfidenceResult(
  result: any,
  currentBPM: number
): any {
  // Si la confianza es baja, mantener el BPM anterior para estabilidad
  if (result.confidence < 0.2 && currentBPM > 0) {
    return {
      ...result,
      bpm: currentBPM,
      arrhythmiaCount: ArrhythmiaDetectionService.getArrhythmiaCount(),
      isArrhythmia: ArrhythmiaDetectionService.isArrhythmia()
    };
  }
  
  // Añadir contador de arritmias y estado para consistencia
  return {
    ...result,
    arrhythmiaCount: ArrhythmiaDetectionService.getArrhythmiaCount(),
    isArrhythmia: ArrhythmiaDetectionService.isArrhythmia()
  };
}

/**
 * Create a result for weak signal scenarios
 */
export function createWeakSignalResult(arrhythmiaCount: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCount,
    isArrhythmia: false,
    rrData: {
      intervals: [],
      lastPeakTime: null
    },
    fingerDetected: false
  };
}

/**
 * Determine if a measurement should be processed
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Ignore small values
  return Math.abs(value) >= 0.01;
}

/**
 * Handle peak detection logic
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  isMonitoringRef: React.MutableRefObject<boolean>
): void {
  if (!isMonitoringRef.current) return;
  
  const currentTime = Date.now();
  
  if (lastPeakTimeRef.current !== null) {
    const interval = currentTime - lastPeakTimeRef.current;
    
    // Ensure interval is physiologically valid (30-200 BPM)
    if (interval >= 300 && interval <= 2000) {
      if (result.rrData && result.rrData.intervals) {
        // Update intervals for arrhythmia detection
        if (Array.isArray(result.rrData.intervals)) {
          // Limit array size
          const intervals = [...result.rrData.intervals, interval].slice(-20);
          result.rrData.intervals = intervals;
          
          // Update ArrhythmiaDetectionService
          ArrhythmiaDetectionService.updateRRIntervals(intervals);
        } else {
          result.rrData.intervals = [interval];
          ArrhythmiaDetectionService.updateRRIntervals([interval]);
        }
      } else {
        result.rrData = {
          intervals: [interval],
          lastPeakTime: currentTime
        };
        ArrhythmiaDetectionService.updateRRIntervals([interval]);
      }
    }
  }
  
  // Update last peak time
  lastPeakTimeRef.current = currentTime;
  
  // Update RR data with current peak time
  if (result.rrData) {
    result.rrData.lastPeakTime = currentTime;
  } else {
    result.rrData = {
      intervals: [],
      lastPeakTime: currentTime
    };
  }
}

/**
 * Calculate stable BPM from RR intervals
 * Takes median of recent intervals for stability
 */
export function calculateStableBpm(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) {
    return 0;
  }
  
  // Use the most recent intervals (last 5)
  const recentIntervals = rrIntervals.slice(-5);
  
  // Sort intervals to find median (most stable approach)
  const sortedIntervals = [...recentIntervals].sort((a, b) => a - b);
  
  // Get the median interval
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  
  // Convert to BPM
  return Math.round(60000 / medianInterval);
}
