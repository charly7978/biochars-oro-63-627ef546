
/**
 * Utilidades para procesamiento de señales vitales
 */

/**
 * Aplica un filtro de Media Móvil Simple
 * @param value El valor actual a filtrar
 * @param buffer El buffer de valores previos
 * @param windowSize El tamaño de la ventana de filtrado
 */
export const applySMAFilter = (value: number, buffer: number[], windowSize: number) => {
  const updatedBuffer = [...buffer, value].slice(-windowSize);
  
  const sum = updatedBuffer.reduce((acc, val) => acc + val, 0);
  const filteredValue = sum / updatedBuffer.length;
  
  return { filteredValue, updatedBuffer };
};

/**
 * Calcula el índice de perfusión
 * @param ac Componente AC de la señal PPG
 * @param dc Componente DC de la señal PPG
 */
export const calculatePerfusionIndex = (ac: number, dc: number): number => {
  if (dc === 0) return 0;
  return ac / dc;
};

/**
 * Calcula la componente AC de la señal PPG
 * @param values Array de valores PPG
 */
export const calculateAC = (values: number[]): number => {
  if (values.length < 2) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const lowerPercentile = sorted[Math.floor(sorted.length * 0.1)];
  const upperPercentile = sorted[Math.floor(sorted.length * 0.9)];
  
  return upperPercentile - lowerPercentile;
};

/**
 * Calcula la componente DC de la señal PPG
 * @param values Array de valores PPG
 */
export const calculateDC = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Encuentra picos y valles en una señal PPG
 * @param values Los valores de la señal PPG
 */
export const findPeaksAndValleys = (values: number[]): {
  peaks: { index: number; value: number }[];
  valleys: { index: number; value: number }[];
} => {
  const peaks: { index: number; value: number }[] = [];
  const valleys: { index: number; value: number }[] = [];
  
  if (values.length < 3) {
    return { peaks, valleys };
  }
  
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const next = values[i + 1];
    
    if (current > prev && current > next) {
      peaks.push({ index: i, value: current });
    }
    
    if (current < prev && current < next) {
      valleys.push({ index: i, value: current });
    }
  }
  
  return { peaks, valleys };
};

/**
 * Calcula la amplitud de la señal PPG
 * @param values Los valores de la señal PPG
 * @param peaks Índices de los picos detectados
 * @param valleys Índices de los valles detectados
 */
export const calculateAmplitude = (
  values: number[],
  peaks: { index: number; value: number }[],
  valleys: { index: number; value: number }[]
): number => {
  if (peaks.length === 0 || valleys.length === 0) {
    return 0;
  }
  
  let totalAmplitude = 0;
  let count = 0;
  
  for (const peak of peaks) {
    // Encontrar el valle más cercano anterior al pico
    let closestValley = null;
    let minDistance = Number.MAX_VALUE;
    
    for (const valley of valleys) {
      if (valley.index < peak.index) {
        const distance = peak.index - valley.index;
        if (distance < minDistance) {
          minDistance = distance;
          closestValley = valley;
        }
      }
    }
    
    if (closestValley) {
      totalAmplitude += Math.abs(peak.value - closestValley.value);
      count++;
    }
  }
  
  return count > 0 ? totalAmplitude / count : 0;
};
