
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para detección de presencia de dedo
 */

// Almacenamiento para detección de patrones rítmicos
let rhythmDetectionHistory: Array<{time: number, value: number}> = [];
let confirmedFingerPresence: boolean = false;
let lastPeakTimes: number[] = [];
let consistentPatternsCount: number = 0;

// Constantes para detección de patrones
const PATTERN_WINDOW_MS = 3000; // Ventana de 3 segundos
const MIN_PEAKS_FOR_PATTERN = 3; // Mínimo 3 picos para confirmar patrón
const PEAK_DETECTION_THRESHOLD = 0.2; // Umbral para detección de picos
const REQUIRED_CONSISTENT_PATTERNS = 3; // Patrones requeridos para confirmación
const MAX_CONSISTENT_PATTERNS = 10; // Máximo contador de patrones para evitar overflow

/**
 * Detecta la presencia de un dedo basado en análisis de patrones de la señal PPG
 * @param signalBuffer Buffer de señal filtrada
 * @param sensitivity Factor de sensibilidad (0-1)
 * @returns true si se detecta presencia de dedo
 */
export function detectFingerPresence(
  signalBuffer: number[],
  sensitivity: number = 0.6
): boolean {
  // Si ya confirmamos la presencia, mantenerla a menos que se pierda el patrón
  if (confirmedFingerPresence) {
    // Verificar si aún tenemos un patrón válido
    const stillValid = validateOngoingPattern(signalBuffer);
    
    if (!stillValid) {
      // Si se pierde el patrón, reducir contador de consistencia
      consistentPatternsCount = Math.max(0, consistentPatternsCount - 1);
      
      // Si perdimos demasiados patrones, quitar la confirmación
      if (consistentPatternsCount < 1) {
        confirmedFingerPresence = false;
      }
    }
    
    return confirmedFingerPresence;
  }
  
  // Agregar nuevo valor al historial
  if (signalBuffer.length > 0) {
    const now = Date.now();
    rhythmDetectionHistory.push({
      time: now,
      value: signalBuffer[signalBuffer.length - 1]
    });
    
    // Mantener solo valores recientes
    rhythmDetectionHistory = rhythmDetectionHistory
      .filter(point => now - point.time < PATTERN_WINDOW_MS * 2);
  }
  
  // Detectar patrones rítmicos
  const hasRhythmicPattern = detectRhythmicPattern(sensitivity);
  
  // Si detectamos patrón, incrementar contador
  if (hasRhythmicPattern) {
    consistentPatternsCount = Math.min(
      MAX_CONSISTENT_PATTERNS, 
      consistentPatternsCount + 1
    );
    
    // Si tenemos suficientes patrones consecutivos, confirmar presencia
    if (consistentPatternsCount >= REQUIRED_CONSISTENT_PATTERNS) {
      confirmedFingerPresence = true;
      console.log("Dedo detectado por patrón rítmico consistente");
    }
  } else {
    // Reducir contador si no hay patrón
    consistentPatternsCount = Math.max(0, consistentPatternsCount - 0.5);
  }
  
  return confirmedFingerPresence;
}

/**
 * Detecta patrones rítmicos en la señal
 */
function detectRhythmicPattern(sensitivity: number): boolean {
  const now = Date.now();
  
  if (rhythmDetectionHistory.length < 15) {
    return false;
  }
  
  // Ajustar umbral según sensibilidad
  const adjustedThreshold = PEAK_DETECTION_THRESHOLD * (1.2 - sensitivity);
  
  // Buscar picos en la señal reciente
  const recentSignals = rhythmDetectionHistory
    .filter(point => now - point.time < PATTERN_WINDOW_MS);
  
  if (recentSignals.length < 10) {
    return false;
  }
  
  // Detectar picos
  const peaks: number[] = [];
  
  for (let i = 2; i < recentSignals.length - 2; i++) {
    const current = recentSignals[i];
    const prev1 = recentSignals[i - 1];
    const prev2 = recentSignals[i - 2];
    const next1 = recentSignals[i + 1];
    const next2 = recentSignals[i + 2];
    
    // Verificar si este punto es un pico
    if (current.value > prev1.value && 
        current.value > prev2.value &&
        current.value > next1.value && 
        current.value > next2.value &&
        current.value > adjustedThreshold) {
      peaks.push(current.time);
    }
  }
  
  // Verificar si tenemos suficientes picos
  if (peaks.length < MIN_PEAKS_FOR_PATTERN) {
    return false;
  }
  
  // Calcular intervalos entre picos
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  // Filtrar intervalos fisiológicamente plausibles (40-180 BPM)
  const validIntervals = intervals.filter(interval => 
    interval >= 333 && interval <= 1500
  );
  
  if (validIntervals.length < Math.floor(intervals.length * 0.7)) {
    // Menos del 70% de intervalos son plausibles
    return false;
  }
  
  // Verificar consistencia en intervalos
  let consistentIntervals = 0;
  const maxDeviation = 200; // ms
  
  for (let i = 1; i < validIntervals.length; i++) {
    if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
      consistentIntervals++;
    }
  }
  
  // Si tenemos intervalos consistentes, confirmar patrón
  const hasPattern = consistentIntervals >= MIN_PEAKS_FOR_PATTERN - 1;
  
  if (hasPattern) {
    lastPeakTimes = peaks;
  }
  
  return hasPattern;
}

/**
 * Valida si el patrón rítmico continúa presente
 */
function validateOngoingPattern(signalBuffer: number[]): boolean {
  // Si el buffer es muy pequeño, no podemos validar
  if (signalBuffer.length < 10) {
    return true; // Asumir que sigue siendo válido por falta de datos
  }
  
  // Verificar que la señal sigue teniendo variaciones 
  // (evitar señales planas que podrían falsamente parecer estables)
  const min = Math.min(...signalBuffer);
  const max = Math.max(...signalBuffer);
  const amplitude = max - min;
  
  // Si la amplitud es muy baja, no hay dedo
  if (amplitude < 0.05) {
    return false;
  }
  
  // Si hemos perdido los patrones rítmicos por completo
  const now = Date.now();
  const lastPatternTime = lastPeakTimes.length > 0 ? 
    lastPeakTimes[lastPeakTimes.length - 1] : 0;
  
  // Si ha pasado mucho tiempo desde el último patrón detectado
  if (now - lastPatternTime > 5000) {
    return false;
  }
  
  return true;
}

/**
 * Reinicia el detector de dedo
 */
export function resetFingerDetector(): void {
  rhythmDetectionHistory = [];
  confirmedFingerPresence = false;
  lastPeakTimes = [];
  consistentPatternsCount = 0;
}
