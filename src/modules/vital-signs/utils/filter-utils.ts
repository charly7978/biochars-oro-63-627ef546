
/**
 * Utilidades de filtrado para procesamiento de señales
 * Solo procesa datos reales, sin simulación
 */

/**
 * Aplica un filtro paso banda a una señal
 */
export function applyBandpassFilter(values: number[], lowCutoff = 0.5, highCutoff = 5.0, sampleRate = 30): number[] {
  if (values.length < 2) return [...values];
  
  const dt = 1 / sampleRate;
  const RC_low = 1 / (2 * Math.PI * lowCutoff);
  const RC_high = 1 / (2 * Math.PI * highCutoff);
  const alpha_low = dt / (RC_low + dt);
  const alpha_high = RC_high / (RC_high + dt);
  
  const filteredValues: number[] = [];
  let lastLowPass = values[0];
  let lastHighPass = 0;
  
  for (let i = 0; i < values.length; i++) {
    // Filtro paso bajo
    lastLowPass = lastLowPass + alpha_low * (values[i] - lastLowPass);
    
    // Filtro paso alto
    lastHighPass = alpha_high * (lastHighPass + values[i] - values[Math.max(0, i-1)]);
    
    filteredValues.push(lastLowPass - lastHighPass);
  }
  
  return filteredValues;
}

/**
 * Aplica un filtro paso bajo a una señal
 */
export function applyLowpassFilter(values: number[], cutoff = 5.0, sampleRate = 30): number[] {
  if (values.length < 2) return [...values];
  
  const dt = 1 / sampleRate;
  const RC = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (RC + dt);
  
  const filteredValues: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const filtered = filteredValues[i-1] + alpha * (values[i] - filteredValues[i-1]);
    filteredValues.push(filtered);
  }
  
  return filteredValues;
}

/**
 * Aplica un filtro paso alto a una señal
 */
export function applyHighpassFilter(values: number[], cutoff = 0.5, sampleRate = 30): number[] {
  if (values.length < 2) return [...values];
  
  const dt = 1 / sampleRate;
  const RC = 1 / (2 * Math.PI * cutoff);
  const alpha = RC / (RC + dt);
  
  const filteredValues: number[] = [0];
  
  for (let i = 1; i < values.length; i++) {
    const filtered = alpha * (filteredValues[i-1] + values[i] - values[i-1]);
    filteredValues.push(filtered);
  }
  
  return filteredValues;
}
