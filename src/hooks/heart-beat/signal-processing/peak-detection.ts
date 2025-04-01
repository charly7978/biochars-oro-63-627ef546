
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 * Enhanced with improved algorithms for more accurate heartbeat detection
 */

// Configuración optimizada para detección de picos PPG
const PEAK_CONFIG = {
  // Valores fisiológicos de HR: [40, 200] BPM
  MIN_PEAK_DISTANCE_MS: 300, // Distancia mínima entre picos (300ms = 200 BPM máx)
  MAX_PEAK_DISTANCE_MS: 1500, // Distancia máxima entre picos (1500ms = 40 BPM mín)
  DETECTION_WINDOW: 8,        // Ventana para detección de picos locales
  THRESHOLD_FACTOR: 0.6,      // Factor para umbral adaptativo
  MIN_PEAK_HEIGHT: 0.012,     // Altura mínima de pico para considerarse válido
  EDGE_IGNORE: 2              // Ignorar muestras en los bordes para evitar falsos positivos
};

// Historial de valores para cálculos adaptativos
let valueHistory: number[] = [];
const VALUE_HISTORY_SIZE = 50;
let lastValidPeaks: {time: number, value: number}[] = [];
const MAX_VALID_PEAKS = 8;
let adaptiveThreshold = 0.025;
let lastPeakValue = 0;

// Parámetros para el algoritmo de Pan-Tompkins adaptado
const PAN_TOMPKINS_CONFIG = {
  FILTER_LENGTH: 10,         // Longitud del filtro para el preprocesamiento
  INTEGRATION_WINDOW: 10,    // Ventana para integración de la señal
  LEARNING_RATE: 0.1,        // Tasa de aprendizaje para umbrales adaptativos
  SIGNAL_THRESHOLD: 0.4,     // Umbral de señal base
  NOISE_THRESHOLD: 0.1,      // Umbral de ruido base
  RR_LOW_LIMIT: 0.92,        // Límite inferior para intervalos RR (factor)
  RR_HIGH_LIMIT: 1.16,       // Límite superior para intervalos RR (factor)
  RR_MISSED_LIMIT: 1.66      // Límite para detección de latido perdido
};

// Estado para el algoritmo Pan-Tompkins
let panTompkinsState = {
  signalThreshold: PAN_TOMPKINS_CONFIG.SIGNAL_THRESHOLD,
  noiseThreshold: PAN_TOMPKINS_CONFIG.NOISE_THRESHOLD,
  lastRRIntervals: [] as number[],
  lastPeakTime: 0,
  integrator: [] as number[],
  filteredSignal: [] as number[],
  detectedPeaks: [] as number[]
};

/**
 * Determina si una medición debe ser procesada basándose en la fuerza de la señal
 * Solo procesa mediciones reales con umbral adaptativo mejorado
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Mantener historial para umbral adaptativo
  valueHistory.push(Math.abs(value));
  if (valueHistory.length > VALUE_HISTORY_SIZE) {
    valueHistory.shift();
  }
  
  // Calcular umbral adaptativo si hay suficiente historial
  if (valueHistory.length > 10) {
    const sortedValues = [...valueHistory].sort((a, b) => a - b);
    const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    
    // Umbral más sensible pero adaptativo al ruido actual
    adaptiveThreshold = Math.max(0.008, q1 * 0.5);
  }
  
  // Evaluar señal contra umbral adaptativo
  return Math.abs(value) >= adaptiveThreshold;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    },
    isArrhythmia: false,
    // Adding transition state to ensure continuous color rendering
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Implementa el algoritmo de Pan-Tompkins adaptado para señales PPG
 * Basado en el algoritmo de detección de QRS pero modificado para las características de la señal PPG
 */
