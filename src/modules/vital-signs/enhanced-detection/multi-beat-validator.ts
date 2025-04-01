
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Multi-beat sequence validation for heartbeat detection
 * Validates detected peaks by examining patterns across multiple beats
 */

/**
 * A result from multi-beat sequence validation
 */
export interface MultiBeatValidationResult {
  validatedPeaks: number[];
  confidence: number;
  regularity: number;
  expectedNextPeakInterval: number | null;
}

/**
 * Validates a sequence of detected peaks using multi-beat pattern analysis
 */
export function validateMultiBeatSequence(
  peakIndices: number[], 
  values: number[], 
  sampleRate: number = 30
): MultiBeatValidationResult {
  if (peakIndices.length < 3) {
    return {
      validatedPeaks: [...peakIndices],
      confidence: peakIndices.length > 0 ? 0.3 : 0,
      regularity: 0,
      expectedNextPeakInterval: null
    };
  }
  
  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(peakIndices[i] - peakIndices[i-1]);
  }
  
  // Calculate statistics of intervals
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const intervalStdDev = Math.sqrt(intervalVariance);
  
  // Calculate regularity as 1 - coefficient of variation
  // Higher values indicate more regular intervals
  const regularity = Math.max(0, Math.min(1, 1 - (intervalStdDev / avgInterval)));
  
  // Filter out peaks that create intervals outside an acceptable range
  const validatedPeaks: number[] = [peakIndices[0]]; // Always include the first peak
  
  for (let i = 1; i < peakIndices.length; i++) {
    const interval = peakIndices[i] - peakIndices[i-1];
    
    // Accept the peak if its interval is within 30% of the average interval
    // or if it's about twice the average (possibly a missed beat)
    if (Math.abs(interval - avgInterval) < 0.3 * avgInterval ||
        Math.abs(interval - 2 * avgInterval) < 0.3 * avgInterval) {
      validatedPeaks.push(peakIndices[i]);
    }
  }
  
  // Calculate heart rate in BPM from average interval
  const heartRateBPM = 60 * sampleRate / avgInterval;
  
  // Check if the heart rate is physiologically plausible
  let physiologicalConfidence = 0;
  if (heartRateBPM >= 40 && heartRateBPM <= 200) {
    // Higher confidence for heart rates in the normal range (60-100)
    if (heartRateBPM >= 60 && heartRateBPM <= 100) {
      physiologicalConfidence = 1.0;
    } else {
      // Linearly reduce confidence as we move away from normal range
      physiologicalConfidence = 0.7;
    }
  }
  
  // Check morphology of peaks (they should have similar shapes)
  let morphologyConfidence = 0;
  if (validatedPeaks.length >= 3) {
    const peakShapes: number[][] = [];
    
    // Extract small windows around each peak
    for (const peakIdx of validatedPeaks) {
      // Get 5 points centered at the peak (if available)
      const start = Math.max(0, peakIdx - 2);
      const end = Math.min(values.length - 1, peakIdx + 2);
      if (end - start + 1 === 5) {
        const shape = values.slice(start, end + 1);
        // Normalize shape
        const min = Math.min(...shape);
        const max = Math.max(...shape);
        const range = max - min;
        const normalizedShape = range > 0 ? 
          shape.map(v => (v - min) / range) : 
          shape.map(() => 0.5);
        
        peakShapes.push(normalizedShape);
      }
    }
    
    // Calculate average correlation between shapes
    let totalCorrelation = 0;
    let correlationCount = 0;
    
    for (let i = 0; i < peakShapes.length; i++) {
      for (let j = i + 1; j < peakShapes.length; j++) {
        const correlation = calculateCorrelation(peakShapes[i], peakShapes[j]);
        totalCorrelation += correlation;
        correlationCount++;
      }
    }
    
    morphologyConfidence = correlationCount > 0 ? 
      totalCorrelation / correlationCount : 0;
  }
  
  // Calculate overall confidence
  const confidence = (
    regularity * 0.5 + 
    physiologicalConfidence * 0.3 + 
    morphologyConfidence * 0.2
  );
  
  // Calculate expected time to next peak based on average interval
  const expectedNextPeakInterval = validatedPeaks.length > 0 ? avgInterval : null;
  
  return {
    validatedPeaks,
    confidence,
    regularity,
    expectedNextPeakInterval
  };
}

/**
 * Calculate correlation between two arrays
 */
function calculateCorrelation(array1: number[], array2: number[]): number {
  if (array1.length !== array2.length || array1.length === 0) {
    return 0;
  }
  
  const n = array1.length;
  
  // Calculate means
  const mean1 = array1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = array2.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate correlation
  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = array1[i] - mean1;
    const diff2 = array2[i] - mean2;
    
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }
  
  if (denom1 === 0 || denom2 === 0) {
    return 0;
  }
  
  return numerator / Math.sqrt(denom1 * denom2);
}
