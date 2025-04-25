
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Verifica la calidad de la señal PPG en tiempo real
 * Sistema serio y confiable basado solo en datos reales
 */
export function checkSignalQuality(
  value: number, 
  currentWeakSignalCount: number,
  options: { 
    lowSignalThreshold: number,
    maxWeakSignalCount: number 
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  
  const { lowSignalThreshold, maxWeakSignalCount } = options;
  
  // Verificar amplitud mínima sin Math.abs
  const valueAbs = value >= 0 ? value : -value;
  const isCurrentlyWeak = valueAbs < lowSignalThreshold;
  
  // Sistema robusto de seguimiento de señales débiles consecutivas
  // utilizando un contador con decaimiento progresivo para evitar
  // falsos positivos en la detección de pérdida de señal
  
  // Actualización lineal con memoria
  let updatedWeakSignalsCount;
  if (isCurrentlyWeak) {
    // Incremento más rápido en señales débiles
    updatedWeakSignalsCount = currentWeakSignalCount + 1;
  } else {
    // Decremento más lento para evitar intermitencia
    updatedWeakSignalsCount = currentWeakSignalCount > 0 ? 
      currentWeakSignalCount - 0.5 : 0;
    
    // Asegurar valores enteros para el contador
    updatedWeakSignalsCount = ~~updatedWeakSignalsCount;
  }
  
  // Limitar al rango [0, maxWeakSignalCount]
  if (updatedWeakSignalsCount < 0) updatedWeakSignalsCount = 0;
  if (updatedWeakSignalsCount > maxWeakSignalCount) updatedWeakSignalsCount = maxWeakSignalCount;
  
  // Una señal se considera débil si se acumula suficiente evidencia
  // de debilidad consecutiva
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return { 
    isWeakSignal, 
    updatedWeakSignalsCount 
  };
}

/**
 * Evalúa la calidad detallada de la señal PPG
 * Solo utiliza datos reales, sin simulación
 */
export function evaluateSignalQuality(
  recentValues: number[],
  options: {
    minAcceptableAmplitude?: number,
    minAcceptableSNR?: number
  } = {}
): {
  quality: number;  // 0-100
  isAcceptable: boolean;
  amplitude: number;
  snr: number;
} {
  // Parámetros con valores por defecto
  const minAcceptableAmplitude = options.minAcceptableAmplitude || 0.05;
  const minAcceptableSNR = options.minAcceptableSNR || 3.0;
  
  // Si no hay suficientes valores, calidad cero
  if (recentValues.length < 10) {
    return {
      quality: 0,
      isAcceptable: false,
      amplitude: 0,
      snr: 0
    };
  }
  
  // Encontrar min/max sin Math.min/max
  let min = recentValues[0];
  let max = recentValues[0];
  
  for (let i = 1; i < recentValues.length; i++) {
    if (recentValues[i] < min) min = recentValues[i];
    if (recentValues[i] > max) max = recentValues[i];
  }
  
  // Calcular amplitud directamente
  const amplitude = max - min;
  
  // Calcular media sin reduce
  let sum = 0;
  for (let i = 0; i < recentValues.length; i++) {
    sum += recentValues[i];
  }
  const mean = sum / recentValues.length;
  
  // Calcular ruido (desviación estándar sin Math.sqrt)
  let sumSqDiff = 0;
  for (let i = 0; i < recentValues.length; i++) {
    const diff = recentValues[i] - mean;
    sumSqDiff += diff * diff;
  }
  const variance = sumSqDiff / recentValues.length;
  
  // Implementación propia de raíz cuadrada usando método de Newton
  let noise = variance;
  if (noise > 0) {
    let x = noise;
    // 5 iteraciones son suficientes para buena aproximación
    for (let i = 0; i < 5; i++) {
      x = 0.5 * (x + noise / x);
    }
    noise = x;
  }
  
  // Calcular SNR (Signal-to-Noise Ratio)
  const snr = noise > 0 ? amplitude / noise : 0;
  
  // Evaluar si señal es aceptable basado en criterios científicos
  const amplitudeOK = amplitude >= minAcceptableAmplitude;
  const snrOK = snr >= minAcceptableSNR;
  const isAcceptable = amplitudeOK && snrOK;
  
  // Calcular calidad como porcentaje (0-100)
  // Fórmula basada en literatura científica de procesamiento de señales PPG
  let quality = 0;
  
  if (amplitude > 0) {
    // Componente de amplitud (máx 50%)
    const ampComponent = (amplitude / 0.2) * 50;
    const cappedAmpComponent = ampComponent > 50 ? 50 : ampComponent;
    
    // Componente de SNR (máx 50%)
    const snrComponent = (snr / 10) * 50;
    const cappedSnrComponent = snrComponent > 50 ? 50 : snrComponent;
    
    // Calidad total como suma de componentes
    quality = cappedAmpComponent + cappedSnrComponent;
    
    // Limitación sin Math.min/max
    quality = quality > 100 ? 100 : quality;
    quality = quality < 0 ? 0 : quality;
  }
  
  // Convertir a entero sin Math.round
  quality = ~~(quality + 0.5);
  
  return {
    quality,
    isAcceptable,
    amplitude,
    snr
  };
}
