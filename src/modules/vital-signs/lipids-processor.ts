import { LipidsResult } from '../../types/vital-signs';

export class LipidsProcessor {
  private lastValidResult: LipidsResult = {
    totalCholesterol: 0,
    triglycerides: 0
  };

  public calculateLipids(ppgSignal: number[]): LipidsResult {
    if (!ppgSignal || ppgSignal.length < 2) {
      return this.lastValidResult;
    }

    // Calculate lipid values based on signal characteristics
    const totalCholesterol = this.calculateTotalCholesterol(ppgSignal);
    const triglycerides = this.calculateTriglycerides(ppgSignal);

    this.lastValidResult = {
      totalCholesterol,
      triglycerides
    };

    return this.lastValidResult;
  }

  private calculateTotalCholesterol(signal: number[]): number {
    // Simplified calculation based on signal characteristics
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const amplitude = Math.max(...signal) - Math.min(...signal);
    
    return Math.max(150, Math.min(300, mean * 200 + amplitude * 50));
  }

  private calculateTriglycerides(signal: number[]): number {
    // Simplified calculation based on signal variations
    const variations = signal.slice(1).map((val, i) => Math.abs(val - signal[i]));
    const meanVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
    
    return Math.max(50, Math.min(200, meanVariation * 100));
  }

  public reset(): void {
    this.lastValidResult = {
      totalCholesterol: 0,
      triglycerides: 0
    };
  }
} 