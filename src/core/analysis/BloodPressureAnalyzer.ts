
/**
 * Analyzer para presión arterial basado solo en señal PPG cruda sin cálculo ni calibración.
 */

import { SignalAnalyzer } from './SignalAnalyzer';

export class BloodPressureAnalyzer extends SignalAnalyzer {
  private lastSystolic: number = NaN;
  private lastDiastolic: number = NaN;
  
  constructor() {
    super();
  }
  
  public analyze(ppgValues: number[]): { systolic: number; diastolic: number } {
    if (ppgValues.length === 0) {
      return { systolic: NaN, diastolic: NaN };
    }
    
    // Simplificación: solo devuelve valores máximos y mínimos de la señal cruda para mostrar.
    const recentValues = ppgValues.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    
    this.lastSystolic = max;
    this.lastDiastolic = min;
    
    return { systolic: max, diastolic: min };
  }
  
  public reset(): void {
    super.reset();
    this.lastSystolic = NaN;
    this.lastDiastolic = NaN;
  }
}
