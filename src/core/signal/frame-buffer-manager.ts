
/**
 * Frame buffer manager for smooth visualization and processing
 * Implements an advanced buffering system with interpolation
 */

export interface FrameBufferOptions {
  maxBufferSize: number;
  processingInterval: number; // ms
  interpolationFactor: number; // 0-1
}

export interface BufferedFrame {
  value: number;
  timestamp: number;
  processed: boolean;
  interpolated: boolean;
}

export class FrameBufferManager {
  private buffer: BufferedFrame[] = [];
  private options: FrameBufferOptions;
  private processingTimerId: number | null = null;
  private lastProcessedIndex = -1;
  private processingCallback: ((value: number) => void) | null = null;
  private isProcessing = false;
  
  constructor(options: Partial<FrameBufferOptions> = {}) {
    this.options = {
      maxBufferSize: 60,
      processingInterval: 33, // ~30fps
      interpolationFactor: 0.3,
      ...options
    };
  }
  
  /**
   * Add a new frame to the buffer
   */
  public addFrame(value: number): void {
    const frame: BufferedFrame = {
      value,
      timestamp: Date.now(),
      processed: false,
      interpolated: false
    };
    
    this.buffer.push(frame);
    
    // If buffer exceeds max size, remove oldest frames
    if (this.buffer.length > this.options.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.options.maxBufferSize);
      
      // Update last processed index if needed
      if (this.lastProcessedIndex > 0) {
        this.lastProcessedIndex = Math.max(0, this.lastProcessedIndex - (this.buffer.length - this.options.maxBufferSize));
      }
    }
    
    // Start processing if not already started
    this.startProcessing();
  }
  
  /**
   * Set the callback for processing frames
   */
  public setProcessingCallback(callback: (value: number) => void): void {
    this.processingCallback = callback;
  }
  
  /**
   * Start the processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing || !this.processingCallback) {
      return;
    }
    
    this.isProcessing = true;
    this.processNextFrame();
  }
  
  /**
   * Process the next frame in the buffer
   */
  private processNextFrame(): void {
    // Clear any existing timer
    if (this.processingTimerId !== null) {
      window.clearTimeout(this.processingTimerId);
      this.processingTimerId = null;
    }
    
    // Check if there are frames to process
    if (this.buffer.length === 0 || !this.processingCallback) {
      this.isProcessing = false;
      return;
    }
    
    let nextIndex = this.lastProcessedIndex + 1;
    
    // If we've processed all frames, check if we need to add interpolated frames
    if (nextIndex >= this.buffer.length) {
      // Check if we should add an interpolated frame
      const lastFrame = this.buffer[this.buffer.length - 1];
      const now = Date.now();
      const timeSinceLastFrame = now - lastFrame.timestamp;
      
      if (timeSinceLastFrame > this.options.processingInterval * 2) {
        // Add interpolated frame
        const interpolatedValue = this.interpolateValue();
        this.buffer.push({
          value: interpolatedValue,
          timestamp: now,
          processed: false,
          interpolated: true
        });
        nextIndex = this.buffer.length - 1;
      } else {
        // Schedule next processing cycle
        this.processingTimerId = window.setTimeout(
          () => this.processNextFrame(),
          this.options.processingInterval
        );
        return;
      }
    }
    
    // Process the frame
    const frame = this.buffer[nextIndex];
    if (this.processingCallback && !frame.processed) {
      this.processingCallback(frame.value);
      frame.processed = true;
      this.lastProcessedIndex = nextIndex;
    }
    
    // Schedule next processing cycle
    this.processingTimerId = window.setTimeout(
      () => this.processNextFrame(),
      this.options.processingInterval
    );
  }
  
  /**
   * Create an interpolated value based on recent frames
   */
  private interpolateValue(): number {
    if (this.buffer.length < 2) {
      return this.buffer.length > 0 ? this.buffer[0].value : 0;
    }
    
    // Get the last few frames for interpolation
    const recentFrames = this.buffer.slice(-5);
    
    // Calculate weighted average with more weight to recent frames
    let sum = 0;
    let weights = 0;
    
    for (let i = 0; i < recentFrames.length; i++) {
      const weight = Math.pow(i + 1, 2); // Square to give more weight to recent frames
      sum += recentFrames[i].value * weight;
      weights += weight;
    }
    
    // Add slight random variation for more natural appearance
    const baseValue = sum / weights;
    const randomFactor = 0.02; // 2% random variation
    const randomVariation = (Math.random() * 2 - 1) * randomFactor * baseValue;
    
    return baseValue + randomVariation;
  }
  
  /**
   * Stop processing and clear the buffer
   */
  public stop(): void {
    if (this.processingTimerId !== null) {
      window.clearTimeout(this.processingTimerId);
      this.processingTimerId = null;
    }
    
    this.isProcessing = false;
    this.buffer = [];
    this.lastProcessedIndex = -1;
  }
  
  /**
   * Get all frames in the buffer
   */
  public getFrames(): BufferedFrame[] {
    return [...this.buffer];
  }
  
  /**
   * Get buffer statistics
   */
  public getStats(): {
    bufferSize: number;
    processedFrames: number;
    interpolatedFrames: number;
    bufferFullness: number;
  } {
    const processedFrames = this.buffer.filter(frame => frame.processed).length;
    const interpolatedFrames = this.buffer.filter(frame => frame.interpolated).length;
    
    return {
      bufferSize: this.buffer.length,
      processedFrames,
      interpolatedFrames,
      bufferFullness: this.buffer.length / this.options.maxBufferSize
    };
  }
}
