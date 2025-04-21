
/**
 * Estimator para hidratación con señal PPG cruda sin ajuste ni calibración.
 */

import { SignalAnalyzer } from './SignalAnalyzer';

export class HydrationEstimator extends SignalAnalyzer {
  private lastEstimate: number = NaN;
  
  constructor() {
    super();
  }
  
  public analyze(ppgValues: number[]): number {
    if (ppgValues.length === 0) {
      return NaN;
    }

    const recentValues = ppgValues.slice(-40);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    this.lastEstimate = mean;
    return mean; // Valor puro promedio.
  }
  
  public reset(): void {
    super.reset();
    this.lastEstimate = NaN;
  }
}