function panTompkinsAdaptedDetection(
  value: number,
  recentValues: number[],
  timeSinceLastPeak: number
): { isPeak: boolean, confidence: number } {
  if (recentValues.length < PAN_TOMPKINS_CONFIG.FILTER_LENGTH * 2) {
    return { isPeak: false, confidence: 0 };
  }
  
  // 1. Filtrado para eliminar ruido y reforzar características de la señal PPG
  // Para PPG: Usamos un filtro de paso de banda diferente al ECG
  const bandPassFiltered = applyPPGBandpassFilter(recentValues);
  
  // 2. Derivación - Resalta las pendientes rápidas (características de los picos PPG)
  const derivative = calculateDerivative(bandPassFiltered);
  
  // 3. Cuadrado de la señal - Enfatiza las frecuencias altas (relacionadas con los picos)
  const squared = derivative.map(v => v * v);
  
  // 4. Integración de ventana móvil - Obtiene información sobre la forma de onda y energía
  const integrated = applyMovingWindowIntegration(squared, PAN_TOMPKINS_CONFIG.INTEGRATION_WINDOW);
  
  // Guardar en el estado para análisis morfológico
  panTompkinsState.filteredSignal = [...bandPassFiltered];
  panTompkinsState.integrator = [...integrated];
  
  // Verificar si el punto actual podría ser un pico basado en el algoritmo adaptado
  const currentIndex = integrated.length - 1;
  if (currentIndex < 2) return { isPeak: false, confidence: 0 };
  
  // Actualización adaptativa de umbrales
  updateAdaptiveThresholds(integrated[currentIndex]);
  
  // 5. Decisión - Aplicar reglas de detección adaptadas para PPG
  const isPeak = integrated[currentIndex] > panTompkinsState.signalThreshold &&
                integrated[currentIndex] > integrated[currentIndex - 1] &&
                integrated[currentIndex] > integrated[currentIndex - 2] &&
                timeSinceLastPeak >= PEAK_CONFIG.MIN_PEAK_DISTANCE_MS;
  
  // Verificación mediante análisis morfológico (forma de onda PPG) 
  const morphologyConfirmation = isPeak ? verifyPPGMorphology(recentValues, currentIndex) : false;
  
  // 6. Si es un pico, aplicar reglas de validación de intervalos RR adaptadas
  let confidence = 0;
  if (isPeak && morphologyConfirmation) {
    const now = Date.now();
    const rrInterval = now - panTompkinsState.lastPeakTime;
    
    if (panTompkinsState.lastPeakTime > 0 && 
        rrInterval >= PEAK_CONFIG.MIN_PEAK_DISTANCE_MS &&
        rrInterval <= PEAK_CONFIG.MAX_PEAK_DISTANCE_MS) {
      
      // Añadir a los intervalos RR
      panTompkinsState.lastRRIntervals.push(rrInterval);
      if (panTompkinsState.lastRRIntervals.length > 8) {
        panTompkinsState.lastRRIntervals.shift();
      }
      
      // Verificar si el intervalo es fisiológicamente plausible
      const isValidRR = validateRRInterval(rrInterval, panTompkinsState.lastRRIntervals);
      
      // Calcular confianza basada en la calidad de la señal y la validación de intervalos
      confidence = calculatePeakConfidence(
        integrated[currentIndex], 
        panTompkinsState.signalThreshold, 
        isValidRR ? 1.0 : 0.5,
        morphologyConfirmation ? 1.0 : 0.5
      );
      
      // Registrar tiempo del pico para el próximo cálculo
      panTompkinsState.lastPeakTime = now;
      panTompkinsState.detectedPeaks.push(now);
      
      // Mantener solo los últimos N picos detectados
      if (panTompkinsState.detectedPeaks.length > 20) {
        panTompkinsState.detectedPeaks.shift();
      }
    }
  }
  
  return { isPeak: (isPeak && morphologyConfirmation), confidence };
}

/**
 * Aplica un filtro de paso de banda específico para señales PPG
 * Optimizado para las frecuencias características de la señal fotopletismográfica
 */
function applyPPGBandpassFilter(values: number[]): number[] {
  // Para PPG, las frecuencias de interés están entre 0.5 y 4 Hz aproximadamente
  // Implementamos un filtro simple para este rango
  const result: number[] = [];
  
  // Coeficientes simplificados para un filtro IIR
  const a = [1, -1.5, 0.7];
  const b = [0.25, 0, -0.25];
  
  // Aplicar filtro
  for (let i = 2; i < values.length; i++) {
    let filteredValue = 0;
    
    // Parte FIR
    for (let j = 0; j < b.length; j++) {
      if (i - j >= 0) {
        filteredValue += b[j] * values[i - j];
      }
    }
    
    // Parte IIR (retroalimentación)
    for (let j = 1; j < a.length; j++) {
      if (result.length >= j) {
        filteredValue -= a[j] * result[result.length - j];
      }
    }
    
    // Normalizar por a[0]
    filteredValue /= a[0];
    result.push(filteredValue);
  }
  
  return result;
}

