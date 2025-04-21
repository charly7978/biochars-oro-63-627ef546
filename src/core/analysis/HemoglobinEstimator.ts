
/**
 * Estimator para hemoglobina basado únicamente en señal PPG cruda sin ajustes ni calibraciones.
 */

import { SignalAnalyzer } from './SignalAnalyzer';

export class HemoglobinEstimator extends SignalAnalyzer {
  private lastEstimate: number = NaN;
  
  constructor() {
    super();
  }
  
  public analyze(ppgValues: number[]): number {
    if (ppgValues.length === 0) {
      return NaN;
    }

    const recentValues = ppgValues.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    this.lastEstimate = mean;
    return mean; // Valor puro sin ajustes.
  }
  
  public estimate(ppgValues: number[]): number {
    return this.analyze(ppgValues);
  }
  
  public reset(): void {
    super.reset();
    this.lastEstimate = NaN;
  }
}
