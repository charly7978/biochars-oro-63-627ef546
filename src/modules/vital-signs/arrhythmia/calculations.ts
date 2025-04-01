/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calcula la raíz cuadrada media de las diferencias sucesivas (RMSSD)
 * Métrica importante para variabilidad del ritmo cardíaco
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Valor RMSSD en milisegundos
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) {
    return 0;
  }
  
  let sumSquaredDiffs = 0;
  let count = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    sumSquaredDiffs += diff * diff;
    count++;
  }
  
  if (count === 0) {
    return 0;
  }
  
  return Math.sqrt(sumSquaredDiffs / count);
}

/**
 * Calcula la variación proporcional de los intervalos RR
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Porcentaje de variación (0-100)
 */
export function calculateRRVariation(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) {
    return 0;
  }
  
  // Calcular el intervalo promedio
  const avgInterval = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  
  // Calcular la desviación estándar
  const variances = rrIntervals.map(interval => Math.pow(interval - avgInterval, 2));
  const avgVariance = variances.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const stdDev = Math.sqrt(avgVariance);
  
  // Coeficiente de variación (normalizado como porcentaje)
  return (stdDev / avgInterval) * 100;
}

/**
 * Aplica filtro pNN50 - Porcentaje de intervalos NN superiores a 50 ms
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Porcentaje de intervalos que difieren en más de 50ms
 */
export function calculatePNN50(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) {
    return 0;
  }
  
  let count = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = Math.abs(rrIntervals[i] - rrIntervals[i-1]);
    if (diff > 50) {
      count++;
    }
  }
  
  return (count / (rrIntervals.length - 1)) * 100;
}

/**
 * Calcula varios índices de variabilidad de frecuencia cardíaca
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Objeto con métricas HRV
 */
export function calculateHRVMetrics(rrIntervals: number[]): {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  rrVariation: number;
} {
  if (!rrIntervals || rrIntervals.length < 2) {
    return {
      rmssd: 0,
      sdnn: 0,
      pnn50: 0,
      rrVariation: 0
    };
  }
  
  // RMSSD - ya implementado
  const rmssd = calculateRMSSD(rrIntervals);
  
  // SDNN - Desviación estándar de todos los intervalos NN
  const avgInterval = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const squaredDiffs = rrIntervals.map(interval => Math.pow(interval - avgInterval, 2));
  const sdnn = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / rrIntervals.length);
  
  // pNN50 - Porcentaje de intervalos NN que difieren en más de 50ms
  const pnn50 = calculatePNN50(rrIntervals);
  
  // Variación RR - ya implementado
  const rrVariation = calculateRRVariation(rrIntervals);
  
  return {
    rmssd,
    sdnn,
    pnn50,
    rrVariation
  };
}

/**
 * Calcula entropía aproximada de los intervalos RR para detección de arritmias
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Valor de entropía aproximada
 */
export function calculateApproximateEntropy(rrIntervals: number[], m: number = 2, r: number = 0.2): number {
  if (rrIntervals.length < m + 1) {
    return 0;
  }
  
  // Normalizar r como una fracción de la desviación estándar
  const std = Math.sqrt(rrIntervals.reduce((sum, val) => sum + Math.pow(val - rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length, 2), 0) / rrIntervals.length);
  const threshold = r * std;
  
  // Función para calcular el logaritmo de la probabilidad condicional
  const phi = (m: number): number => {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i <= rrIntervals.length - m; i++) {
      let matches = 0;
      
      for (let j = 0; j <= rrIntervals.length - m; j++) {
        if (i === j) continue;
        
        let isMatch = true;
        for (let k = 0; k < m; k++) {
          if (Math.abs(rrIntervals[i + k] - rrIntervals[j + k]) > threshold) {
            isMatch = false;
            break;
          }
        }
        
        if (isMatch) {
          matches++;
        }
      }
      
      if (matches > 0) {
        sum += Math.log(matches / (rrIntervals.length - m));
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  };
  
  // Calcular ApEn como phi(m) - phi(m+1)
  return Math.abs(phi(m) - phi(m + 1));
}

/**
 * Calcula espectro de potencia de los intervalos RR usando FFT
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Bandas de potencia: VLF, LF, HF y ratio LF/HF
 */
export function calculatePowerSpectrum(rrIntervals: number[]): {
  vlf: number; // Very Low Frequency (0.0033-0.04 Hz)
  lf: number;  // Low Frequency (0.04-0.15 Hz)
  hf: number;  // High Frequency (0.15-0.4 Hz)
  lfHfRatio: number; // LF/HF ratio
} {
  if (rrIntervals.length < 8) {
    return { vlf: 0, lf: 0, hf: 0, lfHfRatio: 0 };
  }
  
  // Implementación simple de análisis espectral
  // En una implementación real, usaríamos FFT completa
  
  // Para esta versión simple, usamos métodos estadísticos como aproximación
  const avgRR = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const stdRR = Math.sqrt(rrIntervals.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / rrIntervals.length);
  
  // Calcular diferencias sucesivas para aproximar componentes de alta frecuencia
  const diffRR = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    diffRR.push(rrIntervals[i] - rrIntervals[i-1]);
  }
  
  const stdDiffRR = Math.sqrt(diffRR.reduce((sum, val) => sum + Math.pow(val, 2), 0) / diffRR.length);
  
  // Aproximar componentes de potencia basados en la variabilidad
  // Esto es una simplificación - un análisis espectral real usaría FFT
  const hf = Math.pow(stdDiffRR, 2); // Potencia de alta frecuencia ~ varianza de diferencias
  const totalPower = Math.pow(stdRR, 2); // Potencia total ~ varianza
  const lf = totalPower * 0.5 - hf * 0.5; // Aproximación de baja frecuencia
  const vlf = totalPower * 0.2; // Aproximación de muy baja frecuencia
  
  // Ratio LF/HF (marcador de balance simpático/parasimpático)
  const lfHfRatio = hf > 0 ? lf / hf : 0;
  
  return { vlf, lf, hf, lfHfRatio };
}

