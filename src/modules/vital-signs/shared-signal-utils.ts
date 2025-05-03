
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Utilidades compartidas para procesamiento de señales PPG
 * Todas las funciones procesan solo datos reales sin simulación
 */

/**
 * Calcula el componente AC de una señal PPG (amplitud de la onda pulsátil)
 * @param values Array de valores PPG
 * @returns Amplitud del componente AC
 */
export function calculateAC(values: number[]): number {
  if (values.length < 2) return 0;
  
  let max = values[0];
  let min = values[0];
  
  // Encontrar máximo y mínimo sin Math
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
    if (values[i] < min) min = values[i];
  }
  
  // AC es la diferencia entre máximo y mínimo (amplitud de la onda)
  return max - min;
}

/**
 * Calcula el componente DC de una señal PPG (componente constante)
 * @param values Array de valores PPG
 * @returns Valor medio (DC) de la señal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  
  let sum = 0;
  
  // Calcular suma sin reduce
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  
  // Retornar media
  return sum / values.length;
}

/**
 * Encuentra picos en una señal PPG
 * @param values Array de valores PPG
 * @param threshold Umbral de detección (opcional)
 * @returns Índices de los picos detectados
 */
export function findPeaks(values: number[], threshold: number = 0): number[] {
  if (values.length < 3) return [];
  
  const peaks: number[] = [];
  
  // Calcular umbral adaptativo si no se proporciona
  if (threshold <= 0) {
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > max) max = values[i];
    }
    threshold = max * 0.6; // 60% del máximo
  }
  
  // Detectar picos
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1] && values[i] > threshold) {
      peaks.push(i);
    }
  }
  
  return peaks;
}

/**
 * Encuentra valles en una señal PPG
 * @param values Array de valores PPG
 * @param threshold Umbral de detección (opcional)
 * @returns Índices de los valles detectados
 */
export function findValleys(values: number[], threshold: number = 0): number[] {
  if (values.length < 3) return [];
  
  const valleys: number[] = [];
  
  // Calcular umbral adaptativo si no se proporciona
  if (threshold <= 0) {
    let min = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
    }
    threshold = min * 1.5; // 150% del mínimo
  }
  
  // Detectar valles
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] < values[i-1] && values[i] < values[i+1] && values[i] < threshold) {
      valleys.push(i);
    }
  }
  
  return valleys;
}

/**
 * Calcula la frecuencia cardíaca a partir de picos PPG
 * @param peaks Índices de picos PPG
 * @param samplingRate Frecuencia de muestreo en Hz
 * @returns Frecuencia cardíaca estimada en BPM
 */
export function calculateHeartRate(peaks: number[], samplingRate: number = 30): number {
  if (peaks.length < 2) return 0;
  
  // Calcular intervalos entre picos
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Calcular intervalo promedio
  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    sum += intervals[i];
  }
  const avgInterval = sum / intervals.length;
  
  // Convertir a BPM
  if (avgInterval <= 0) return 0;
  return 60 * samplingRate / avgInterval;
}
