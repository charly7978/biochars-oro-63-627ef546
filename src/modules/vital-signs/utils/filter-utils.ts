
export const applyBandpassFilter = (values: number[], lowCut: number, highCut: number, sampleRate: number): number[] => {
  // Simple implementation of a bandpass filter
  return values.map(value => {
    // Basic filtering logic - in practice you'd want to use a proper DSP library
    const filtered = value * (highCut - lowCut) / sampleRate;
    return Math.max(-1, Math.min(1, filtered));
  });
};

export const applyLowpassFilter = (values: number[], cutoff: number, sampleRate: number): number[] => {
  const alpha = cutoff / (sampleRate * 0.5);
  const filtered: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      filtered.push(values[0]);
    } else {
      filtered.push(alpha * values[i] + (1 - alpha) * filtered[i - 1]);
    }
  }
  
  return filtered;
};

export const applyHighpassFilter = (values: number[], cutoff: number, sampleRate: number): number[] => {
  const alpha = cutoff / (sampleRate * 0.5);
  const filtered: number[] = [];
  let lastInput = 0;
  let lastOutput = 0;
  
  for (let i = 0; i < values.length; i++) {
    const output = alpha * (lastOutput + values[i] - lastInput);
    filtered.push(output);
    lastInput = values[i];
    lastOutput = output;
  }
  
  return filtered;
};
