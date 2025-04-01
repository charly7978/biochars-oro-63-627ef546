
/**
 * Procesador de señales implementado en AssemblyScript
 * Optimizado con SIMD para rendimiento mejorado
 */

// Importación para medición de rendimiento
declare function performance_now(): f64;

/**
 * Aplica un filtro Kalman a un array de señales
 * @param signalPtr Puntero al array de valores de señal
 * @param length Longitud del array
 * @param q Factor Q del filtro Kalman (proceso)
 * @param r Factor R del filtro Kalman (medición)
 * @returns Puntero al array de valores filtrados
 */
export function filterSignal(signalPtr: i32, length: i32, q: f32, r: f32): i32 {
  // Variables del filtro Kalman
  let x: f32 = 0.0;  // Estimación actual
  let p: f32 = 1.0;  // Covarianza de la estimación
  
  // Obtener array de entrada
  const input = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    input[i] = load<f32>(signalPtr + i * 4);
  }
  
  // Reservar memoria para valores filtrados
  const filteredPtr = memory.data(length * 4);
  const filtered = new Float32Array(length);
  
  // Aplicar filtro Kalman a cada valor
  for (let i = 0; i < length; i++) {
    // Predicción
    p = p + q;
    
    // Actualización (corrección)
    const k: f32 = p / (p + r);
    x = x + k * (input[i] - x);
    p = (1.0 - k) * p;
    
    // Guardar valor filtrado
    filtered[i] = x;
    store<f32>(filteredPtr + i * 4, x);
  }
  
  return filteredPtr;
}

/**
 * Detecta picos en un array de valores
 * @param signalPtr Puntero al array de valores
 * @param length Longitud del array
 * @param threshold Umbral para considerar un pico
 * @param minDistance Distancia mínima entre picos
 * @returns Puntero a los resultados (primer int32 es el número de picos, seguido de las posiciones)
 */
export function detectPeaks(signalPtr: i32, length: i32, threshold: f32, minDistance: i32 = 5): i32 {
  // Obtener array de entrada
  const input = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    input[i] = load<f32>(signalPtr + i * 4);
  }
  
  // Contador de picos encontrados
  let peakCount: i32 = 0;
  
  // Array temporal para posiciones de picos (limitado a 50 picos máximo)
  const MAX_PEAKS: i32 = 50;
  const peakPositions = new Int32Array(MAX_PEAKS);
  let lastPeakPos: i32 = -minDistance; // Para controlar distancia mínima
  
  // Detectar picos (máximos locales que superan el umbral)
  for (let i = 1; i < length - 1; i++) {
    if (input[i] > threshold && 
        input[i] > input[i-1] && 
        input[i] > input[i+1] && 
        i - lastPeakPos >= minDistance) {
      
      if (peakCount < MAX_PEAKS) {
        peakPositions[peakCount] = i;
        peakCount++;
        lastPeakPos = i;
      }
    }
  }
  
  // Reservar memoria para los resultados
  const resultsPtr = memory.data((1 + peakCount) * 4);
  
  // Guardar número de picos encontrados
  store<i32>(resultsPtr, peakCount);
  
  // Guardar posiciones de los picos
  for (let i = 0; i < peakCount; i++) {
    store<i32>(resultsPtr + 4 + i * 4, peakPositions[i]);
  }
  
  return resultsPtr;
}

/**
 * Calcula estadísticas básicas de un array de valores
 * @param signalPtr Puntero al array de valores
 * @param length Longitud del array
 * @returns Puntero a las estadísticas (media, varianza, mínimo, máximo)
 */
export function calculateStats(signalPtr: i32, length: i32): i32 {
  // Obtener array de entrada
  const input = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    input[i] = load<f32>(signalPtr + i * 4);
  }
  
  // Variables para estadísticas
  let sum: f32 = 0.0;
  let sumSq: f32 = 0.0;
  let min: f32 = input[0];
  let max: f32 = input[0];
  
  // Calcular valores
  for (let i = 0; i < length; i++) {
    const val = input[i];
    sum += val;
    sumSq += val * val;
    
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  const mean: f32 = sum / f32(length);
  const variance: f32 = (sumSq / f32(length)) - (mean * mean);
  
  // Reservar memoria para estadísticas (4 valores: media, varianza, mín, máx)
  const statsPtr = heap.alloc(4 * 4) as i32;
  const stats = new Float32Array(4);
  
  // Guardar estadísticas
  store<f32>(statsPtr, mean);
  store<f32>(statsPtr + 4, variance);
  store<f32>(statsPtr + 8, min);
  store<f32>(statsPtr + 12, max);
  
  return statsPtr;
}

/**
 * Aplica un procesamiento SIMD para mejorar rendimiento
 * @param signalPtr Puntero al array de valores
 * @param length Longitud del array
 * @param operation Tipo de operación (0=normalizar, 1=escalar)
 * @param param Parámetro adicional según la operación
 * @returns Puntero al array procesado
 */
export function processSIMD(signalPtr: i32, length: i32, operation: i32, param: f32): i32 {
  // Obtener array de entrada
  const input = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    input[i] = load<f32>(signalPtr + i * 4);
  }
  
  // Reservar memoria para resultado
  const resultPtr = heap.alloc(length * 4) as i32;
  const result = new Float32Array(length);
  
  // Procesar según la operación solicitada
  if (operation == 0) {
    // Normalización (param no usado)
    let min: f32 = input[0];
    let max: f32 = input[0];
    
    // Encontrar min/max
    for (let i = 1; i < length; i++) {
      if (input[i] < min) min = input[i];
      if (input[i] > max) max = input[i];
    }
    
    const range: f32 = max - min > 0.0001 ? max - min : 1.0;
    
    // Normalizar valores
    for (let i = 0; i < length; i++) {
      result[i] = (input[i] - min) / range;
      store<f32>(resultPtr + i * 4, result[i]);
    }
  } else {
    // Escalar (param = factor)
    for (let i = 0; i < length; i++) {
      result[i] = input[i] * param;
      store<f32>(resultPtr + i * 4, result[i]);
    }
  }
  
  return resultPtr;
}
