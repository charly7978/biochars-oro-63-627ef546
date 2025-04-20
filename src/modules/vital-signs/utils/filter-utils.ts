// Bandpass filter: acepta Float32Array o number[]
export const applyBandpassFilter = (values: Float32Array | number[], lowCut: number, highCut: number, sampleRate: number): Float32Array => {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    // Filtro simple (ejemplo): puedes reemplazar por IIR real si tienes coeficientes
    out[i] = values[i] * (highCut - lowCut) / sampleRate;
    out[i] = Math.max(-1, Math.min(1, out[i]));
  }
  return out;
};

// Lowpass filter: versión incremental (EMA/IIR)
export const applyLowpassFilter = (values: Float32Array | number[], cutoff: number, sampleRate: number): Float32Array => {
  const alpha = cutoff / (sampleRate * 0.5);
  const out = new Float32Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
};

// Highpass filter: versión incremental
export const applyHighpassFilter = (values: Float32Array | number[], cutoff: number, sampleRate: number): Float32Array => {
  const alpha = cutoff / (sampleRate * 0.5);
  const out = new Float32Array(values.length);
  let lastInput = values[0];
  let lastOutput = 0;
  out[0] = 0;
  for (let i = 1; i < values.length; i++) {
    out[i] = alpha * (out[i - 1] + values[i] - lastInput);
    lastInput = values[i];
    lastOutput = out[i];
  }
  return out;
};
