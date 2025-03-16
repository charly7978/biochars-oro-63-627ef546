
/**
 * Utilidades para análisis de intervalos RR y detección de arritmias
 * Extraídas para mantener el código más limpio y modular
 */

/**
 * Analiza intervalos RR para detectar posibles arritmias
 * MODIFICADO: Umbral drásticamente ajustado para reducir falsos positivos
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
  if (!rrData?.intervals || rrData.intervals.length < 7) { // Aumentado de 5 a 7
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }

  const lastSevenIntervals = rrData.intervals.slice(-7); // Aumentado de 5 a 7
  
  // Filtrar intervalos RR para eliminar valores extremos (posibles errores de detección)
  const filteredIntervals = lastSevenIntervals.filter(interval => 
    interval >= 600 && interval <= 1200 // Rango más restrictivo (antes 500-1500ms)
  );
  
  // Si después de filtrar no hay suficientes intervalos, no es posible analizar
  if (filteredIntervals.length < 5) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }
  
  const avgRR = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
  
  // Calculate RMSSD (Root Mean Square of Successive Differences) - más estricto
  let rmssd = 0;
  for (let i = 1; i < filteredIntervals.length; i++) {
    rmssd += Math.pow(filteredIntervals[i] - filteredIntervals[i-1], 2);
  }
  rmssd = Math.sqrt(rmssd / (filteredIntervals.length - 1));
  
  // Calculate additional metrics
  const lastRR = filteredIntervals[filteredIntervals.length - 1];
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Calculate standard deviation of intervals
  const rrSD = Math.sqrt(
    filteredIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    filteredIntervals.length
  );
  
  // MUCHO más restrictivo para evitar falsos positivos
  // Exigimos umbrales mucho más altos para considerar arritmia
  const hasArrhythmia = 
    (rmssd > 70 && rrVariation > 0.35) || // Antes: rmssd > 50, rrVariation > 0.20
    (rrSD > 50 && rrVariation > 0.30) ||  // Antes: rrSD > 35, rrVariation > 0.18
    (lastRR > 1.50 * avgRR) ||            // Antes: 1.35
    (lastRR < 0.6 * avgRR);               // Antes: 0.7
  
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
    condición1: analysisData.rmssd > 70 && analysisData.rrVariation > 0.35, // Actualizado
    condición2: analysisData.rrSD > 50 && analysisData.rrVariation > 0.30,  // Actualizado
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
