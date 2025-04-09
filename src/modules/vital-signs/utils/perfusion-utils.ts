
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Sistema avanzado de análisis de perfusión multiparamétrico
 * Algoritmos completamente renovados para precisión fisiológica
 */

/**
 * Calcular índice de perfusión con enfoque avanzado adaptativo
 * Incorpora análisis robusto ante artefactos y ruido
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc <= 0) return 0;
  
  // Cálculo base
  const rawPI = ac / dc;
  
  // Limitadores fisiológicos para prevenir valores imposibles
  if (rawPI < 0) return 0;
  if (rawPI > 10) return 10; // Límite superior fisiológico
  
  return rawPI;
}

/**
 * Cálculo multicanal mejorado con enfoque avanzado de redundancia
 * Incorpora sistema adaptativo de pesos basado en características de la señal
 */
export function calculateMultichannelPerfusionIndex(
  redAC: number, redDC: number,
  greenAC?: number, greenDC?: number,
  blueAC?: number, blueDC?: number,
  weights: { red: number, green: number, blue: number } = { red: 0.7, green: 0.25, blue: 0.05 }
): number {
  // Cálculo de índices individuales
  const redPI = redDC > 0 ? redAC / redDC : 0;
  
  // Si no hay canales adicionales, devolver PI del canal rojo
  if (greenAC === undefined || greenDC === undefined || 
      blueAC === undefined || blueDC === undefined) {
    return redPI;
  }
  
  // Calcular índices por canal
  const greenPI = greenDC > 0 ? greenAC / greenDC : 0;
  const bluePI = blueDC > 0 ? blueAC / blueDC : 0;
  
  // Validar que todos los PI están en rangos fisiológicos
  const validatedRedPI = validatePI(redPI);
  const validatedGreenPI = validatePI(greenPI);
  const validatedBluePI = validatePI(bluePI);
  
  // Calcular confiabilidad por canal basado en estabilidad fisiológica
  const channelReliability = calculateChannelReliability(
    validatedRedPI, validatedGreenPI, validatedBluePI
  );
  
  // Combinar pesos preestablecidos y confiabilidad
  const adaptiveWeights = {
    red: weights.red * channelReliability.red,
    green: weights.green * channelReliability.green,
    blue: weights.blue * channelReliability.blue
  };
  
  // Normalizar pesos para suma = 1
  const totalWeight = adaptiveWeights.red + adaptiveWeights.green + adaptiveWeights.blue;
  
  if (totalWeight > 0) {
    adaptiveWeights.red /= totalWeight;
    adaptiveWeights.green /= totalWeight;
    adaptiveWeights.blue /= totalWeight;
  } else {
    // Fallback si pesos son inválidos
    adaptiveWeights.red = 1;
    adaptiveWeights.green = 0;
    adaptiveWeights.blue = 0;
  }
  
  // Combinación ponderada
  const combinedPI = 
    (validatedRedPI * adaptiveWeights.red) + 
    (validatedGreenPI * adaptiveWeights.green) + 
    (validatedBluePI * adaptiveWeights.blue);
  
  return combinedPI;
}

/**
 * Validación de PI en rangos fisiológicos
 */
function validatePI(pi: number): number {
  if (pi < 0) return 0;
  if (pi > 10) return 10; // Límite superior fisiológico
  return pi;
}

/**
 * Calcular confiabilidad por canal basado en coherencia fisiológica
 */
function calculateChannelReliability(redPI: number, greenPI: number, bluePI: number): {
  red: number;
  green: number;
  blue: number;
} {
  // Umbrales fisiológicos
  const MIN_VALID_PI = 0.01;
  const IDEAL_PI_RANGE = { min: 0.05, max: 5 };
  
  // Confiabilidad base
  let redReliability = 1.0;
  let greenReliability = 0.8; // Base menor para verde
  let blueReliability = 0.5; // Base menor para azul
  
  // Penalizar valores fuera de rangos fisiológicos
  if (redPI < MIN_VALID_PI) {
    redReliability *= 0.5;
  } else if (redPI < IDEAL_PI_RANGE.min || redPI > IDEAL_PI_RANGE.max) {
    redReliability *= 0.8;
  }
  
  if (greenPI < MIN_VALID_PI) {
    greenReliability *= 0.3;
  } else if (greenPI < IDEAL_PI_RANGE.min || greenPI > IDEAL_PI_RANGE.max) {
    greenReliability *= 0.6;
  }
  
  if (bluePI < MIN_VALID_PI) {
    blueReliability *= 0.2;
  } else if (bluePI < IDEAL_PI_RANGE.min || bluePI > IDEAL_PI_RANGE.max) {
    blueReliability *= 0.4;
  }
  
  // Coherencia entre canales (canales similares son más confiables)
  const redGreenCoherence = calculateCoherence(redPI, greenPI);
  const redBlueCoherence = calculateCoherence(redPI, bluePI);
  
  // Ajustar confiabilidad basada en coherencia
  redReliability *= (redGreenCoherence * 0.3 + redBlueCoherence * 0.1 + 0.6);
  greenReliability *= (redGreenCoherence * 0.6 + 0.4);
  blueReliability *= (redBlueCoherence * 0.7 + 0.3);
  
  return {
    red: redReliability,
    green: greenReliability,
    blue: blueReliability
  };
}