/**
 * Calcula la derivada de la señal para enfatizar los cambios rápidos
 * Adaptado para características específicas de la señal PPG
 */
function calculateDerivative(values: number[]): number[] {
  const derivative: number[] = [];
  
  // Para la señal PPG, usamos un algoritmo de tres puntos que es más efectivo
  for (let i = 2; i < values.length - 2; i++) {
    // Algoritmo de cinco puntos para mayor precisión en señales PPG
    const deriv = (
      -values[i-2] - 2*values[i-1] + 2*values[i+1] + values[i+2]
    ) / 8.0;
    
    derivative.push(deriv);
  }
  
  return derivative;
}

/**
 * Implementa el método de derivada de segunda orden para mejorar la detección
 * Útil para identificar puntos de inflexión y características morfológicas
 */
function calculateSecondDerivative(values: number[]): number[] {
  const firstDeriv = calculateDerivative(values);
  return calculateDerivative(firstDeriv);
}

/**
 * Realiza integración de ventana móvil en la señal
 * Adaptada para resaltar las características de la onda de pulso en PPG
 */
function applyMovingWindowIntegration(values: number[], windowSize: number): number[] {
  const integrated: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Sumar valores en la ventana
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += values[j];
      count++;
    }
    
    integrated.push(sum / count);
  }
  
  return integrated;
}

/**
 * Actualiza los umbrales adaptativos basados en el valor actual
 * Separa entre señal y ruido para mejorar la detección
 */
function updateAdaptiveThresholds(value: number): void {
  // Si el valor actual es un posible pico
  if (value > panTompkinsState.signalThreshold) {
    // Actualizar umbral de señal (más lento para estabilidad)
    panTompkinsState.signalThreshold = 
      panTompkinsState.signalThreshold * (1 - PAN_TOMPKINS_CONFIG.LEARNING_RATE / 2) + 
      value * (PAN_TOMPKINS_CONFIG.LEARNING_RATE / 2);
  } else {
    // Actualizar umbral de ruido (más rápido para adaptabilidad)
    panTompkinsState.noiseThreshold = 
      panTompkinsState.noiseThreshold * (1 - PAN_TOMPKINS_CONFIG.LEARNING_RATE) + 
      value * PAN_TOMPKINS_CONFIG.LEARNING_RATE;
    
    // Ajustar umbral de señal basado en nivel de ruido
    panTompkinsState.signalThreshold = 
      panTompkinsState.noiseThreshold + 
      (panTompkinsState.signalThreshold - panTompkinsState.noiseThreshold) * 0.95;
  }
  
  // Asegurar que los umbrales no bajen demasiado
  panTompkinsState.signalThreshold = Math.max(panTompkinsState.signalThreshold, PAN_TOMPKINS_CONFIG.SIGNAL_THRESHOLD / 2);
  panTompkinsState.noiseThreshold = Math.max(panTompkinsState.noiseThreshold, PAN_TOMPKINS_CONFIG.NOISE_THRESHOLD / 2);
}

/**
 * Valida el intervalo RR usando criterios fisiológicos y estadísticos
 * Adaptado específicamente para patrones cardíacos en señales PPG
 */
function validateRRInterval(currentRR: number, previousRRs: number[]): boolean {
  if (previousRRs.length < 3) return true;
  
  // Calcular promedio de los últimos intervalos válidos
  const validRRs = previousRRs.filter(rr => 
    rr >= PEAK_CONFIG.MIN_PEAK_DISTANCE_MS && 
    rr <= PEAK_CONFIG.MAX_PEAK_DISTANCE_MS
  );
  
  if (validRRs.length < 3) return true;
  
  const avgRR = validRRs.reduce((sum, rr) => sum + rr, 0) / validRRs.length;
  
  // Verificar si el intervalo actual está dentro de límites fisiológicos
  const isWithinLimits = 
    currentRR >= avgRR * PAN_TOMPKINS_CONFIG.RR_LOW_LIMIT && 
    currentRR <= avgRR * PAN_TOMPKINS_CONFIG.RR_HIGH_LIMIT;
  
  // Verificar si podría ser un latido perdido
  const couldBeMissedBeat = 
    currentRR >= avgRR * PAN_TOMPKINS_CONFIG.RR_MISSED_LIMIT && 
    currentRR <= avgRR * PAN_TOMPKINS_CONFIG.RR_MISSED_LIMIT * 2;
  
  return isWithinLimits || couldBeMissedBeat;
}

