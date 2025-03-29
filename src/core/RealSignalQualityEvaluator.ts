
/**
 * Signal quality evaluation module for PPG signals
 * Uses real signal data to determine quality metrics
 */

export interface SignalQualityResult {
  level: number;        // 0 to 1 normalized quality level
  color: string;        // color identifier for UI (red, yellow, green, etc)
  label: string;        // human-readable label
  description?: string; // optional detailed description
}

/**
 * Evaluate PPG signal quality based on real signal characteristics
 * @param values - Array of PPG signal values
 * @returns Quality assessment result
 */
export const evaluateSignalQuality = (values: number[]): SignalQualityResult => {
  if (!values || values.length < 10) {
    return {
      level: 0, 
      color: "gray",
      label: "Sin datos"
    };
  }

  // Calculate basic statistics
  const min = Math.min(...values);
  const max = Math.max(...values);
  const amplitude = max - min;
  
  // Calculate average and standard deviation
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
  );
  
  // Calculate signal-to-noise ratio (simplified)
  const snr = amplitude / (stdDev + 0.01);  // Add small epsilon to avoid division by zero
  
  // Check for peaks and signal consistency
  let peakCount = 0;
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peakCount++;
    }
  }
  
  // Normalized metrics (0-1 scale)
  const amplitudeScore = Math.min(1, amplitude / 0.5);
  const snrScore = Math.min(1, snr / 5);
  const peakScore = Math.min(1, peakCount / (values.length / 15));
  
  // Weighted quality level
  const level = 0.5 * amplitudeScore + 0.3 * snrScore + 0.2 * peakScore;
  
  // Determine color and label based on quality level
  let color = "gray";
  let label = "Desconocida";
  
  if (level < 0.3) {
    color = "red";
    label = "Señal débil";
  } else if (level < 0.6) {
    color = "yellow";
    label = "Señal media";
  } else if (level < 0.85) {
    color = "green";
    label = "Señal buena";
  } else {
    color = "emerald";
    label = "Señal óptima";
  }
  
  return { level, color, label };
};
