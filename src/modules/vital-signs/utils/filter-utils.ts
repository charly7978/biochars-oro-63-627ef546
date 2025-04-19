
/**
 * Utility functions for filtering PPG signals
 */

/**
 * Applies a bandpass filter to the signal
 * @param signal Input signal array
 * @param lowCut Low cutoff frequency
 * @param highCut High cutoff frequency
 * @param sampleRate Sample rate of the signal
 * @returns Filtered signal array
 */
export const applyBandpassFilter = (
  signal: number[],
  lowCut: number = 0.5,
  highCut: number = 8.0,
  sampleRate: number = 100
): number[] => {
  if (!signal || signal.length === 0) return [];
  
  // Simple implementation of bandpass filter
  const filteredSignal: number[] = [];
  const RC_low = 1.0 / (2.0 * Math.PI * lowCut);
  const RC_high = 1.0 / (2.0 * Math.PI * highCut);
  const dt = 1.0 / sampleRate;
  
  const alpha_low = dt / (RC_low + dt);
  const alpha_high = RC_high / (RC_high + dt);
  
  let lowPassOutput = signal[0];
  
  for (let i = 0; i < signal.length; i++) {
    // Low-pass
    lowPassOutput = lowPassOutput + alpha_low * (signal[i] - lowPassOutput);
    
    // High-pass (if not first sample)
    if (i > 0) {
      const highPassOutput = alpha_high * (filteredSignal[i-1] + signal[i] - signal[i-1]);
      filteredSignal.push(highPassOutput);
    } else {
      filteredSignal.push(lowPassOutput);
    }
  }
  
  return filteredSignal;
};

/**
 * Applies a lowpass filter to the signal
 * @param signal Input signal array
 * @param cutoff Cutoff frequency
 * @param sampleRate Sample rate of the signal
 * @returns Filtered signal array
 */
export const applyLowpassFilter = (
  signal: number[],
  cutoff: number = 5.0,
  sampleRate: number = 100
): number[] => {
  if (!signal || signal.length === 0) return [];
  
  // Simple implementation of lowpass filter
  const filteredSignal: number[] = [];
  const RC = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (RC + dt);
  
  filteredSignal.push(signal[0]);
  
  for (let i = 1; i < signal.length; i++) {
    const newValue = filteredSignal[i-1] + alpha * (signal[i] - filteredSignal[i-1]);
    filteredSignal.push(newValue);
  }
  
  return filteredSignal;
};

/**
 * Applies a highpass filter to the signal
 * @param signal Input signal array
 * @param cutoff Cutoff frequency
 * @param sampleRate Sample rate of the signal
 * @returns Filtered signal array
 */
export const applyHighpassFilter = (
  signal: number[],
  cutoff: number = 0.5,
  sampleRate: number = 100
): number[] => {
  if (!signal || signal.length === 0) return [];
  
  // Simple implementation of highpass filter
  const filteredSignal: number[] = [];
  const RC = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = RC / (RC + dt);
  
  filteredSignal.push(signal[0]);
  
  for (let i = 1; i < signal.length; i++) {
    const newValue = alpha * (filteredSignal[i-1] + signal[i] - signal[i-1]);
    filteredSignal.push(newValue);
  }
  
  return filteredSignal;
};
