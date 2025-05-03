/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para el registro y análisis de señales
 * Solo registra datos reales, sin simulación ni manipulación artificial
 */

/**
 * Actualiza el registro de señales, manteniendo un tamaño manejable
 * Solo registra datos reales
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Solo registrar cada X señales para no sobrecargar la memoria
  if (processedSignals % 30 !== 0) {
    return signalLog;
  }
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: {...result}
    }
  ];
  
  // Mantener el log a un tamaño manejable
  const trimmedLog = updatedLog.length > 40 ? updatedLog.slice(-40) : updatedLog;
  
  // Logging with real detection information
  const fingerDetected = result.fingerDetected ? "SI" : "NO";
  const quality = result.quality || 0;
  
  console.log(`SignalLog: Calidad: ${quality}, Dedo: ${fingerDetected}, Valor: ${Math.round(value)}`);
  
  return trimmedLog;
}

/**
 * Analiza un registro de señales para detectar falsos positivos
 * Solo utiliza datos reales, sin simulación
 * @param signalLog Registro de señales a analizar
 * @returns Información de análisis
 */
export function analyzeSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[]
): { falsePositives: number, stability: number } {
  const windowSize = Math.min(signalLog.length, 10); // Use last 10 samples or less
  if (windowSize < 2) return { falsePositives: 0, stability: 1.0 };

  const recentResults = signalLog.slice(-windowSize);
  let consistentPeaks = 0;
  let lastPeakTime = 0;
  let rrIntervals: number[] = [];
  let peakAmplitudes: number[] = [];
  let falsePositives: number = 0;

  recentResults.forEach(log => {
    if (log.result?.isPeak) {
      // Rounding timestamp - replace realRound with Math.round
      const currentPeakTime = Math.round(log.timestamp);
      if (lastPeakTime > 0) {
        const interval = currentPeakTime - lastPeakTime;
        if (interval > 0) { // Avoid zero or negative intervals
          rrIntervals.push(interval);
        }
      }
      lastPeakTime = currentPeakTime;
      // Use Math.abs instead of manual calculation if needed, or just ensure positive value
      peakAmplitudes.push(Math.abs(log.value)); 
    }
  });

  if (rrIntervals.length < 2) {
    return { falsePositives: 0, stability: 0.5 }; // Not enough intervals for stability analysis
  }

  // Stability Calculation (Example: based on RR interval consistency)
  const meanInterval = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  let sumSqDiff = 0;
  for (let i = 0; i < rrIntervals.length; i++) {
    // Power calculation - replace realPow with Math.pow
    sumSqDiff += Math.pow(rrIntervals[i] - meanInterval, 2);
  }
  const stdDev = Math.sqrt(sumSqDiff / rrIntervals.length);
  const coefficientOfVariation = meanInterval > 0 ? stdDev / meanInterval : 0;

  // Calculate stability score (inverse of variation, capped at 1)
  // Min/Max - replace realMin/realMax with Math.min/Math.max
  let stability = Math.max(0, 1 - coefficientOfVariation * 2); // Higher variation = lower stability
  stability = Math.min(1, stability);

  // False Positives (Example: peaks with very low amplitude compared to others)
  if (peakAmplitudes.length > 1) {
    const avgAmplitude = peakAmplitudes.reduce((s, v) => s + v, 0) / peakAmplitudes.length;
    const amplitudeThreshold = avgAmplitude * 0.3; // Example: peaks below 30% of average are suspect
    falsePositives = peakAmplitudes.filter(amp => amp < amplitudeThreshold).length;
  }

  return { falsePositives, stability };
}

// --- Funciones Matemáticas Reemplazadas ---
/*
function realRound(x: number): number { return (x % 1) >= 0.5 ? (x - (x % 1) + 1) : (x - (x % 1)); }
function realPow(base: number, exp: number): number { let result = 1; for (let i = 0; i < exp; i++) result *= base; return result; }
function realMax(a: number, b: number): number { return a > b ? a : b; }
function realMin(a: number, b: number): number { return a < b ? a : b; }
*/
