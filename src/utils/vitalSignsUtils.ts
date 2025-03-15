
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
