
/**
 * Estimator para glucosa basado únicamente en señal PPG cruda sin ajustes que forcen resultado.
 */

import { SignalAnalyzer } from './SignalAnalyzer';

export class GlucoseEstimator extends SignalAnalyzer {
  private lastEstimate: number = NaN; // No predicción forzada
  
  constructor() {
    super();
  }
  
  public analyze(ppgValues: number[]): number {
    // Solo devolver valor medio simple de señales reales para mostrar sin cálculo ni calibración.
    if (ppgValues.length === 0) {
      return NaN; 
    }

    const recentValues = ppgValues.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    this.lastEstimate = mean;
    return mean;  // Valor puro promedio para referencia visual.
  }
  
  public estimate(ppgValues: number[]): number {
    return this.analyze(ppgValues);
  }
  
  public reset(): void {
    super.reset();
    this.lastEstimate = NaN;
  }
}
