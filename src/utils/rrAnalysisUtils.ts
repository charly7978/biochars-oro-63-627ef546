
/**
 * Utilidades para análisis de intervalos RR y detección de arritmias
 * Algoritmo ultra conservador para minimizar falsos positivos
 */

/**
 * Analiza intervalos RR para detectar latidos prematuros
 * Usando un algoritmo extremadamente conservador
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
  // Requerimos al menos 15 intervalos para análisis (mayor estabilidad)
  if (!rrData?.intervals || rrData.intervals.length < 15) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }

  // Tomamos solo los últimos 15 intervalos para el análisis
  const lastIntervals = rrData.intervals.slice(-15);
  
  // Filtramos intervalos extremos que pueden ser errores de medición
  // Solo consideramos intervalos entre 600ms (100 BPM) y 1200ms (50 BPM)
  const validIntervals = lastIntervals.filter(interval => interval >= 600 && interval <= 1200);
  
  // Si perdemos más del 30% de los intervalos, la calidad es mala
  if (validIntervals.length < lastIntervals.length * 0.7) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }
  
  // Calculamos información básica sobre los intervalos RR
  const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
  const lastRR = validIntervals[validIntervals.length - 1];
  
  // Establecemos un umbral extremadamente alto para la variación
  // Un latido prematuro genuino suele tener una variación del 75-80%
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Calculate RMSSD (Root Mean Square of Successive Differences)
  let rmssd = 0;
  for (let i = 1; i < validIntervals.length; i++) {
    rmssd += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
  }
  rmssd = Math.sqrt(rmssd / (validIntervals.length - 1));
  
  // Calculate standard deviation of intervals
  const rrSD = Math.sqrt(
    validIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    validIntervals.length
  );
  
  // Criterios ultra conservadores para la detección:
  // 1. El intervalo debe ser extremadamente corto (40% menos que el promedio)
  // 2. La variación debe ser enorme (más del 65%)
  // 3. La RMSSD debe ser mayor a 300ms (extremadamente variable)
  const isPremature = 
    (lastRR < 0.4 * avgRR) &&  // Intervalo extremadamente corto
    (rrVariation > 0.65) &&    // Variación extrema
    (rmssd > 300);             // Variabilidad muy alta
  
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
  console.log("useVitalSignsProcessor: Posible latido prematuro detectado", {
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
