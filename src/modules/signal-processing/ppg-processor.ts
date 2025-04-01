/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG Processor implementation
 */

import { PPGSignalProcessor, ProcessorOptions } from './interfaces';
import { applyAdaptiveFilter, correctSignalAnomalies } from './utils/adaptive-predictor';
import { isFingerDetected } from './finger-detector';

/**
 * Processor for PPG signals
 */
export class PPGProcessor implements PPGSignalProcessor {
  private buffer: number[] = [];
  private timestamps: number[] = [];
  private qualityBuffer: number[] = [];
  private lastProcessedValue: number = 0;
  private isProcessing: boolean = false;
  private options: ProcessorOptions = {
    adaptationRate: 0.3,
    bufferSize: 50,
    useAdaptiveThresholds: true,
    sensitivityLevel: 'medium'
  };
  
  constructor() {
    console.log("PPGProcessor initialized");
  }

  /**
   * Start processing
   */
  startProcessing(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Processing started");
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Processing stopped");
  }

  /**
   * Process a new signal value
   */
  processValue(value: number): number {
    if (!this.isProcessing) return 0;
    
    const now = Date.now();
    
    // Add to buffer
    this.buffer.push(value);
    this.timestamps.push(now);
    
    // Keep buffer at reasonable size
    if (this.buffer.length > this.options.bufferSize!) {
      this.buffer.shift();
      this.timestamps.shift();
    }
    
    // Process value if we have enough data
    if (this.buffer.length >= 3) {
      // Calculate basic signal quality
      const recent = this.buffer.slice(-5);
      const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const stdDev = Math.sqrt(
        recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length
      );
      
      const signalToNoise = mean !== 0 ? Math.abs(mean) / (stdDev + 0.0001) : 0;
      const quality = Math.min(1, signalToNoise / 10);
      
      this.qualityBuffer.push(quality);
      if (this.qualityBuffer.length > 10) {
        this.qualityBuffer.shift();
      }
      
      // Apply filtering
      const processed = applyAdaptiveFilter(value, this.buffer, this.options.adaptationRate || 0.3);
      
      // Check for anomalies
      const corrected = this.buffer.length > 10 ? 
        correctSignalAnomalies(processed, this.buffer, 0.5) : processed;
      
      this.lastProcessedValue = corrected;
      return corrected;
    }
    
    this.lastProcessedValue = value;
    return value;
  }

  /**
   * Reset the processor state
   */
  reset(): void {
    this.buffer = [];
    this.timestamps = [];
    this.qualityBuffer = [];
    this.lastProcessedValue = 0;
    console.log("PPGProcessor: Reset complete");
  }

  /**
   * Configure the processor with options
   */
  configure(options: ProcessorOptions): void {
    this.options = { ...this.options, ...options };
    console.log("PPGProcessor: Configured with options", this.options);
  }

  /**
   * Get last processed value
   */
  getLastValue(): number {
    return this.lastProcessedValue;
  }

  /**
   * Get processing status
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Get signal quality
   */
  getSignalQuality(): number {
    if (this.qualityBuffer.length === 0) return 0;
    
    return this.qualityBuffer.reduce((sum, val) => sum + val, 0) / this.qualityBuffer.length;
  }

  /**
   * Check if finger is detected
   */
  isFingerDetected(): boolean {
    if (this.buffer.length < 10) return false;
    
    // Use the finger detector utility
    return isFingerDetected(this.buffer);
  }
}