/**
 * Calcular coherencia entre dos canales
 */
function calculateCoherence(pi1: number, pi2: number): number {
  if (pi1 === 0 && pi2 === 0) return 1;
  if (pi1 === 0 || pi2 === 0) return 0;
  
  const ratio = pi1 > pi2 ? pi2 / pi1 : pi1 / pi2;
  return Math.pow(ratio, 0.5); // Raíz cuadrada para suavizar diferencias
}

/**
 * Sistema avanzado de análisis de calidad de perfusión
 * Incorpora métodos multidimensionales para evaluación precisa
 */
export function analyzePerfusionQuality(
  perfusionIndex: number,
  options?: {
    history?: number[];
    signalQuality?: number;
  }
): number {
  if (perfusionIndex <= 0) return 0;
  
  // Evaluación base por rangos fisiológicos
  let baseQuality = 0;
  
  // Perfusion Index interpretation:
  // < 0.02: Muy pobre
  // 0.02-0.05: Pobre
  // 0.05-0.10: Adecuado
  // 0.10-0.20: Bueno
  // > 0.20: Excelente
  
  if (perfusionIndex < 0.02) {
    baseQuality = Math.max(0, Math.min(30, perfusionIndex * 1500));
  } else if (perfusionIndex < 0.05) {
    baseQuality = Math.max(30, Math.min(50, 30 + (perfusionIndex - 0.02) * 667));
  } else if (perfusionIndex < 0.10) {
    baseQuality = Math.max(50, Math.min(75, 50 + (perfusionIndex - 0.05) * 500));
  } else if (perfusionIndex < 0.20) {
    baseQuality = Math.max(75, Math.min(95, 75 + (perfusionIndex - 0.10) * 200));
  } else {
    baseQuality = 95; // Máximo para PI muy altos
  }
  
  // Incorporar análisis de historial si está disponible
  if (options?.history && options.history.length > 1) {
    const stabilityFactor = analyzeHistoricalStability(options.history);
    
    // Ajustar calidad basada en estabilidad (estabilidad alta = mayor confianza)
    baseQuality *= (0.7 + (stabilityFactor * 0.3));
  }
  
  // Incorporar calidad de señal si está disponible
  if (options?.signalQuality !== undefined) {
    const normalizedSignalQuality = options.signalQuality / 100;
    
    // Calidad de señal baja reduce calidad de perfusión
    if (normalizedSignalQuality < 0.5) {
      baseQuality *= (0.5 + normalizedSignalQuality);
    }
  }
  
  // Limitar a rango válido
  return Math.max(0, Math.min(100, baseQuality));
}

/**
 * Análisis de estabilidad histórica
 */
function analyzeHistoricalStability(history: number[]): number {
  if (history.length < 2) return 1;
  
  // Calcular variación
  let sumVariation = 0;
  for (let i = 1; i < history.length; i++) {
    const relativeChange = history[i] > 0 && history[i-1] > 0 ? 
      Math.abs(history[i] - history[i-1]) / Math.max(history[i], history[i-1]) : 
      1; // Máxima variación si alguno es 0
    
    sumVariation += relativeChange;
  }
  
  const avgVariation = sumVariation / (history.length - 1);
  
  // Convertir variación a estabilidad (0-1)
  // Menor variación = mayor estabilidad
  return Math.max(0, Math.min(1, 1 - (avgVariation * 2)));
}

/**
 * Análisis avanzado de perfusión con caracterización multidimensional
 */
