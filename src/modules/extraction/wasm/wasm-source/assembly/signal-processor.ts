
/**
 * High-performance WebAssembly signal processor for biometric analysis
 * Assembly script source code that compiles to WebAssembly
 */

// Memory for signal processing
export const SIGNAL_BUFFER_SIZE: i32 = 2048;
export const RESULT_BUFFER_SIZE: i32 = 1024;

// Signal buffers
export const signalBuffer = new Float32Array(SIGNAL_BUFFER_SIZE);
export const resultBuffer = new Float32Array(RESULT_BUFFER_SIZE);

/**
 * Advanced IIR filter implementation (supports low-pass, high-pass, band-pass)
 * @param signalPtr Pointer to input signal
 * @param length Length of signal
 * @param filterType Type of filter (1=low-pass, 2=high-pass, 3=band-pass)
 * @param cutoffLow Low cutoff frequency (normalized 0-1)
 * @param cutoffHigh High cutoff frequency (normalized 0-1)
 * @param resonance Filter resonance (Q factor)
 * @returns Pointer to filtered signal
 */
export function advancedFilter(
  signalPtr: usize, 
  length: i32, 
  filterType: i32,
  cutoffLow: f32 = 0.1,
  cutoffHigh: f32 = 0.4,
  resonance: f32 = 1.0
): usize {
  // Restrict parameters to valid ranges
  cutoffLow = Math.max(0.001, Math.min(0.499, cutoffLow));
  cutoffHigh = Math.max(cutoffLow + 0.001, Math.min(0.499, cutoffHigh));
  resonance = Math.max(0.1, Math.min(10.0, resonance));
  
  // Copy signal to our buffer
  memory.copy(changetype<usize>(resultBuffer), signalPtr, length * 4);
  
  // IIR filter coefficients
  let a0: f32 = 0.0, a1: f32 = 0.0, a2: f32 = 0.0;
  let b0: f32 = 0.0, b1: f32 = 0.0, b2: f32 = 0.0;
  
  // Calculate filter coefficients based on type
  if (filterType == 1) {
    // Low-pass filter
    const omega: f32 = 2.0 * Math.PI * cutoffLow;
    const alpha: f32 = Math.sin(omega) / (2.0 * resonance);
    
    a0 = 1.0 + alpha;
    a1 = -2.0 * Math.cos(omega);
    a2 = 1.0 - alpha;
    b0 = (1.0 - Math.cos(omega)) / 2.0;
    b1 = 1.0 - Math.cos(omega);
    b2 = (1.0 - Math.cos(omega)) / 2.0;
  } else if (filterType == 2) {
    // High-pass filter
    const omega: f32 = 2.0 * Math.PI * cutoffLow;
    const alpha: f32 = Math.sin(omega) / (2.0 * resonance);
    
    a0 = 1.0 + alpha;
    a1 = -2.0 * Math.cos(omega);
    a2 = 1.0 - alpha;
    b0 = (1.0 + Math.cos(omega)) / 2.0;
    b1 = -(1.0 + Math.cos(omega));
    b2 = (1.0 + Math.cos(omega)) / 2.0;
  } else if (filterType == 3) {
    // Band-pass filter
    const omegaLow: f32 = 2.0 * Math.PI * cutoffLow;
    const omegaHigh: f32 = 2.0 * Math.PI * cutoffHigh;
    const bandwidth: f32 = omegaHigh - omegaLow;
    const centerFreq: f32 = (omegaLow + omegaHigh) / 2.0;
    const alpha: f32 = Math.sin(bandwidth) / (2.0 * resonance);
    
    a0 = 1.0 + alpha;
    a1 = -2.0 * Math.cos(centerFreq);
    a2 = 1.0 - alpha;
    b0 = alpha;
    b1 = 0.0;
    b2 = -alpha;
  }
  
  // Normalize coefficients
  b0 /= a0;
  b1 /= a0;
  b2 /= a0;
  a1 /= a0;
  a2 /= a0;
  
  // Apply filter
  let x1: f32 = 0.0, x2: f32 = 0.0;
  let y1: f32 = 0.0, y2: f32 = 0.0;
  
  for (let i = 0; i < length; i++) {
    const x0: f32 = unchecked(resultBuffer[i]);
    const y0: f32 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    
    unchecked(resultBuffer[i] = y0);
    
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  
  return changetype<usize>(resultBuffer);
}

/**
 * Adaptive peak detection algorithm
 * @param signalPtr Pointer to input signal
 * @param length Length of signal
 * @param adaptiveThreshold Whether to use adaptive thresholding
 * @param sensitivity Sensitivity for peak detection (0.0-1.0)
 * @returns Pointer to peak indices
 */
export function detectPeaks(
  signalPtr: usize, 
  length: i32,
  adaptiveThreshold: bool = true,
  sensitivity: f32 = 0.6
): usize {
  // Local signal buffer for calculations
  const signal = new Float32Array(length);
  memory.copy(changetype<usize>(signal), signalPtr, length * 4);
  
  // Result buffer structure:
  // [0] = number of peaks
  // [1..n] = peak indices
  const peakIndices = new Int32Array(length);
  let peakCount: i32 = 0;
  
  // Calculate adaptive threshold if requested
  let threshold: f32;
  if (adaptiveThreshold) {
    // Calculate signal statistics for adaptive threshold
    let min: f32 = signal[0];
    let max: f32 = signal[0];
    
    for (let i = 1; i < length; i++) {
      const val = signal[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    
    // Set threshold as percentage between min and max based on sensitivity
    threshold = min + (max - min) * sensitivity;
  } else {
    // Fixed threshold based on sensitivity (0.0-1.0)
    threshold = sensitivity;
  }
  
  // Detect peaks (local maxima above threshold)
  for (let i = 1; i < length - 1; i++) {
    const prev = signal[i-1];
    const curr = signal[i];
    const next = signal[i+1];
    
    // Check if current sample is a peak and above threshold
    if (curr > prev && curr > next && curr > threshold) {
      // Store peak index
      unchecked(peakIndices[peakCount + 1] = i);
      peakCount++;
      
      // Skip ahead to avoid multiple detections of the same peak
      i += 2;
    }
  }
  
  // Store peak count at the beginning of the result buffer
  unchecked(peakIndices[0] = peakCount);
  
  // Copy results to output buffer
  memory.copy(changetype<usize>(resultBuffer), changetype<usize>(peakIndices), (peakCount + 1) * 4);
  
  return changetype<usize>(resultBuffer);
}

/**
 * Calculate heart rate from peaks
 * @param peaksPtr Pointer to peak indices array (first element is count)
 * @param samplingRate Sampling rate in Hz
 * @returns Heart rate in BPM
 */
export function calculateHeartRate(peaksPtr: usize, samplingRate: f32): f32 {
  const peakIndices = new Int32Array(RESULT_BUFFER_SIZE);
  memory.copy(changetype<usize>(peakIndices), peaksPtr, RESULT_BUFFER_SIZE * 4);
  
  const peakCount = peakIndices[0];
  
  // Need at least 2 peaks to calculate heart rate
  if (peakCount < 2) {
    return 0.0;
  }
  
  // Calculate average interval between peaks
  let totalIntervals: f32 = 0.0;
  let validIntervals: i32 = 0;
  
  for (let i = 1; i < peakCount; i++) {
    const interval = peakIndices[i + 1] - peakIndices[i];
    
    // Only count reasonable intervals (filter outliers)
    if (interval > 0) {
      totalIntervals += f32(interval);
      validIntervals++;
    }
  }
  
  // Calculate average interval and convert to BPM
  if (validIntervals > 0) {
    const avgInterval = totalIntervals / f32(validIntervals);
    const intervalInSeconds = avgInterval / samplingRate;
    const heartRate = 60.0 / intervalInSeconds;
    
    // Return only physiologically plausible heart rates (40-220 BPM)
    return Math.max(40.0, Math.min(220.0, heartRate));
  }
  
  return 0.0;
}

/**
 * Fast Fourier Transform (FFT) for frequency analysis
 * @param signalPtr Pointer to input signal (must be power of 2 length)
 * @param length Length of signal (must be power of 2)
 * @returns Pointer to FFT result (complex values interleaved)
 */
export function calculateFFT(signalPtr: usize, length: i32): usize {
  // Ensure length is power of 2
  if ((length & (length - 1)) != 0) {
    // Not a power of 2, return error code
    unchecked(resultBuffer[0] = -1.0);
    return changetype<usize>(resultBuffer);
  }
  
  // Copy input signal to working buffer
  const real = new Float32Array(length);
  const imag = new Float32Array(length);
  memory.copy(changetype<usize>(real), signalPtr, length * 4);
  
  // Perform FFT (Cooley-Tukey algorithm)
  const logN = Math.log2(length);
  
  // Bit-reversal permutation
  for (let i = 0; i < length; i++) {
    let j = 0;
    for (let k = 0; k < logN; k++) {
      j = (j << 1) | ((i >> k) & 1);
    }
    if (j < i) {
      // Swap real[i] and real[j]
      const tempReal = real[i];
      real[i] = real[j];
      real[j] = tempReal;
    }
  }
  
  // Cooley-Tukey FFT
  for (let s = 1; s <= logN; s++) {
    const m = 1 << s; // 2^s
    const m2 = m >> 1; // m/2
    const wReal: f32 = Math.cos(-2.0 * Math.PI / f32(m));
    const wImag: f32 = Math.sin(-2.0 * Math.PI / f32(m));
    
    for (let k = 0; k < length; k += m) {
      let omegaReal: f32 = 1.0;
      let omegaImag: f32 = 0.0;
      
      for (let j = 0; j < m2; j++) {
        const t1Real = omegaReal * real[k + j + m2] - omegaImag * imag[k + j + m2];
        const t1Imag = omegaImag * real[k + j + m2] + omegaReal * imag[k + j + m2];
        
        const t2Real = real[k + j];
        const t2Imag = imag[k + j];
        
        real[k + j] = t2Real + t1Real;
        imag[k + j] = t2Imag + t1Imag;
        
        real[k + j + m2] = t2Real - t1Real;
        imag[k + j + m2] = t2Imag - t1Imag;
        
        // Update omega
        const nextOmegaReal = omegaReal * wReal - omegaImag * wImag;
        const nextOmegaImag = omegaImag * wReal + omegaReal * wImag;
        omegaReal = nextOmegaReal;
        omegaImag = nextOmegaImag;
      }
    }
  }
  
  // Calculate magnitude spectrum
  for (let i = 0; i < length; i++) {
    resultBuffer[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  return changetype<usize>(resultBuffer);
}

/**
 * Calculate signal quality metrics
 * @param signalPtr Pointer to input signal
 * @param length Length of signal
 * @returns Pointer to quality metrics array
 */
export function calculateSignalQuality(signalPtr: usize, length: i32): usize {
  // Copy signal to local buffer
  const signal = new Float32Array(length);
  memory.copy(changetype<usize>(signal), signalPtr, length * 4);
  
  // Calculate signal statistics
  let sum: f32 = 0.0;
  let sumSquared: f32 = 0.0;
  let min: f32 = signal[0];
  let max: f32 = signal[0];
  
  for (let i = 0; i < length; i++) {
    const val = signal[i];
    sum += val;
    sumSquared += val * val;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  const mean = sum / f32(length);
  const variance = sumSquared / f32(length) - mean * mean;
  const stdDev = Math.sqrt(variance);
  
  // Calculate signal-to-noise ratio (simple estimate)
  const range = max - min;
  const snr = range > 0 ? mean / stdDev : 0.0;
  
  // Calculate short-term variability by comparing adjacent samples
  let shortTermVariability: f32 = 0.0;
  for (let i = 1; i < length; i++) {
    shortTermVariability += Math.abs(signal[i] - signal[i-1]);
  }
  shortTermVariability /= f32(length - 1);
  
  // Calculate normalized short-term variability
  const normalizedSTVar = range > 0 ? shortTermVariability / range : 1.0;
  
  // Overall signal quality (0.0-1.0)
  const signalQuality = Math.max(0.0, Math.min(1.0, (1.0 - normalizedSTVar) * snr / 10.0));
  
  // Store results in buffer
  resultBuffer[0] = mean;
  resultBuffer[1] = stdDev;
  resultBuffer[2] = min;
  resultBuffer[3] = max;
  resultBuffer[4] = snr;
  resultBuffer[5] = shortTermVariability;
  resultBuffer[6] = signalQuality;
  
  return changetype<usize>(resultBuffer);
}
