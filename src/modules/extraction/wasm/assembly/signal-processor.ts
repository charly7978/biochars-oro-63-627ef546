
// Signal processor implementado en AssemblyScript
// Optimizado para operaciones matemáticas rápidas

// Memoria para buffer compartido
export const BUFFER_SIZE: i32 = 1024;
export const signalBuffer = new Float32Array(BUFFER_SIZE);

/**
 * Aplica un filtro Kalman a un array de valores
 * @param inputPtr Puntero al array de entrada
 * @param length Longitud del array
 * @param q Parámetro Q del filtro (ruido del proceso)
 * @param r Parámetro R del filtro (ruido de la medición)
 * @param outputPtr Puntero al array de salida
 */
export function applyKalmanFilter(inputPtr: i32, length: i32, q: f32, r: f32, outputPtr: i32): void {
  let x: f32 = 0.0; // Estimación inicial
  let p: f32 = 1.0; // Covarianza inicial
  
  // Acceder a los arrays
  let input = new Float32Array(length);
  let output = new Float32Array(length);
  
  // Copiar datos de entrada desde memoria
  memory.copy(input.dataStart, inputPtr, length * 4);
  
  for (let i = 0; i < length; i++) {
    // Predicción
    p = p + q;
    
    // Actualización
    const k: f32 = p / (p + r); // Ganancia de Kalman
    x = x + k * (input[i] - x);
    p = (1.0 - k) * p;
    
    // Guardar resultado
    output[i] = x;
  }
  
  // Copiar resultado a la memoria de salida
  memory.copy(outputPtr, output.dataStart, length * 4);
}

/**
 * Encuentra picos en un array de valores
 * @param inputPtr Puntero al array de entrada
 * @param length Longitud del array
 * @param minDistance Distancia mínima entre picos
 * @param threshold Umbral para considerar un pico
 * @param peaksPtr Puntero para guardar las posiciones de los picos
 * @param peaksLengthPtr Puntero para guardar el número de picos encontrados
 */
export function findPeaks(inputPtr: i32, length: i32, minDistance: i32, threshold: f32, peaksPtr: i32, peaksLengthPtr: i32): void {
  let input = new Float32Array(length);
  
  // Copiar datos de entrada desde memoria
  memory.copy(input.dataStart, inputPtr, length * 4);
  
  // Array temporal para almacenar posiciones de picos
  let peaks = new Array<i32>(0);
  
  // Detectar picos
  for (let i: i32 = 1; i < length - 1; i++) {
    if (input[i] > input[i - 1] && input[i] > input[i + 1] && input[i] > threshold) {
      // Comprobar distancia mínima con el último pico
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
      // Si ya hay un pico cercano, quedarse con el más alto
      else if (input[i] > input[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
      }
    }
  }
  
  // Guardar número de picos
  store<i32>(peaksLengthPtr, peaks.length);
  
  // Guardar posiciones de picos
  let peaksArray = new Int32Array(peaks.length);
  for (let i = 0; i < peaks.length; i++) {
    peaksArray[i] = peaks[i];
  }
  
  // Copiar resultado a la memoria de salida
  memory.copy(peaksPtr, peaksArray.dataStart, peaks.length * 4);
}

/**
 * Calcula estadísticas sobre un array de valores
 * @param inputPtr Puntero al array de entrada
 * @param length Longitud del array
 * @returns Puntero a un array con las estadísticas [media, varianza, mínimo, máximo]
 */
export function calculateStats(inputPtr: i32, length: i32): i32 {
  let input = new Float32Array(length);
  
  // Copiar datos de entrada desde memoria
  memory.copy(input.dataStart, inputPtr, length * 4);
  
  // Calcular estadísticas
  let sum: f32 = 0.0;
  let min: f32 = f32.MAX_VALUE;
  let max: f32 = f32.MIN_VALUE;
  
  for (let i = 0; i < length; i++) {
    const val = input[i];
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  const mean: f32 = sum / f32(length);
  
  // Calcular varianza
  let variance: f32 = 0.0;
  for (let i = 0; i < length; i++) {
    variance += (input[i] - mean) * (input[i] - mean);
  }
  variance /= f32(length);
  
  // Crear array con resultados
  let results = new Float32Array(4);
  results[0] = mean;
  results[1] = variance;
  results[2] = min;
  results[3] = max;
  
  // Alocar memoria para el resultado
  let resultsPtr = heap.alloc(4 * 4) as i32;
  memory.copy(resultsPtr, results.dataStart, 4 * 4);
  
  return resultsPtr;
}

/**
 * Aplica un filtro paso-bajo a un array de valores
 * @param inputPtr Puntero al array de entrada
 * @param length Longitud del array
 * @param cutoff Frecuencia de corte normalizada (0-1)
 * @returns Puntero al array filtrado
 */
export function applyLowPassFilter(inputPtr: i32, length: i32, cutoff: f32): i32 {
  let input = new Float32Array(length);
  let output = new Float32Array(length);
  
  // Copiar datos de entrada desde memoria
  memory.copy(input.dataStart, inputPtr, length * 4);
  
  // Parámetro del filtro
  const alpha: f32 = cutoff / (cutoff + 0.159155);
  
  // Filtrar
  output[0] = input[0];
  for (let i = 1; i < length; i++) {
    output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
  }
  
  // Alocar memoria para el resultado
  let outputPtr = heap.alloc(length * 4) as i32;
  memory.copy(outputPtr, output.dataStart, length * 4);
  
  return outputPtr;
}

/**
 * Filtro de señal (función principal)
 * @param inputPtr Puntero al array de entrada
 * @param length Longitud del array
 * @param filterType Tipo de filtro (0=Kalman, 1=paso-bajo)
 * @returns Puntero al array filtrado
 */
export function filterSignal(inputPtr: i32, length: i32, filterType: i32): i32 {
  if (filterType === 0) {
    // Filtro Kalman
    let output = new Float32Array(length);
    let outputPtr = heap.alloc(length * 4) as i32;
    applyKalmanFilter(inputPtr, length, 0.01, 0.1, outputPtr);
    return outputPtr;
  } else {
    // Filtro paso-bajo
    return applyLowPassFilter(inputPtr, length, 0.1);
  }
}
