
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Signal processing filters
 */

// Basic implementation of signal processing filters
export class SignalProcessor {
  // Apply a simple moving average filter
  static movingAverage(signal: number[], windowSize: number): number[] {
    if (windowSize <= 0 || signal.length === 0) return signal;
    
    const result: number[] = [];
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
        sum += signal[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  // Apply low-pass filter
  static lowPassFilter(signal: number[], alpha: number): number[] {
    if (signal.length === 0) return signal;
    
    const result: number[] = [signal[0]];
    for (let i = 1; i < signal.length; i++) {
      result.push(alpha * signal[i] + (1 - alpha) * result[i - 1]);
    }
    
    return result;
  }
}

// Export as both the class name and the alias expected by importers
export { SignalProcessor as SignalProcessingFilters };