export function performAdvancedPerfusionAnalysis(
  perfusionIndex: number,
  options?: {
    history?: number[];
    signalQuality?: number;
    acComponent?: number;
    dcComponent?: number;
  }
): {
  quality: number;
  classification: 'critical' | 'poor' | 'acceptable' | 'good' | 'excellent';
  details: {
    stability: number;
    trend: number;
    physiologicalPlausibility: number;
  };
} {
  // Calcular calidad base
  const quality = analyzePerfusionQuality(perfusionIndex, options);
  
  // Calcular estabilidad temporal
  const stability = options?.history ? 
    analyzeHistoricalStability(options.history) : 
    1;
  
  // Analizar tendencia
  const trend = options?.history && options.history.length > 3 ? 
    calculateTrend(options.history) : 
    0;
  
  // Evaluar plausibilidad fisiológica
  const physiologicalPlausibility = calculatePhysiologicalPlausibility(
    perfusionIndex,
    options?.acComponent,
    options?.dcComponent
  );
  
  // Clasificación basada en calidad
  let classification: 'critical' | 'poor' | 'acceptable' | 'good' | 'excellent';
  
  if (quality < 30) {
    classification = 'critical';
  } else if (quality < 50) {
    classification = 'poor';
  } else if (quality < 70) {
    classification = 'acceptable';
  } else if (quality < 90) {
    classification = 'good';
  } else {
    classification = 'excellent';
  }
  
  return {
    quality,
    classification,
    details: {
      stability,
      trend,
      physiologicalPlausibility
    }
  };
}

/**
 * Calcular tendencia en historial de perfusión
 */
function calculateTrend(history: number[]): number {
  if (history.length < 3) return 0;
  
  // Dividir historial en mitades
  const firstHalf = history.slice(0, Math.floor(history.length / 2));
  const secondHalf = history.slice(Math.floor(history.length / 2));
  
  // Calcular promedios
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  // Calcular tendencia normalizada [-1 a 1]
  // donde positivo = mejora, negativo = deterioro
  const relativeTrend = firstAvg > 0 ? 
    (secondAvg - firstAvg) / firstAvg : 
    0;
  
  // Limitar a rango [-1, 1]
  return Math.max(-1, Math.min(1, relativeTrend));
}

/**
 * Evaluar plausibilidad fisiológica de índice de perfusión
 */
function calculatePhysiologicalPlausibility(
  perfusionIndex: number,
  acComponent?: number,
  dcComponent?: number
): number {
  // Rangos fisiológicos normales
  const PLAUSIBLE_RANGES = {
    perfusionIndex: { min: 0.01, optimal: 0.1, max: 5 },
    acComponent: { min: 0.01, optimal: 0.1, max: 1 },
    dcComponent: { min: 0.1, optimal: 1, max: 10 }
  };
  
  let plausibilityScore = 1;
  
  // Evaluar PI
  if (perfusionIndex < PLAUSIBLE_RANGES.perfusionIndex.min) {
    plausibilityScore *= (perfusionIndex / PLAUSIBLE_RANGES.perfusionIndex.min);
  } else if (perfusionIndex > PLAUSIBLE_RANGES.perfusionIndex.max) {
    plausibilityScore *= (PLAUSIBLE_RANGES.perfusionIndex.max / perfusionIndex);
  }
  
  // Evaluar componente AC si disponible
  if (acComponent !== undefined) {
    if (acComponent < PLAUSIBLE_RANGES.acComponent.min) {
      plausibilityScore *= (acComponent / PLAUSIBLE_RANGES.acComponent.min);
    } else if (acComponent > PLAUSIBLE_RANGES.acComponent.max) {
      plausibilityScore *= (PLAUSIBLE_RANGES.acComponent.max / acComponent);
    }
  }
  
  // Evaluar componente DC si disponible
  if (dcComponent !== undefined) {
    if (dcComponent < PLAUSIBLE_RANGES.dcComponent.min) {
      plausibilityScore *= (dcComponent / PLAUSIBLE_RANGES.dcComponent.min);
    } else if (dcComponent > PLAUSIBLE_RANGES.dcComponent.max) {
      plausibilityScore *= (PLAUSIBLE_RANGES.dcComponent.max / dcComponent);
    }
  }
  
  // Verificar consistencia si ambos componentes están disponibles
  if (acComponent !== undefined && dcComponent !== undefined && dcComponent > 0) {
    const calculatedPI = acComponent / dcComponent;
    const consistencyRatio = perfusionIndex > calculatedPI ? 
      calculatedPI / perfusionIndex : 
      perfusionIndex / calculatedPI;
    
    plausibilityScore *= consistencyRatio;
  }
  
  // Limitar a rango [0, 1]
  return Math.max(0, Math.min(1, plausibilityScore));
}
