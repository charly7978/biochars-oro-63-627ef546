/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG Signal Processor implementation
 */

import { applyAdaptiveFilter } from './utils/adaptive-predictor';

class PPGSignalProcessor {
  private buffer: number[] = [];
  private timestamps: number[] = [];
  private maxBufferSize = 100;
  private lastProcessedValue: number = 0;
  private isProcessing: boolean = false;

  constructor() {
    console.log("PPGSignalProcessor initialized");
  }

  /**
   * Start processing
   */
  startProcessing(): void {
    this.isProcessing = true;
    console.log("PPGSignalProcessor: Processing started");
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    console.log("PPGSignalProcessor: Processing stopped");
  }

  /**
   * Process a new signal value
   */
  processValue(value: number): number {
    if (!this.isProcessing) return 0;
    
    // Add to buffer
    this.buffer.push(value);
    this.timestamps.push(Date.now());
    
    // Keep buffer at reasonable size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
      this.timestamps.shift();
    }
    
    // Process value if we have enough data
    if (this.buffer.length >= 3) {
      // Fixed: Pass the entire buffer to applyAdaptiveFilter instead of a single value
      this.lastProcessedValue = applyAdaptiveFilter(value, this.buffer, 0.3);
      return this.lastProcessedValue;
    }
    
    return value;
  }

  /**
   * Reset the processor state
   */
  reset(): void {
    this.buffer = [];
    this.timestamps = [];
    this.lastProcessedValue = 0;
    console.log("PPGSignalProcessor: Reset complete");
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
}

export { PPGSignalProcessor };