/**
 * Verifica la morfología típica de una onda PPG para confirmar picos
 * Utiliza análisis morfológico avanzado
 */
function verifyPPGMorphology(values: number[], currentIndex: number): boolean {
  if (values.length < 15 || currentIndex < 10) return false;
  
  // En PPG buscamos:
  // 1. Una subida rápida (pendiente positiva significativa)
  // 2. Seguida de una bajada más lenta (dicrótica)
  // 3. Posiblemente con una pequeña onda dicrótica
  
  // Analizamos la forma usando derivadas y características de forma
  const recentValues = values.slice(-15);
  
  // Calcular primera y segunda derivada para análisis morfológico
  const firstDeriv = calculateDerivative(recentValues);
  const secondDeriv = calculateSecondDerivative(recentValues);
  
  // Verificar patrón de subida rápida (pendiente positiva)
  let hasRapidRise = false;
  for (let i = Math.max(0, firstDeriv.length - 8); i < firstDeriv.length - 2; i++) {
    if (firstDeriv[i] > 0.01) {
      hasRapidRise = true;
      break;
    }
  }
  
  // Verificar cambio de pendiente (punto de inflexión) usando segunda derivada
  let hasInflectionPoint = false;
  for (let i = Math.max(0, secondDeriv.length - 5); i < secondDeriv.length; i++) {
    if (secondDeriv[i] < -0.005) {
      hasInflectionPoint = true;
      break;
    }
  }
  
  // Verificar que la pendiente actual sea negativa (bajada después del pico)
  const currentSlopeNegative = 
    firstDeriv.length > 0 && 
    firstDeriv[firstDeriv.length - 1] < 0;
  
  // Combinar criterios para decisión morfológica
  return hasRapidRise && hasInflectionPoint && currentSlopeNegative;
}

/**
 * Calcula la confianza del pico basado en múltiples factores
 */
