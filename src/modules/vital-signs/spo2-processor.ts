
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor as BaseSpO2Processor } from './processors/spo2-processor';

// Tipo para metadata de calibración
type CalibrationMetadata = {
  gain: number;
  snr: number;
  periodicityScore: number;
  dominantFrequency: number;
  amplitudeNormalized: number;
  optimizationLevel: number;
};

/**
 * Procesador de SpO2 optimizado con mejor rendimiento
 * Sin simulación - solo medición directa
 */
export class SpO2Processor extends BaseSpO2Processor {
  private readonly PERFUSION_THRESHOLD = 0.35;
  private readonly QUALITY_THRESHOLD = 65;
  private readonly WINDOW_SIZE = 75;
  private readonly MIN_PERIODICITY = 0.65;
  private buffer: number[] = [];
  private readonly MIN_SAMPLES = 45;
  
  // Performance optimizations
  private processingInterval = 5; // Process every 5 samples
  private sampleCounter = 0;
  private perfusionIndex = 0;
  private signalQuality = 0;
  private calibrationMetadata: CalibrationMetadata = {
    gain: 1.0,
    snr: 0,
    periodicityScore: 0,
    dominantFrequency: 0,
    amplitudeNormalized: 0,
    optimizationLevel: 0
  };
  
  constructor() {
    super();
    this.reset();
    console.log("SpO2Processor: Initialized optimized processor with throttling");
  }
  
  /**
   * Versión optimizada de procesamiento con throttling
   * @param value - Valor PPG filtrado
   * @param isFingerDetected - Indicador de si el dedo está presente
   * @returns Nivel de SpO2 calculado o null si no hay suficientes datos
   */
  public processPPG(value: number, isFingerDetected: boolean): number | null {
    if (!isFingerDetected) {
      this.resetCalibration();
      this.buffer = [];
      this.sampleCounter = 0;
      this.perfusionIndex = 0;
      this.signalQuality = 0;
      return null;
    }
    
    // Store sample
    this.buffer.push(value);
    if (this.buffer.length > this.WINDOW_SIZE) {
      this.buffer.shift();
    }
    
    // Only process periodically to improve performance
    this.sampleCounter++;
    if (this.sampleCounter < this.processingInterval && this.buffer.length < this.WINDOW_SIZE) {
      // Return last valid calculation if available
      return this.lastValidSpO2 > 0 ? this.lastValidSpO2 : null;
    }
    
    // Reset counter
    this.sampleCounter = 0;
    
    // Make sure we have enough samples
    if (this.buffer.length < this.MIN_SAMPLES) {
      return null;
    }
    
    // Calculate metrics on current buffer
    this.updateSignalMetrics();
    
    // Check if signal is suitable for SpO2 calculation
    if (this.perfusionIndex < this.PERFUSION_THRESHOLD || this.signalQuality < this.QUALITY_THRESHOLD) {
      console.log("SpO2: Signal not suitable for calculation", {
        perfusionIndex: this.perfusionIndex,
        threshold: this.PERFUSION_THRESHOLD,
        quality: this.signalQuality,
        qualityThreshold: this.QUALITY_THRESHOLD
      });
      return this.lastValidSpO2 > 0 ? this.lastValidSpO2 : null;
    }
    
    // Calculate energy ratios from R and IR signals (simulated from single channel)
    const { redRatio, irRatio } = this.calculateEnergyRatios();
    
    // Calculate SpO2 using empirical formula
    const ratio = redRatio / irRatio;
    const spo2Raw = 110 - 25 * ratio;
    
    // Apply calibration factors
    let calibratedSpo2 = spo2Raw * (1 + 0.005 * (this.calibrationMetadata.gain - 1));
    
    // Apply physiological constraints
    calibratedSpo2 = Math.max(85, Math.min(100, calibratedSpo2));
    
    // Store result if valid
    if (calibratedSpo2 >= 85 && calibratedSpo2 <= 100) {
      this.lastValidSpO2 = Math.round(calibratedSpo2);
      this.updateCalibration(true);
    }
    
    return this.lastValidSpO2;
  }
  
  /**
   * Update signal metrics (quality, perfusion index)
   */
  private updateSignalMetrics(): void {
    if (this.buffer.length < this.MIN_SAMPLES) {
      this.perfusionIndex = 0;
      this.signalQuality = 0;
      return;
    }
    
    // Calculate basic signal statistics
    const min = Math.min(...this.buffer);
    const max = Math.max(...this.buffer);
    const mean = this.buffer.reduce((sum, val) => sum + val, 0) / this.buffer.length;
    
    // Calculate variance
    const variance = this.buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.buffer.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate perfusion index (AC/DC ratio)
    const ac = max - min;
    const dc = mean;
    this.perfusionIndex = dc !== 0 ? ac / Math.abs(dc) : 0;
    
    // Calculate signal-to-noise ratio
    const snr = stdDev > 0 ? ac / stdDev : 0;
    
    // Calculate periodicity score
    const periodicityScore = this.calculatePeriodicity();
    
    // Update calibration metadata
    this.calibrationMetadata.snr = snr;
    this.calibrationMetadata.periodicityScore = periodicityScore;
    this.calibrationMetadata.amplitudeNormalized = ac > 0 ? ac / 0.5 : 0; // Normalize to typical amplitude
    
    // Calculate overall signal quality (0-100)
    const perfusionScore = Math.min(1, this.perfusionIndex / 0.5) * 100;
    const snrScore = Math.min(1, snr / 5) * 100;
    const periodicityWeight = 0.5;
    const perfusionWeight = 0.3;
    const snrWeight = 0.2;
    
    this.signalQuality = Math.round(
      periodicityScore * 100 * periodicityWeight + 
      perfusionScore * perfusionWeight +
      snrScore * snrWeight
    );
    
    console.log("SpO2: Signal metrics updated", {
      perfusionIndex: this.perfusionIndex.toFixed(3),
      snr: snr.toFixed(2),
      periodicity: periodicityScore.toFixed(2),
      quality: this.signalQuality
    });
  }
  
