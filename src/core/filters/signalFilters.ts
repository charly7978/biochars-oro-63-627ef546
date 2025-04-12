/**
 * Colección centralizada de filtros de señal comunes.
 * Opera únicamente con datos reales, sin simulación.
 */

/**
 * Calcula la mediana de un array de números.
 * @param values Array de números reales.
 * @returns La mediana.
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sortedValues = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  } else {
    return sortedValues[mid];
  }
}

/**
 * Aplica un filtro de mediana a un valor usando un buffer deslizante.
 * @param value El valor actual real.
 * @param buffer El buffer de valores recientes reales.
 * @param windowSize El tamaño de la ventana del filtro.
 * @returns El valor filtrado por mediana y el buffer actualizado.
 */
export function applyMedianFilter(value: number, buffer: number[], windowSize: number): { filteredValue: number; updatedBuffer: number[] } {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = calculateMedian(updatedBuffer);
  return { filteredValue, updatedBuffer };
}

/**
 * Aplica un filtro de media móvil simple (SMA) a un valor usando un buffer deslizante.
 * @param value El valor actual real.
 * @param buffer El buffer de valores recientes reales.
 * @param windowSize El tamaño de la ventana del filtro.
 * @returns El valor filtrado por SMA y el buffer actualizado.
 */
export function applyMovingAverageFilter(value: number, buffer: number[], windowSize: number): { filteredValue: number; updatedBuffer: number[] } {
    const updatedBuffer = [...buffer, value];
    if (updatedBuffer.length > windowSize) {
        updatedBuffer.shift();
    }
    const sum = updatedBuffer.reduce((acc, val) => acc + val, 0);
    const filteredValue = updatedBuffer.length > 0 ? sum / updatedBuffer.length : 0;
    return { filteredValue, updatedBuffer };
}


/**
 * Aplica un filtro de media móvil exponencial (EMA) a un valor.
 * @param value El valor actual real.
 * @param prevSmoothed El valor EMA anterior.
 * @param alpha El factor de suavizado (0 < alpha <= 1).
 * @returns El nuevo valor EMA.
 */
export function applyEMAFilter(value: number, prevSmoothed: number, alpha: number): number {
  // Si es el primer valor, inicializa EMA con el valor actual
  if (prevSmoothed === 0) {
      return value;
  }
  return alpha * value + (1 - alpha) * prevSmoothed;
}

/**
 * Aplica una secuencia de filtros (Mediana -> SMA -> EMA) a un valor.
 * @param value El valor crudo real.
 * @param medianBuffer Buffer para el filtro de mediana.
 * @param movingAvgBuffer Buffer para el filtro SMA.
 * @param prevEmaValue El valor EMA anterior.
 * @param config Configuración de los tamaños de ventana y alpha.
 * @returns Objeto con el valor final filtrado y los buffers actualizados.
 */
export function applyFilterPipeline(
  value: number,
  medianBuffer: number[],
  movingAvgBuffer: number[],
  prevEmaValue: number,
  config: {
    medianWindowSize: number,
    movingAvgWindowSize: number,
    emaAlpha: number
  }
): {
  filteredValue: number,
  updatedMedianBuffer: number[],
  updatedMovingAvgBuffer: number[],
  updatedEmaValue: number
} {
  // 1. Filtro de Mediana
  const { filteredValue: medianFiltered, updatedBuffer: newMedianBuffer } = applyMedianFilter(
    value,
    medianBuffer,
    config.medianWindowSize
  );

  // 2. Filtro de Media Móvil (SMA)
  const { filteredValue: smaFiltered, updatedBuffer: newMovingAvgBuffer } = applyMovingAverageFilter(
    medianFiltered, // Aplicar SMA al resultado de la mediana
    movingAvgBuffer,
    config.movingAvgWindowSize
  );

  // 3. Filtro EMA
  const emaFiltered = applyEMAFilter(
    smaFiltered, // Aplicar EMA al resultado de SMA
    prevEmaValue,
    config.emaAlpha
  );

  return {
    filteredValue: emaFiltered,
    updatedMedianBuffer: newMedianBuffer,
    updatedMovingAvgBuffer: newMovingAvgBuffer,
    updatedEmaValue: emaFiltered // Devolver el nuevo valor EMA para el siguiente paso
  };
} 