
import { ArrhythmiaDetector } from '../../core/analysis/ArrhythmiaDetector';

export class ArrhythmiaProcessor {
  private detector: ArrhythmiaDetector;
  
  constructor() {
    this.detector = new ArrhythmiaDetector();
  }
  
  processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }) {
    if (!rrData) {
      return { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    }
    
    const result = this.detector.processRRData(rrData);
    
    if (result.arrhythmiaStatus === 'normal') {
      return { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    }
    
    const arrhythmiaStatus = `${result.arrhythmiaStatus.toUpperCase()}`;
    return { 
      arrhythmiaStatus, 
      lastArrhythmiaData: result.lastArrhythmiaData 
    };
  }
  
  getArrhythmiaCount(): number {
    return this.detector.getArrhythmiaCount();
  }
  
  reset(): void {
    this.detector.reset();
  }
}