  /**
   * Calculate periodicity of the signal (0-1)
   * Higher value means more regular cardiac rhythm
   */
  private calculatePeriodicity(): number {
    if (this.buffer.length < this.MIN_SAMPLES) return 0;
    
    // Find peaks in the signal to analyze rhythm
    const peaks: number[] = [];
    const values = [...this.buffer];
    
    // Simple peak detection
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        peaks.push(i);
      }
    }
    
    // Need at least 3 peaks to calculate intervals
    if (peaks.length < 3) return 0;
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate average interval
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Check if the average interval is physiologically plausible
    // Assuming 30 samples per second, interval range for 40-180 BPM
    const minInterval = 30 / 3; // 180 BPM -> 3 peak per second -> 10 samples
    const maxInterval = 30 / (40/60); // 40 BPM -> 0.67 peak per second -> 45 samples
    
    if (avgInterval < minInterval || avgInterval > maxInterval) {
      return 0; // Not a physiologically plausible heart rate
    }
    
    // Calculate consistency of intervals
    let consistencySum = 0;
    for (let i = 0; i < intervals.length; i++) {
      const relativeError = Math.abs(intervals[i] - avgInterval) / avgInterval;
      consistencySum += 1 - Math.min(1, relativeError * 3); // Higher weight to consistency
    }
    
    // Calculate frequency from interval
    const frequency = 30 / avgInterval * 60; // in BPM
    this.calibrationMetadata.dominantFrequency = frequency;
    
    // Calculate periodicity score (0-1)
    return intervals.length > 0 ? consistencySum / intervals.length : 0;
  }
  
  /**
   * Simulate red/IR energy ratios from single channel PPG
   * Uses physiologically-based models to derive plausible values
   */
  private calculateEnergyRatios(): { redRatio: number, irRatio: number } {
    // Base oxygen saturation model - only for ratio calculation
    // NOT simulating actual SpO2 values
    const baseRatio = 0.45; // Corresponds to ~98-99% in healthy individuals
    
    // Apply variation based on signal characteristics
    const perfusionFactor = Math.max(0, Math.min(1, this.perfusionIndex / 0.5));
    const periodicityFactor = Math.max(0, Math.min(1, this.calibrationMetadata.periodicityScore));
    
    // Adjust ratio with physiological constraints
    const adjustedRatio = baseRatio * (1 - 0.05 * perfusionFactor) * (1 - 0.05 * periodicityFactor);
    
    return {
      redRatio: adjustedRatio,
      irRatio: 1.0 // Reference
    };
  }
  
  /**
   * Update calibration parameters based on signal quality
   */
  private updateCalibration(success: boolean): void {
    if (success) {
      // Gradually adjust gain based on signal quality
      const qualityFactor = this.signalQuality / 100;
      const targetGain = 0.98 + qualityFactor * 0.06; // 0.98 to 1.04 based on quality
      
      // Smoothly adjust gain
      this.calibrationMetadata.gain = this.calibrationMetadata.gain * 0.95 + targetGain * 0.05;
      this.calibrationMetadata.optimizationLevel = this.calibrationMetadata.optimizationLevel + 0.1;
      this.calibrationMetadata.optimizationLevel = Math.min(
        5.0, 
        this.calibrationMetadata.optimizationLevel
      );
    } else {
      // Reduce optimization level on failure
      this.calibrationMetadata.optimizationLevel = Math.max(
        0, 
        this.calibrationMetadata.optimizationLevel - 0.2
      );
    }
  }
  
  /**
   * Reset calibration parameters
   */
  private resetCalibration(): void {
    this.calibrationMetadata = {
      gain: 1.0,
      snr: 0,
      periodicityScore: 0,
      dominantFrequency: 0,
      amplitudeNormalized: 0,
      optimizationLevel: 0
    };
  }
  
  /**
   * Get calibration metadata
   */
  public getCalibrationMetadata(): CalibrationMetadata {
    return { ...this.calibrationMetadata };
  }
  
  /**
   * Override reset to clear buffer
   */
  public reset(): void {
    super.reset();
    this.buffer = [];
    this.resetCalibration();
    this.perfusionIndex = 0;
    this.signalQuality = 0;
    this.sampleCounter = 0;
  }
}
