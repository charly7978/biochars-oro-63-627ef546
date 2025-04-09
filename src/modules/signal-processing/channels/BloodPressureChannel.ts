
/**
 * Specialized channel for blood pressure processing
 */
import { SpecializedChannel } from './SpecializedChannel';

export class BloodPressureChannel extends SpecializedChannel {
  private systolic: number = 0;
  private diastolic: number = 0;
  private map: number = 0;
  private confidence: number = 0;
  private lastCalculation: number = 0;
  
  constructor() {
    super('blood-pressure');
  }
  
  protected processBuffer(): void {
    if (this.buffer.length < 15) {
      return;
    }
    
    const now = Date.now();
    // Only recalculate every 3 seconds
    if (now - this.lastCalculation < 3000) {
      return;
    }
    
    // Basic blood pressure calculation (placeholder implementation)
    const recentValues = this.buffer.slice(-45);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Simple calculation (for demo)
    const baseSystolic = 120;
    const baseDiastolic = 80;
    const systolicVar = avgValue * 10;
    const diastolicVar = avgValue * 5;
    
    this.systolic = Math.round(baseSystolic + systolicVar);
    this.diastolic = Math.round(baseDiastolic + diastolicVar);
    this.map = Math.round(this.diastolic + (this.systolic - this.diastolic) / 3);
    this.confidence = 0.7 + (recentValues.length / 120); // Higher confidence with more data
    this.lastCalculation = now;
  }
  
  public getResults(): { systolic: number; diastolic: number; map: number; confidence: number } {
    return {
      systolic: this.systolic,
      diastolic: this.diastolic,
      map: this.map,
      confidence: Math.min(0.92, this.confidence)
    };
  }
  
  protected resetChannel(): void {
    this.systolic = 0;
    this.diastolic = 0;
    this.map = 0;
    this.confidence = 0;
    this.lastCalculation = 0;
  }
}
