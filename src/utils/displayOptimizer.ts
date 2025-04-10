
/**
 * Helper functions for optimizing display in PPG signal visualization
 */

/**
 * Get the appropriate color for signal path based on arrhythmia status
 */
export function getSignalColor(isArrhythmia: boolean): string {
  return isArrhythmia ? '#DC2626' : '#0EA5E9';
}

/**
 * Check if a point is within an arrhythmia window
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  return arrhythmiaWindows.some(window => {
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}

/**
 * Optimize canvas for device pixel ratio
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

/**
 * Optimize HTML element for better rendering
 */
export function optimizeElement(element: HTMLElement): void {
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
}

/**
 * Check if the current device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Calculate cardiac metrics from PPG data
 */
export function calculateCardiacMetrics(
  ppgData: { time: number; value: number; isPeak: boolean; isArrhythmia?: boolean }[],
  currentBPM: number,
  quality: number
): {
  bpm: number;
  confidence: number;
  rrVariability: number;
  rrIntervalAvg: number;
  rrIntervalMin: number;
  rrIntervalMax: number;
  waveformAmplitude: number;
  qualityScore: number;
  arrhythmiaCount: number;
} {
  // Filter only peak points
  const peaks = ppgData.filter(point => point.isPeak);
  
  // Calculate RR intervals
  const rrIntervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i].time - peaks[i - 1].time;
    if (interval > 300 && interval < 2000) { // Physiologically plausible values
      rrIntervals.push(interval);
    }
  }
  
  // Calculate metrics
  const arrhythmiaCount = peaks.filter(peak => peak.isArrhythmia).length;
  
  const rrIntervalAvg = rrIntervals.length > 0 
    ? rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length 
    : 0;
    
  const rrIntervalMin = rrIntervals.length > 0 
    ? Math.min(...rrIntervals) 
    : 0;
    
  const rrIntervalMax = rrIntervals.length > 0 
    ? Math.max(...rrIntervals) 
    : 0;
  
  // Calculate RMSSD (Root Mean Square of Successive Differences) for heart rate variability
  let rmssd = 0;
  if (rrIntervals.length > 1) {
    let squaredDiffSum = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i - 1];
      squaredDiffSum += diff * diff;
    }
    rmssd = Math.sqrt(squaredDiffSum / (rrIntervals.length - 1));
  }
  
  // Calculate waveform amplitude
  let amplitude = 0;
  if (ppgData.length > 10) {
    const sortedValues = [...ppgData].sort((a, b) => a.value - b.value);
    const p95 = sortedValues[Math.floor(sortedValues.length * 0.95)].value;
    const p5 = sortedValues[Math.floor(sortedValues.length * 0.05)].value;
    amplitude = p95 - p5;
  }
  
  // Calculate confidence based on data quality
  const confidence = Math.min(0.95, quality / 100);
  
  return {
    bpm: currentBPM,
    confidence,
    rrVariability: rmssd,
    rrIntervalAvg,
    rrIntervalMin,
    rrIntervalMax,
    waveformAmplitude: amplitude,
    qualityScore: quality,
    arrhythmiaCount
  };
}

/**
 * Format RR interval in milliseconds to a readable string
 */
export function formatRRInterval(ms: number): string {
  return ms ? `${ms.toFixed(0)} ms` : 'N/A';
}

/**
 * Format BPM value to a readable string
 */
export function formatBPM(bpm: number): string {
  return bpm ? `${bpm.toFixed(0)} BPM` : 'N/A';
}

/**
 * Get a descriptive text for heart rate variability
 */
export function getHRVDescription(rmssd: number): string {
  if (rmssd === 0) return 'No disponible';
  if (rmssd < 20) return 'Baja (estrés alto)';
  if (rmssd < 50) return 'Normal';
  return 'Alta (buena recuperación)';
}

/**
 * Get a descriptive text for signal quality
 */
export function getQualityDescription(quality: number): string {
  if (quality > 80) return 'Excelente';
  if (quality > 60) return 'Buena';
  if (quality > 40) return 'Aceptable';
  return 'Baja';
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