function calculatePeakConfidence(
  value: number,
  threshold: number,
  rrFactor: number,
  morphologyFactor: number
): number {
  // Relación señal-umbral (normalizada entre 0-1)
  const signalRatio = Math.min(value / (threshold * 2), 1.0);
  
  // Peso relativo de cada componente
  const weights = {
    signalStrength: 0.5,
    rrValidation: 0.3,
    morphology: 0.2
  };
  
  // Cálculo de confianza ponderada
  const confidence = 
    signalRatio * weights.signalStrength +
    rrFactor * weights.rrValidation +
    morphologyFactor * weights.morphology;
  
  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Enhanced peak detection algorithm based on derivative techniques
 * Integrates both basic peak detection and Pan-Tompkins approaches
 */
export function detectPeak(
  value: number,
  recentValues: number[],
  timeSinceLastPeak: number
): { isPeak: boolean, confidence: number } {
  // Usar el algoritmo de Pan-Tompkins adaptado como método principal
  const panTompkinsResult = panTompkinsAdaptedDetection(value, recentValues, timeSinceLastPeak);
  
  // Si el Pan-Tompkins detecta un pico con alta confianza, usarlo directamente
  if (panTompkinsResult.isPeak && panTompkinsResult.confidence > 0.7) {
    return panTompkinsResult;
  }
  
  // Como fallback, implementar el método original mejorado
  if (recentValues.length < PEAK_CONFIG.DETECTION_WINDOW + 4) {
    return { isPeak: false, confidence: 0 };
  }
  
  // No evaluar picos si no ha pasado tiempo suficiente desde el último
  if (timeSinceLastPeak < PEAK_CONFIG.MIN_PEAK_DISTANCE_MS) {
    return { isPeak: false, confidence: 0 };
  }
  
  // Calcular la primera derivada (pendiente)
  const derivatives: number[] = [];
  for (let i = 1; i < recentValues.length; i++) {
    derivatives.push(recentValues[i] - recentValues[i-1]);
  }
  
  // Calcular la segunda derivada para detectar puntos de inflexión
  const secondDerivatives: number[] = [];
  for (let i = 1; i < derivatives.length; i++) {
    secondDerivatives.push(derivatives[i] - derivatives[i-1]);
  }
  
  // Estimar posición actual en la ventana
  const currentIndex = recentValues.length - 1;
  
  // Un pico PPG se caracteriza por:
  // 1. La primera derivada cambia de positiva a negativa (pendiente de subida a bajada)
  // 2. La segunda derivada es negativa en el pico (curvatura hacia abajo)
  
  const isPositiveSlope = derivatives[currentIndex-2] > 0;
  const isNegativeSlope = derivatives[currentIndex-1] < 0;
  const isNegativeCurvature = secondDerivatives[currentIndex-2] < 0;
  
  // Altura suficiente sobre la línea base
  const recentMean = recentValues.slice(-10).reduce((sum, v) => sum + v, 0) / 10;
  const peakHeight = value - recentMean;
  
  // Verificación de máximo local (más alto que los puntos cercanos)
  let isLocalMaximum = true;
  for (let i = 1; i <= PEAK_CONFIG.DETECTION_WINDOW; i++) {
    // Solo comprobar hasta donde tenemos datos
    if (currentIndex - i >= 0 && recentValues[currentIndex - i] >= value) {
      isLocalMaximum = false;
      break;
    }
  }
  
  // Validez fisiológica - debe haber una pendiente significativa
  const significantRise = Math.max(...derivatives.slice(-5)) > adaptiveThreshold * 1.5;
  
  // Combinación de criterios para detección de pico
  const isPeak = isPositiveSlope && 
                 isNegativeSlope && 
                 isNegativeCurvature && 
                 isLocalMaximum && 
                 peakHeight > PEAK_CONFIG.MIN_PEAK_HEIGHT &&
                 significantRise;
  
  // Verificación morfológica avanzada
  const morphologyConfirmed = isPeak ? verifyPPGMorphology(recentValues, currentIndex) : false;
  
  // Calcular confianza basada en las características del pico
  let confidence = 0;
  if (isPeak && morphologyConfirmed) {
    // Factores de confianza:
    const heightFactor = Math.min(1, peakHeight / (PEAK_CONFIG.MIN_PEAK_HEIGHT * 3));
    const timingFactor = timeSinceLastPeak > PEAK_CONFIG.MIN_PEAK_DISTANCE_MS ? 
      Math.min(1, Math.max(0, (PEAK_CONFIG.MAX_PEAK_DISTANCE_MS - timeSinceLastPeak) / PEAK_CONFIG.MAX_PEAK_DISTANCE_MS)) : 0;
    const curvatureFactor = Math.min(1, Math.abs(secondDerivatives[currentIndex-2]) / 0.01);
    
    // Combinar factores con diferentes pesos
    confidence = (heightFactor * 0.5) + (timingFactor * 0.3) + (curvatureFactor * 0.2);
    
    // Registrar pico válido para cálculos futuros
    if (confidence > 0.4) {
      lastValidPeaks.push({time: Date.now(), value});
      if (lastValidPeaks.length > MAX_VALID_PEAKS) {
        lastValidPeaks.shift();
      }
      lastPeakValue = value;
    }
  }
  
  // Combinar resultado con Pan-Tompkins si ambos están de acuerdo (aumenta confianza)
  if (isPeak && panTompkinsResult.isPeak) {
    return { 
      isPeak: true, 
      confidence: Math.max(confidence, panTompkinsResult.confidence) * 1.1 // Boost por doble confirmación
    };
  }
  
  // Si solo el método tradicional detectó pico
  return { isPeak: (isPeak && morphologyConfirmed), confidence };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.05) {
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // EL BEEP SOLO SE MANEJA EN PPGSignalMeter CUANDO SE DIBUJA UN CÍRCULO
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      // Log transition state if present
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false,
      adaptiveThreshold,
      signalThreshold: panTompkinsState.signalThreshold,
      noiseThreshold: panTompkinsState.noiseThreshold
    });
  }
}

/**
 * Resetea el estado interno del detector de picos
 */
export function resetPeakDetector(): void {
  valueHistory = [];
  lastValidPeaks = [];
  adaptiveThreshold = 0.025;
  lastPeakValue = 0;
  
  // Resetear estado del algoritmo Pan-Tompkins
  panTompkinsState = {
    signalThreshold: PAN_TOMPKINS_CONFIG.SIGNAL_THRESHOLD,
    noiseThreshold: PAN_TOMPKINS_CONFIG.NOISE_THRESHOLD,
    lastRRIntervals: [],
    lastPeakTime: 0,
    integrator: [],
    filteredSignal: [],
    detectedPeaks: []
  };
}