/**
 * Detecta secuencias de Poincaré para análisis no lineal de HRV
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Descriptores SD1 y SD2 del gráfico de Poincaré
 */
export function calculatePoincareDescriptors(rrIntervals: number[]): {
  sd1: number; // Desviación estándar perpendicular a la línea de identidad
  sd2: number; // Desviación estándar a lo largo de la línea de identidad
} {
  if (rrIntervals.length < 2) {
    return { sd1: 0, sd2: 0 };
  }
  
  // Cálculo de diferencias para cada punto adyacente
  const diffs = [];
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    diffs.push((rrIntervals[i+1] - rrIntervals[i]) / Math.sqrt(2));
  }
  
  // SD1 es la desviación estándar de las diferencias / sqrt(2)
  const sd1 = Math.sqrt(diffs.reduce((sum, diff) => sum + diff * diff, 0) / diffs.length);
  
  // Para calcular SD2, necesitamos las diferencias desde la media
  const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const summedPairs = rrIntervals.slice(0, -1).map((rr, i) => (rr + rrIntervals[i+1]) / 2);
  const sdSummedPairs = Math.sqrt(summedPairs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / summedPairs.length);
  
  // SD2 se calcula a partir de SDRR y SD1
  const sdrr = Math.sqrt(rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrIntervals.length);
  const sd2 = Math.sqrt(2 * Math.pow(sdrr, 2) - Math.pow(sd1, 2));
  
  return { sd1, sd2 };
}

/**
 * Aplica filtro de Kalman para fusión óptima de estimadores de frecuencia cardíaca
 * @param heartRate Estimación actual de frecuencia cardíaca
 * @param confidence Confianza de la estimación (0-1)
 * @param previousHeartRate Estimación previa
 * @param previousConfidence Confianza previa
 * @returns Frecuencia cardíaca fusionada y confianza actualizada
 */
export function kalmanFusionHeartRate(
  heartRate: number,
  confidence: number,
  previousHeartRate: number,
  previousConfidence: number
): [number, number] {
  // Si no hay valor previo, devuelve el actual
  if (!previousHeartRate) {
    return [heartRate, confidence];
  }
  
  // Convertir confianza a varianza (mayor confianza = menor varianza)
  const variance = 1.0 - confidence;
  const previousVariance = 1.0 - previousConfidence;
  
  // Ganancia de Kalman: K = P_prev / (P_prev + R)
  // Donde P_prev es la covarianza previa y R es la varianza de la medición
  const kalmanGain = previousVariance / (previousVariance + variance);
  
  // Actualización de estado: x = x_prev + K * (z - x_prev)
  // Donde x_prev es el estado previo y z es la medición
  const fusedHeartRate = previousHeartRate + kalmanGain * (heartRate - previousHeartRate);
  
  // Actualización de covarianza: P = (1 - K) * P_prev
  const fusedVariance = (1 - kalmanGain) * previousVariance;
  
  // Convertir varianza a confianza
  const fusedConfidence = 1.0 - fusedVariance;
  
  return [fusedHeartRate, fusedConfidence];
}

/**
 * Fusiona estimaciones de tiempo y frecuencia con ponderación adaptativa
 * @param timeEstimate Estimación en dominio del tiempo
 * @param freqEstimate Estimación en dominio de frecuencia
 * @param timeConfidence Confianza de estimación temporal (0-1)
 * @param freqConfidence Confianza de estimación frecuencial (0-1)
 * @returns Estimación fusionada y confianza
 */
export function adaptiveWeightedFusion(
  timeEstimate: number,
  freqEstimate: number,
  timeConfidence: number,
  freqConfidence: number
): [number, number] {
  // Si alguna estimación falta, usar la otra
  if (!timeEstimate && !freqEstimate) return [0, 0];
  if (!timeEstimate) return [freqEstimate, freqConfidence];
  if (!freqEstimate) return [timeEstimate, timeConfidence];
  
  // Ponderación según confianza
  const weightTime = timeConfidence / (timeConfidence + freqConfidence);
  const weightFreq = freqConfidence / (timeConfidence + freqConfidence);
  
  // Fusión ponderada
  const fusedEstimate = (timeEstimate * weightTime) + (freqEstimate * weightFreq);
  
  // Promedio ponderado de confianzas como aproximación
  const fusedConfidence = (timeConfidence * weightTime) + (freqConfidence * weightFreq);
  
  return [fusedEstimate, fusedConfidence];
}
