
/**
 * Utilidades para análisis de intervalos RR y detección de arritmias
 * Extraídas para mantener el código más limpio y modular
 */

/**
 * Analiza intervalos RR para detectar posibles arritmias
 * MODIFICADO: Umbral ajustado para reducir sensibilidad
 */
export function analyzeRRIntervals(
  rrData: { intervals: number[] } | undefined,
  currentTime: number,
  lastArrhythmiaTime: number,
  arrhythmiaCounter: number,
  minTimeBetweenArrhythmias: number,
  maxArrhythmiasPerSession: number
): {
  hasArrhythmia: boolean;
  shouldIncrementCounter: boolean;
  analysisData?: {
    rmssd: number;
    rrVariation: number;
    lastRR: number;
    avgRR: number;
    rrSD: number;
  };
} {
  if (!rrData?.intervals || rrData.intervals.length < 5) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }

  const lastFiveIntervals = rrData.intervals.slice(-5); // Aumentado de 3 a 5 para más estabilidad
  const avgRR = lastFiveIntervals.reduce((a, b) => a + b, 0) / lastFiveIntervals.length;
  
  // Calculate RMSSD (Root Mean Square of Successive Differences)
  let rmssd = 0;
  for (let i = 1; i < lastFiveIntervals.length; i++) {
    rmssd += Math.pow(lastFiveIntervals[i] - lastFiveIntervals[i-1], 2);
  }
  rmssd = Math.sqrt(rmssd / (lastFiveIntervals.length - 1));
  
  // Calculate additional metrics
  const lastRR = lastFiveIntervals[lastFiveIntervals.length - 1];
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Calculate standard deviation of intervals
  const rrSD = Math.sqrt(
    lastFiveIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    lastFiveIntervals.length
  );
  
  // Multi-parametric arrhythmia detection conditions - AJUSTADO: umbrales menos sensibles
  const hasArrhythmia = 
    (rmssd > 65 && rrVariation > 0.25) || // Antes: rmssd > 50, rrVariation > 0.20
    (rrSD > 45 && rrVariation > 0.28) ||  // Antes: rrSD > 35, rrVariation > 0.18
    (lastRR > 1.6 * avgRR) ||             // Antes: 1.4
    (lastRR < 0.55 * avgRR);              // Antes: 0.6
  
  // Determine if this should increase the counter
  const shouldIncrementCounter = 
    hasArrhythmia && 
    (currentTime - lastArrhythmiaTime >= minTimeBetweenArrhythmias) &&
    (arrhythmiaCounter < maxArrhythmiasPerSession);
  
  return { 
    hasArrhythmia, 
    shouldIncrementCounter,
    analysisData: { rmssd, rrVariation, lastRR, avgRR, rrSD }
  };
}

/**
 * Registra mensajes de diagnóstico para análisis RR
 */
export function logRRAnalysis(
  analysisData: { rmssd: number; rrVariation: number; rrSD: number; lastRR: number; avgRR: number },
  lastThreeIntervals: number[]
): void {
  console.log("useVitalSignsProcessor: Análisis avanzado RR", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    lastRR: analysisData.lastRR,
    avgRR: analysisData.avgRR,
    lastThreeIntervals,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registra mensajes de diagnóstico para posibles arritmias
 */
export function logPossibleArrhythmia(
  analysisData: { rmssd: number; rrVariation: number; rrSD: number },
): void {
  console.log("useVitalSignsProcessor: Posible arritmia detectada", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    condición1: analysisData.rmssd > 50 && analysisData.rrVariation > 0.20,
    condición2: analysisData.rrSD > 35 && analysisData.rrVariation > 0.18,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registra mensajes de diagnóstico para arritmias confirmadas
 */
export function logConfirmedArrhythmia(
  analysisData: { rmssd: number; rrVariation: number; rrSD: number; lastRR: number; avgRR: number },
  lastThreeIntervals: number[],
  counter: number
): void {
  console.log("Arritmia confirmada:", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    lastRR: analysisData.lastRR,
    avgRR: analysisData.avgRR,
    intervals: lastThreeIntervals,
    counter,
    timestamp: new Date().toISOString()
  });
}

/**
 * Registra mensajes de diagnóstico para arritmias ignoradas
 */
export function logIgnoredArrhythmia(
  timeSinceLastArrhythmia: number,
  maxArrhythmiasPerSession: number,
  currentCounter: number
): void {
  console.log("useVitalSignsProcessor: Arritmia detectada pero ignorada", {
    motivo: timeSinceLastArrhythmia < 1000 ? 
      "Demasiado pronto desde la última" : "Máximo número de arritmias alcanzado",
    tiempoDesdeÚltima: timeSinceLastArrhythmia,
    máximoPermitido: maxArrhythmiasPerSession,
    contadorActual: currentCounter,
    timestamp: new Date().toISOString()
  });
}
