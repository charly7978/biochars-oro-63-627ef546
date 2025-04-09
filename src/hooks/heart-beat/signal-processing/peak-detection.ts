
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Enhanced functions for peak detection logic, working with real data only
 */

// Buffer for adaptive thresholding
let signalBuffer: number[] = [];
const BUFFER_SIZE = 35; // Increased for better adaptive threshold calculation
let adaptiveThreshold = 0.02;
let lastPeakValue = 0;
let lastPeakTime = 0;
const MIN_PEAK_DISTANCE_MS = 250; // Minimum time between peaks (240bpm max)

// Advanced peak detection state
let lastValues: number[] = []; // Last few processed values
const LAST_VALUES_BUFFER = 7; // Increased buffer for better slope analysis
let lastSlopes: number[] = []; // Store slopes for second derivative analysis
const SLOPE_BUFFER = 4; // Increased for better acceleration analysis
let noiseFloor = 0.01; // Dynamically adjusted noise floor
let signalQuality = 0.5; // Signal quality estimate from 0-1

// Peak consistency tracking
let peakIntervals: number[] = [];
const MAX_INTERVALS = 8;
let averageInterval = 0;
let lastValidPeakTime = 0;

// Person-specific adaptation
let personSignatureBuffer: number[] = [];
const PERSON_SIGNATURE_SIZE = 15;
let personSignatureAvg = 0;
let personSignatureVar = 0;
let lastSignatureUpdate = 0;
let individualSensitivity = 1.0;

// Device-specific adaptation
let isHighPerformanceDevice = false;
const deviceCheckInterval = 10000; // 10 seconds
let lastDeviceCheck = 0;
let detectionSensitivity = 1.0; // Adjusted based on device capability

/**
 * Checks device performance to adapt parameters
 */
function checkDevicePerformance(): void {
  const now = Date.now();
  if (now - lastDeviceCheck < deviceCheckInterval) {
    return;
  }
  
  lastDeviceCheck = now;
  
  // Check for high-end device features
  const hasGPU = !!navigator.gpu;
  const memory = (navigator as any).deviceMemory; // May be undefined on some browsers
  const highMemory = memory ? memory >= 4 : false;
  
  // Check processor (via rough performance estimate)
  const start = performance.now();
  let counter = 0;
  for (let i = 0; i < 1000000; i++) {
    counter += Math.sqrt(i);
  }
  const end = performance.now();
  const cpuScore = 1000 / (end - start);
  
  isHighPerformanceDevice = hasGPU || highMemory || cpuScore > 1.5;
  
  // Adjust sensitivity based on device capability
  detectionSensitivity = isHighPerformanceDevice ? 1.2 : 0.9;
  
  console.log(`Device performance check: High-performance=${isHighPerformanceDevice}, GPU=${hasGPU}, CPU Score=${cpuScore.toFixed(2)}, Sensitivity=${detectionSensitivity.toFixed(2)}`);
}

/**
 * Updates person-specific signature based on signal characteristics
 */
