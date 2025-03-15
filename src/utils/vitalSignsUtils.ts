
/**
 * Aplica un filtro de Media Móvil Simple (SMA) a un valor
 */
export function applySMAFilter(
  value: number, 
  buffer: number[], 
  windowSize: number
): { filteredValue: number, updatedBuffer: number[] } {
  // Crear una copia del buffer para no mutar el original
  const updatedBuffer = [...buffer, value];
  
  // Mantener el tamaño del buffer limitado a la ventana
  while (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calcular la media móvil
  const filteredValue = updatedBuffer.reduce((sum, val) => sum + val, 0) / updatedBuffer.length;
  
  return { filteredValue, updatedBuffer };
}

/**
 * Calcula el índice de perfusión basado en valores mínimos y máximos
 * El índice de perfusión es una medida de la fuerza de la pulsación
 */
export function calculatePerfusionIndex(min: number, max: number): number {
  if (max <= 0 || min >= max) return 0;
  
  // Fórmula estándar para PI = (AC/DC) * 100%
  // Donde AC es la componente pulsátil y DC es la componente continua
  const ac = max - min;
  const dc = max;
  
  const perfusionIndex = (ac / dc) * 100;
  
  // Normalizar a un rango típico de 0-1 para facilitar uso
  return Math.min(perfusionIndex / 100, 1);
}

/**
 * Calcula el índice de perfusión a partir de un array de valores
 */
export function calculatePerfusionIndexFromValues(values: number[]): number {
  if (values.length < 2) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return calculatePerfusionIndex(min, max);
}

/**
 * Formatea la presión arterial para mostrarla en la UI
 */
export function formatBloodPressure(bp: { systolic: number, diastolic: number }): string {
  if (bp.systolic <= 0 || bp.diastolic <= 0) {
    return "--/--";
  }
  
  return `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}`;
}

/**
 * Valida un valor de SpO2 
 */
export function validateSpO2(value: number): number {
  if (value < 80 || value > 100 || isNaN(value)) {
    return 0; // Valor no válido
  }
  
  return Math.round(value);
}

/**
 * Verifica si hay un dedo presente basado en la calidad de la señal
 */
export function isFingerPresent(quality: number, threshold: number = 30): boolean {
  return quality >= threshold;
}

/**
 * Encuentra picos y valles en una señal
 */
export function findPeaksAndValleys(signal: number[], minPeakDistance: number = 5): {
  peaks: { index: number, value: number }[];
  valleys: { index: number, value: number }[];
} {
  if (signal.length < 3) {
    return { peaks: [], valleys: [] };
  }
  
  const peaks: { index: number, value: number }[] = [];
  const valleys: { index: number, value: number }[] = [];
  
  // Encontrar picos y valles locales
  for (let i = 1; i < signal.length - 1; i++) {
    // Pico
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      // Verificar distancia mínima con el último pico
      const lastPeak = peaks[peaks.length - 1];
      if (!lastPeak || i - lastPeak.index >= minPeakDistance) {
        peaks.push({ index: i, value: signal[i] });
      } else if (signal[i] > lastPeak.value) {
        // Reemplazar el pico anterior si este es mayor
        peaks[peaks.length - 1] = { index: i, value: signal[i] };
      }
    }
    
    // Valle
    if (signal[i] < signal[i - 1] && signal[i] < signal[i + 1]) {
      // Verificar distancia mínima con el último valle
      const lastValley = valleys[valleys.length - 1];
      if (!lastValley || i - lastValley.index >= minPeakDistance) {
        valleys.push({ index: i, value: signal[i] });
      } else if (signal[i] < lastValley.value) {
        // Reemplazar el valle anterior si este es menor
        valleys[valleys.length - 1] = { index: i, value: signal[i] };
      }
    }
  }
  
  return { peaks, valleys };
}

/**
 * Calcula la componente AC de la señal PPG (componente pulsátil)
 */
export function calculateAC(signal: number[]): number {
  if (signal.length < 2) return 0;
  
  const { peaks, valleys } = findPeaksAndValleys(signal);
  if (peaks.length === 0 || valleys.length === 0) return 0;
  
  // Calcular el promedio de las diferencias entre picos y valles adyacentes
  let totalAC = 0;
  let count = 0;
  
  for (let i = 0; i < valleys.length; i++) {
    const valley = valleys[i];
    
    // Buscar el pico más cercano que sigue a este valle
    let nearestPeak = null;
    let minDistance = Infinity;
    
    for (let j = 0; j < peaks.length; j++) {
      const peak = peaks[j];
      if (peak.index > valley.index) {
        const distance = peak.index - valley.index;
        if (distance < minDistance) {
          minDistance = distance;
          nearestPeak = peak;
        }
      }
    }
    
    if (nearestPeak) {
      totalAC += nearestPeak.value - valley.value;
      count++;
    }
  }
  
  return count > 0 ? totalAC / count : 0;
}

/**
 * Calcula la componente DC de la señal PPG (componente continua)
 */
export function calculateDC(signal: number[]): number {
  if (signal.length === 0) return 0;
  
  // La componente DC es aproximadamente el valor medio de la señal
  return signal.reduce((sum, val) => sum + val, 0) / signal.length;
}

/**
 * Calcula la amplitud de la señal PPG
 */
export function calculateAmplitude(signal: number[]): number {
  if (signal.length < 2) return 0;
  
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  
  return max - min;
}
