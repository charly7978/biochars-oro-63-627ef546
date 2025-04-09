
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate signal amplitude based on real peaks and valleys
 */
export function calculateAmplitude(
  signal: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (signal.length < 2 || peakIndices.length === 0 || valleyIndices.length === 0) {
    return Math.max(...signal) - Math.min(...signal);
  }

  const peakValues = peakIndices.map(idx => signal[idx]);
  const valleyValues = valleyIndices.map(idx => signal[idx]);
  
  const avgPeak = peakValues.reduce((sum, val) => sum + val, 0) / peakValues.length;
  const avgValley = valleyValues.reduce((sum, val) => sum + val, 0) / valleyValues.length;
  
  return avgPeak - avgValley;
}

/**
 * Find peaks and valleys in a real physiological signal
 */
export function findPeaksAndValleys(signal: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} {
  if (signal.length < 3) {
    return { peakIndices: [], valleyIndices: [] };
  }

  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  // Detect real peaks and valleys based on slope changes
  for (let i = 1; i < signal.length - 1; i++) {
    // Peak detection
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peakIndices.push(i);
    }
    // Valley detection
    else if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Calculate heart rate from peak intervals
 */
export function calculateHeartRateFromPeaks(
  peakIndices: number[],
  samplingRateHz: number = 25
): number {
  if (peakIndices.length < 2) {
    return 0;
  }
  
  // Calculate intervals between adjacent peaks
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(peakIndices[i] - peakIndices[i - 1]);
  }
  
  // Filter physiologically impossible intervals
  const validIntervals = intervals.filter(interval => 
    interval > samplingRateHz * 0.3 && interval < samplingRateHz * 2
  );
  
  if (validIntervals.length === 0) {
    return 0;
  }
  
  // Convert to heart rate
  const avgInterval = validIntervals.reduce((sum, interval) => sum + interval, 0) / validIntervals.length;
  const heartRate = 60 * samplingRateHz / avgInterval;
  
  return Math.round(heartRate);
}