function updatePersonSignature(value: number): void {
  const now = Date.now();
  
  // Add to person signature buffer
  personSignatureBuffer.push(value);
  if (personSignatureBuffer.length > PERSON_SIGNATURE_SIZE) {
    personSignatureBuffer.shift();
  }
  
  // Only update signature once every 5 seconds to allow for stabilization
  if (personSignatureBuffer.length >= PERSON_SIGNATURE_SIZE && (now - lastSignatureUpdate > 5000)) {
    lastSignatureUpdate = now;
    
    // Calculate average and variance of signal
    const sum = personSignatureBuffer.reduce((a, b) => a + b, 0);
    personSignatureAvg = sum / personSignatureBuffer.length;
    
    let varSum = 0;
    personSignatureBuffer.forEach(v => {
      varSum += Math.pow(v - personSignatureAvg, 2);
    });
    personSignatureVar = varSum / personSignatureBuffer.length;
    
    // Adapt sensitivity based on signal characteristics
    // Lower variance signals need higher sensitivity
    if (personSignatureVar > 0) {
      individualSensitivity = Math.min(1.8, Math.max(0.7, 0.04 / Math.sqrt(personSignatureVar)));
    }
    
    console.log(`Person signature updated: avg=${personSignatureAvg.toFixed(4)}, var=${personSignatureVar.toFixed(4)}, sensitivity=${individualSensitivity.toFixed(2)}`);
  }
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements with improved thresholding
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Run device performance check periodically
  const now = Date.now();
  if (now - lastDeviceCheck > deviceCheckInterval) {
    checkDevicePerformance();
  }
  
  // Update person-specific signature
  updatePersonSignature(value);
  
  // Add to buffer for adaptive thresholding
  signalBuffer.push(value);
  if (signalBuffer.length > BUFFER_SIZE) {
    signalBuffer.shift();
  }
  
  // Calculate signal dynamic range for adaptive threshold
  if (signalBuffer.length >= 12) {
    // Sort for percentile-based calculations to remove outliers
    const sortedValues = [...signalBuffer].sort((a, b) => a - b);
    const lowerIdx = Math.floor(sortedValues.length * 0.1); // 10th percentile
    const upperIdx = Math.floor(sortedValues.length * 0.9); // 90th percentile
    
    const robustMin = sortedValues[lowerIdx];
    const robustMax = sortedValues[upperIdx];
    const range = robustMax - robustMin;
    
    // Update adaptive threshold based on signal amplitude and individual sensitivity
    adaptiveThreshold = Math.max(0.008, range * 0.2 * detectionSensitivity * individualSensitivity);
    
    // Update noise floor based on signal statistics
    const lowerQuartile = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const upperQuartile = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = upperQuartile - lowerQuartile;
    
    // Set noise floor to a fraction of the interquartile range
    noiseFloor = Math.max(0.005, iqr * 0.12 * detectionSensitivity * individualSensitivity);
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
    
    // Expected crossings for heart rate 40-180 BPM at 30fps: ~0.1-0.3 crossings per sample
    const idealCrossingRate = 0.2;
    const crossingDeviation = Math.abs(crossingRate - idealCrossingRate);
    signalQuality = crossingDeviation < 0.1 ? 
                    1 - crossingDeviation * 5 : // Higher quality near ideal rate
                    Math.max(0.2, 0.6 - crossingDeviation); // Lower quality away from ideal
  }
  
  // Use adaptive threshold with signal quality modulation and individual sensitivity
  const effectiveThreshold = adaptiveThreshold * Math.max(0.6, Math.min(1.5, signalQuality * 2)) * individualSensitivity;
  return Math.abs(value) >= effectiveThreshold * detectionSensitivity;
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
 * 5. Physiological consistency checks
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
  
  // Calculate expected interval based on recent peak history
  let expectedInterval = MIN_PEAK_DISTANCE_MS;
  if (peakIntervals.length >= 3) {
    averageInterval = peakIntervals.reduce((sum, val) => sum + val, 0) / peakIntervals.length;
    expectedInterval = averageInterval * 0.7; // Allow for heart rate increase
  }
  
  const timeSinceLastPeak = now - lastPeakTime;
  const hasMinimumInterval = timeSinceLastPeak > expectedInterval;
  
  // Check waveform shape characteristics (PPG specific)
  // The rising edge should be steeper than falling edge for PPG waves
  const risingEdgeSlope = lastSlopes.filter(s => s > 0).reduce((sum, s) => sum + s, 0) / 
    Math.max(1, lastSlopes.filter(s => s > 0).length);
  const fallingEdgeSlope = Math.abs(lastSlopes.filter(s => s < 0).reduce((sum, s) => sum + s, 0)) / 
    Math.max(1, lastSlopes.filter(s => s < 0).length);
  
  const hasValidWaveformShape = risingEdgeSlope > fallingEdgeSlope * 0.65;
  
  // Physiological consistency check - verify against expected timing pattern
  let isPhysiologicallyConsistent = true;
  if (peakIntervals.length >= 3 && lastValidPeakTime > 0) {
    const timeSinceValidPeak = now - lastValidPeakTime;
    const intervalDeviation = Math.abs(timeSinceValidPeak / averageInterval - Math.round(timeSinceValidPeak / averageInterval));
    isPhysiologicallyConsistent = intervalDeviation < 0.4; // Should be close to a multiple of the average interval
  }
  
  // Final validation combines multiple factors
  if (isPeakHighEnough && hasMinimumInterval && 
     (hasValidWaveformShape || signalQuality < 0.7) &&
     (isPhysiologicallyConsistent || peakIntervals.length < 3)) {
    
    // Update peak history
    lastPeakValue = prev;
    
    // Only update intervals for valid peaks
    if (lastPeakTime > 0) {
      const interval = now - lastPeakTime;
      // Only add if interval is physiologically plausible (30-200 BPM)
      if (interval >= 300 && interval <= 2000) {
        peakIntervals.push(interval);
        if (peakIntervals.length > MAX_INTERVALS) {
          peakIntervals.shift();
        }
      }
    }
    
    lastPeakTime = now;
    lastValidPeakTime = now;
    
    // Reset individual sensitivity occasionally to adapt to changing conditions
    if (Math.random() < 0.05) {
      individualSensitivity = Math.max(0.7, Math.min(1.8, individualSensitivity * (0.95 + Math.random() * 0.1)));
    }
    
    // Log peak characteristics for debugging
    if (Math.random() < 0.1) { // Only log ~10% of peaks to avoid console spam
      console.log("Peak detected with enhanced algorithm:", {
        value: prev.toFixed(4),
        threshold: adaptiveThreshold.toFixed(4),
        timeSinceLastPeak: timeSinceLastPeak,
        avgInterval: averageInterval.toFixed(0),
        waveformValid: hasValidWaveformShape,
        signalQuality: signalQuality.toFixed(2),
        sensitivity: detectionSensitivity.toFixed(2),
        individualSensitivity: individualSensitivity.toFixed(2)
      });
    }
    
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
  if (result.isPeak && result.confidence > 0.15) { // Kept lower threshold for better sensitivity
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // Log important peak information for measurement precision tracking
    if (Math.random() < 0.05) { // Only log occasionally
      console.log("Peak-detection: Pico detectado con precisión mejorada", {
        confianza: result.confidence.toFixed(2),
        valor: value.toFixed(3),
        tiempo: new Date(now).toISOString(),
        adaptiveThreshold: adaptiveThreshold.toFixed(3),
        signalQuality: signalQuality.toFixed(2),
        highPerformanceDevice: isHighPerformanceDevice,
        avgInterval: averageInterval ? averageInterval.toFixed(0) : 'N/A',
        individualSensitivity: individualSensitivity.toFixed(2)
      });
    }
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
  peakIntervals = [];
  averageInterval = 0;
  lastValidPeakTime = 0;
  lastDeviceCheck = 0;
  isHighPerformanceDevice = false;
  detectionSensitivity = 1.0;
  personSignatureBuffer = [];
  personSignatureAvg = 0;
  personSignatureVar = 0;
  lastSignatureUpdate = 0;
  individualSensitivity = 1.0;
  
  console.log("Peak detection reset - state cleared completely");
}
