
/**
 * Specialized channel for SpO2 processing
 */
import { SpecializedChannel } from './SpecializedChannel';

export class SpO2Channel extends SpecializedChannel {
  private spo2: number = 0;
  private confidence: number = 0;
  private lastCalculation: number = 0;
  
  constructor() {
    super('spo2');
  }
  
  protected processBuffer(): void {
    if (this.buffer.length < 10) {
      return;
    }
    
    const now = Date.now();
    // Only recalculate every 2 seconds
    if (now - this.lastCalculation < 2000) {
      return;
    }
    
    // Basic SpO2 calculation (placeholder implementation)
    const recentValues = this.buffer.slice(-30);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Simple calculation (for demo)
    const baseSpO2 = 95;
    const variation = (avgValue * 5) % 4;
    
    this.spo2 = Math.max(90, Math.min(99, Math.round(baseSpO2 + variation)));
    this.confidence = 0.8 + (recentValues.length / 150); // Higher confidence with more data
    this.lastCalculation = now;
  }
  
  public getResults(): { spo2: number; confidence: number } {
    return {
      spo2: this.spo2,
      confidence: Math.min(0.98, this.confidence)
    };
  }
  
  protected resetChannel(): void {
    this.spo2 = 0;
    this.confidence = 0;
    this.lastCalculation = 0;
  }
}
