
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Enhanced functions for peak detection logic, working with real data only
 */

// Buffer for adaptive thresholding
let signalBuffer: number[] = [];
const BUFFER_SIZE = 30; // Increased for better adaptive threshold calculation
let adaptiveThreshold = 0.02;
let lastPeakValue = 0;
let lastPeakTime = 0;
const MIN_PEAK_DISTANCE_MS = 250; // Minimum time between peaks (240bpm max)

// Advanced peak detection state
let lastValues: number[] = []; // Last few processed values
const LAST_VALUES_BUFFER = 5; // Store last 5 values for slope analysis
let lastSlopes: number[] = []; // Store slopes for second derivative analysis
const SLOPE_BUFFER = 3; // Store last 3 slopes for acceleration analysis
let noiseFloor = 0.01; // Dynamically adjusted noise floor
let signalQuality = 0.5; // Signal quality estimate from 0-1

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements with improved thresholding
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Add to buffer for adaptive thresholding
  signalBuffer.push(value);
  if (signalBuffer.length > BUFFER_SIZE) {
    signalBuffer.shift();
  }
  
  // Calculate signal dynamic range for adaptive threshold
  if (signalBuffer.length >= 10) {
    const min = Math.min(...signalBuffer);
    const max = Math.max(...signalBuffer);
    const range = max - min;
    
    // Update adaptive threshold based on signal amplitude
    adaptiveThreshold = Math.max(0.008, range * 0.2);
    
    // Update noise floor based on signal statistics
    const sortedValues = [...signalBuffer].sort((a, b) => a - b);
    const lowerQuartile = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const upperQuartile = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = upperQuartile - lowerQuartile;
    
    // Set noise floor to a fraction of the interquartile range
    noiseFloor = Math.max(0.005, iqr * 0.1);
  }
  
  // Update signal quality estimate
  if (signalBuffer.length >= 20) {
    // Look for physiological patterns in the buffer
    let crossings = 0;
    const mean = signalBuffer.reduce((sum, val) => sum + val, 0) / signalBuffer.length;
    
    for (let i = 1; i < signalBuffer.length; i++) {
      if ((signalBuffer[i] > mean && signalBuffer[i-1] <= mean) ||
          (signalBuffer[i] <= mean && signalBuffer[i-1] > mean)) {
        crossings++;
      }
    }
    
    // Physiological PPG should have reasonable zero crossing rate
    // Too few = poor signal, too many = noise
    const crossingRate = crossings / signalBuffer.length;
    signalQuality = crossingRate >= 0.1 && crossingRate <= 0.5 ? 
      Math.min(1, Math.max(0.2, 1 - Math.abs(0.25 - crossingRate) * 4)) : 
      Math.max(0.1, signalQuality * 0.9);
  }
  
  // Use adaptive threshold with signal quality modulation
  const effectiveThreshold = adaptiveThreshold * Math.max(0.5, Math.min(1.5, signalQuality * 2));
  return Math.abs(value) >= effectiveThreshold;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
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
    },
    isArrhythmia: false,
    // Adding transition state to ensure continuous color rendering
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Improved peak detection with adaptive thresholding and timing validation
 * Returns true if current value is a peak, false otherwise
 * 
 * Enhanced with multi-feature analysis for PPG peak detection:
 * 1. Amplitude thresholding with dynamic adaptation
 * 2. First and second derivative analysis
 * 3. Waveform shape validation
 * 4. Time-domain constraints
 */
export function detectPeak(value: number, recentValues: number[]): boolean {
  // Store value for slope analysis
  lastValues.push(value);
  if (lastValues.length > LAST_VALUES_BUFFER) {
    lastValues.shift();
  }
  
  // Need minimum values for detection
  if (lastValues.length < 3 || recentValues.length < 5) return false;
  
  // Calculate first derivative (slope)
  const currentSlope = lastValues[lastValues.length - 1] - lastValues[lastValues.length - 2];
  
  // Store slope for second derivative (acceleration) analysis
  lastSlopes.push(currentSlope);
  if (lastSlopes.length > SLOPE_BUFFER) {
    lastSlopes.shift();
  }
  
  // Need minimum slopes for acceleration analysis
  if (lastSlopes.length < 2) return false;
  
  // Calculate second derivative (acceleration)
  const currentAcceleration = lastSlopes[lastSlopes.length - 1] - lastSlopes[lastSlopes.length - 2];
  
  // A peak occurs at the transition from positive to negative slope
  // with appropriate acceleration characteristics
  const prev = recentValues[recentValues.length - 1];
  const prevPrev = recentValues[recentValues.length - 2];
  
  // Multi-criterion peak detection
  const isPrevLocalMaximum = prev > value && prev > prevPrev;
  const hasNegativeAcceleration = currentAcceleration < -noiseFloor;
  const hasSlopeTransition = lastSlopes[lastSlopes.length - 2] > 0 && lastSlopes[lastSlopes.length - 1] < 0;
  
  // Combine criteria for peak detection
  const isPotentialPeak = isPrevLocalMaximum && (hasNegativeAcceleration || hasSlopeTransition);
  
  if (!isPotentialPeak) return false;
  
  // Additional validation: peak must exceed adaptive threshold
  const isPeakHighEnough = prev > adaptiveThreshold * (1 + Math.max(0, signalQuality - 0.5));
  
  // Check minimum time between peaks to avoid false doubles
  const now = Date.now();
  const hasMinimumInterval = (now - lastPeakTime) > (MIN_PEAK_DISTANCE_MS * Math.max(0.8, Math.min(1.2, 1 / signalQuality)));
  
  // Check waveform shape characteristics (PPG specific)
  // The rising edge should be steeper than falling edge for PPG waves
  const risingEdgeSlope = lastSlopes.filter(s => s > 0).reduce((sum, s) => sum + s, 0) / 
    Math.max(1, lastSlopes.filter(s => s > 0).length);
  const fallingEdgeSlope = Math.abs(lastSlopes.filter(s => s < 0).reduce((sum, s) => sum + s, 0)) / 
    Math.max(1, lastSlopes.filter(s => s < 0).length);
  
  const hasValidWaveformShape = risingEdgeSlope > fallingEdgeSlope * 0.7;
  
  // Final validation combines multiple factors
  if (isPeakHighEnough && hasMinimumInterval && (hasValidWaveformShape || signalQuality < 0.7)) {
    lastPeakValue = prev;
    lastPeakTime = now;
    
    // Log peak characteristics for debugging
    console.log("Peak detected with enhanced algorithm:", {
      value: prev,
      threshold: adaptiveThreshold,
      timeSinceLastPeak: now - lastPeakTime,
      risingSlope: risingEdgeSlope.toFixed(4),
      fallingSlope: fallingEdgeSlope.toFixed(4),
      waveformValid: hasValidWaveformShape,
      signalQuality: signalQuality.toFixed(2)
    });
    
    return true;
  }
  
  return false;
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.15) { // Reduced confidence threshold for better sensitivity
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // EL BEEP SOLO SE MANEJA EN PPGSignalMeter CUANDO SE DIBUJA UN CÍRCULO
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      // Log transition state if present
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false,
      adaptiveThreshold: adaptiveThreshold,
      signalQuality: signalQuality.toFixed(2)
    });
  }
}

/**
 * Reset peak detection state
 */
export function resetPeakDetection(): void {
  signalBuffer = [];
  adaptiveThreshold = 0.02;
  lastPeakValue = 0;
  lastPeakTime = 0;
  lastValues = [];
  lastSlopes = [];
  noiseFloor = 0.01;
  signalQuality = 0.5;
  console.log("Peak detection reset - state cleared completely");
}
