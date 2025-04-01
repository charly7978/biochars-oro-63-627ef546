
/**
 * Specialized channel for SpO2 signal processing
 * Optimizes the signal specifically for oxygen saturation measurement
 * Focuses on AC/DC ratio and perfusion characteristics
 */

import { SpecializedChannel, ChannelConfig } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';

/**
 * SpO2-specific channel
 */
export class SpO2Channel extends SpecializedChannel {
  // SpO2-specific parameters
  private readonly PERFUSION_WEIGHT = 0.65;   // Weight for perfusion components
  private readonly ABSORPTION_WEIGHT = 0.35;  // Weight for absorption components
  private readonly AC_EMPHASIS = 1.2;         // Emphasis on AC component
  
  // Calculate AC/DC ratio for SpO2
  private acComponentBuffer: number[] = [];
  private dcComponentBuffer: number[] = [];
  private readonly COMPONENT_BUFFER_SIZE = 50; // Buffer size for AC/DC components
  
  constructor(config: ChannelConfig) {
    super(VitalSignType.SPO2, config);
  }
  
  /**
   * Apply SpO2-specific optimization to the signal
   * - Emphasizes AC/DC ratio critical for oxygen saturation
   * - Enhances perfusion-related components
   * - Optimizes for absorption characteristics
   */
  protected applyChannelSpecificOptimization(value: number): number {
    // Extract AC and DC components
    const { ac, dc } = this.extractACDCComponents(value);
    
    // Store components
    this.updateComponentBuffers(ac, dc);
    
    // Enhance perfusion component (related to oxygenated blood flow)
    const perfusionComponent = this.enhancePerfusionComponent(ac, dc);
    
    // Enhance absorption component (related to different hemoglobin absorption)
    const absorptionComponent = this.enhanceAbsorptionComponent(value, dc);
    
    // Combine components with specific weighting for SpO2
    const optimizedValue = dc + 
                         (perfusionComponent * this.PERFUSION_WEIGHT) +
                         (absorptionComponent * this.ABSORPTION_WEIGHT);
    
    // Apply AC emphasis for better SpO2 correlation
    return optimizedValue * this.AC_EMPHASIS;
  }
  
  /**
   * Extract AC and DC components from the signal
   */
  private extractACDCComponents(value: number): { ac: number, dc: number } {
    if (this.recentValues.length < 10) {
      return { ac: 0, dc: value };
    }
    
    // Calculate DC component as low-pass filtered signal
    const recentValues = this.recentValues.slice(-10);
    // Use weighted moving average with more weight on earlier values for DC
    const weights = recentValues.map((_, i) => 1 - (i / recentValues.length) * 0.5);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    
    const dc = recentValues.reduce((sum, val, i) => sum + val * weights[i], 0) / weightSum;
    
    // AC is the current value minus DC
    const ac = value - dc;
    
    return { ac, dc };
  }
  
  /**
   * Update buffers for AC and DC components
   */
  private updateComponentBuffers(ac: number, dc: number): void {
    // Store AC component
    this.acComponentBuffer.push(ac);
    if (this.acComponentBuffer.length > this.COMPONENT_BUFFER_SIZE) {
      this.acComponentBuffer.shift();
    }
    
    // Store DC component
    this.dcComponentBuffer.push(dc);
    if (this.dcComponentBuffer.length > this.COMPONENT_BUFFER_SIZE) {
      this.dcComponentBuffer.shift();
    }
  }
  
  /**
   * Enhance perfusion component specifically for SpO2
   */
  private enhancePerfusionComponent(ac: number, dc: number): number {
    // Perfusion index is AC/DC ratio
    const perfusionIndex = dc !== 0 ? Math.abs(ac / dc) : 0;
    
    // Calculate average perfusion index over buffer
    let avgPerfusionIndex = perfusionIndex;
    if (this.acComponentBuffer.length > 5 && this.dcComponentBuffer.length > 5) {
      let sumPerfusion = 0;
      const count = Math.min(this.acComponentBuffer.length, this.dcComponentBuffer.length);
      
      for (let i = 0; i < count; i++) {
        sumPerfusion += Math.abs(this.acComponentBuffer[i] / Math.max(0.001, this.dcComponentBuffer[i]));
      }
      
      avgPerfusionIndex = sumPerfusion / count;
    }
    
    // Apply non-linear enhancement of perfusion component
    // Higher perfusion should be weighted more as it correlates with better signal
    const enhancedPerfusion = ac * (1 + avgPerfusionIndex * 2);
    
    return enhancedPerfusion;
  }
  
  /**
   * Enhance absorption component specifically for SpO2
   */
  private enhanceAbsorptionComponent(value: number, dc: number): number {
    if (this.recentValues.length < 5) {
      return value - dc;
    }
    
    // For SpO2, the relative absorption is important
    // In a full implementation this would use red/IR ratios
    
    // Calculate absorption variations
    const recentValues = this.recentValues.slice(-10);
    const variations = recentValues.map(v => v - dc);
    
    // Calculate rate of change in absorption
    let absorptionRateSum = 0;
    for (let i = 1; i < variations.length; i++) {
      absorptionRateSum += Math.abs(variations[i] - variations[i-1]);
    }
    
    const avgAbsorptionRate = absorptionRateSum / (variations.length - 1);
    
    // Emphasize absorption rate which correlates with SpO2
    const enhancementFactor = 1 + avgAbsorptionRate * 2;
    
    return (value - dc) * enhancementFactor;
  }
  
  /**
   * Calculate SpO2-specific signal quality
   */
  protected override updateQuality(): void {
    super.updateQuality();
    
    // Add SpO2-specific quality metrics if we have enough data
    if (this.acComponentBuffer.length > 10 && this.dcComponentBuffer.length > 10) {
      // Calculate AC/DC ratio stability (important for SpO2)
      const ratios = [];
      const count = Math.min(this.acComponentBuffer.length, this.dcComponentBuffer.length);
      
      for (let i = 0; i < count; i++) {
        const ratio = Math.abs(this.acComponentBuffer[i] / Math.max(0.001, this.dcComponentBuffer[i]));
        ratios.push(ratio);
      }
      
      // Calculate ratio stability
      const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
      const ratioVariations = ratios.map(r => Math.pow(r - avgRatio, 2));
      const ratioStability = 1 - Math.min(1, Math.sqrt(
        ratioVariations.reduce((sum, v) => sum + v, 0) / ratios.length
      ) / avgRatio);
      
      // Blend with existing quality metric
      this.quality = this.quality * 0.6 + ratioStability * 0.4;
    }
  }
  
  /**
   * Reset channel state
   */
  public override reset(): void {
    super.reset();
    this.acComponentBuffer = [];
    this.dcComponentBuffer = [];
  }
  
  /**
   * Get current AC/DC ratio for SpO2 calculation
   */
  public getACDCRatio(): number {
    if (this.acComponentBuffer.length === 0 || this.dcComponentBuffer.length === 0) {
      return 0;
    }
    
    // Calculate average AC and DC
    const avgAC = this.acComponentBuffer.reduce((sum, val) => sum + Math.abs(val), 0) / this.acComponentBuffer.length;
    const avgDC = this.dcComponentBuffer.reduce((sum, val) => sum + Math.abs(val), 0) / this.dcComponentBuffer.length;
    
    // Return ratio
    return avgDC > 0 ? avgAC / avgDC : 0;
  }
}
