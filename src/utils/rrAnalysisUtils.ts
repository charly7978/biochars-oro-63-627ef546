
/**
 * Utilidades para análisis de intervalos RR y detección de arritmias
 * Simplificado para detección directa, sin manipulación
 */

/**
 * Analiza intervalos RR para detectar latidos prematuros
 * Se enfoca solo en la variación natural del ritmo cardíaco
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

  const lastIntervals = rrData.intervals.slice(-5);
  
  // Calculamos información básica sobre los intervalos RR
  const avgRR = lastIntervals.reduce((a, b) => a + b, 0) / lastIntervals.length;
  const lastRR = lastIntervals[lastIntervals.length - 1];
  
  // Aumentamos el umbral de variación drásticamente para reducir falsos positivos
  // Un cambio mucho más drástico se requiere para ser considerado arritmia
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Calculate RMSSD (Root Mean Square of Successive Differences)
  let rmssd = 0;
  for (let i = 1; i < lastIntervals.length; i++) {
    rmssd += Math.pow(lastIntervals[i] - lastIntervals[i-1], 2);
  }
  rmssd = Math.sqrt(rmssd / (lastIntervals.length - 1));
  
  // Calculate standard deviation of intervals
  const rrSD = Math.sqrt(
    lastIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    lastIntervals.length
  );
  
  // Criterios extremadamente estrictos para la detección de latidos prematuros:
  // 1. El intervalo debe ser significativamente más corto (60% en lugar de 70%)
  // 2. La variación debe ser muchísimo mayor (35% en lugar de 25%)
  const isPremature = (lastRR < 0.60 * avgRR) || (rrVariation > 0.35);
  
  // Determine if this should increase the counter
  const shouldIncrementCounter = 
    isPremature && 
    (currentTime - lastArrhythmiaTime >= minTimeBetweenArrhythmias) &&
    (arrhythmiaCounter < maxArrhythmiasPerSession);
  
  return { 
    hasArrhythmia: isPremature, 
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
  console.log("useVitalSignsProcessor: Análisis directo RR", {
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
 * Registra mensajes de diagnóstico para latidos prematuros
 */
export function logPossibleArrhythmia(
  analysisData: { rmssd: number; rrVariation: number; rrSD: number },
): void {
  console.log("useVitalSignsProcessor: Latido prematuro detectado", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
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
  console.log("Latido prematuro confirmado:", {
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
  console.log("useVitalSignsProcessor: Latido prematuro detectado pero ignorado", {
    motivo: timeSinceLastArrhythmia < 1000 ? 
      "Demasiado pronto desde el último" : "Máximo número de latidos prematuros alcanzado",
    tiempoDesdeÚltima: timeSinceLastArrhythmia,
    máximoPermitido: maxArrhythmiasPerSession,
    contadorActual: currentCounter,
    timestamp: new Date().toISOString()
  });
}
