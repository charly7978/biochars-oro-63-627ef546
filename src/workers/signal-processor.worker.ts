
/**
 * Signal Processor Web Worker
 * Handles computationally intensive signal processing off the main thread
 */

// Import types for worker messages
interface WorkerRequest {
  type: 'PROCESS_SIGNAL' | 'PROCESS_FRAME' | 'RESET' | 'CALIBRATE';
  payload?: any;
}

interface WorkerResponse {
  type: 'SIGNAL_PROCESSED' | 'FRAME_PROCESSED' | 'ERROR' | 'CALIBRATION_COMPLETE' | 'RESET_COMPLETE';
  payload?: any;
  error?: string;
}

// Setup basic signal processing functions in worker context
class WorkerKalmanFilter {
  private R: number = 0.01;  // Measurement noise
  private Q: number = 0.1;   // Process noise
  private P: number = 1;     // Error estimate
  private X: number = 0;     // Estimated value
  private K: number = 0;     // Kalman gain

  filter(measurement: number): number {
    // Prediction
    this.P = this.P + this.Q;
    
    // Update
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

// Setup simplified processor for worker context
class WorkerSignalProcessor {
  private kalmanFilter = new WorkerKalmanFilter();
  private lastValues: number[] = [];
  private readonly BUFFER_SIZE = 15;
  
  processSignal(value: number): { filteredValue: number, isPeak: boolean } {
    // Basic signal filtering
    const filtered = this.kalmanFilter.filter(value);
    
    // Store filtered value
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Simple peak detection
    let isPeak = false;
    if (this.lastValues.length >= 3) {
      const current = filtered;
      const previous = this.lastValues[this.lastValues.length - 2];
      const beforePrevious = this.lastValues[this.lastValues.length - 3];
      
      isPeak = current > previous && previous < beforePrevious;
    }
    
    return { filteredValue: filtered, isPeak };
  }
  
  reset() {
    this.lastValues = [];
    this.kalmanFilter.reset();
  }
}

// Create processor instance for the worker
const processor = new WorkerSignalProcessor();

// Register message handler for worker
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'PROCESS_SIGNAL':
        if (typeof payload === 'number') {
          const result = processor.processSignal(payload);
          postMessage({
            type: 'SIGNAL_PROCESSED',
            payload: result
          } as WorkerResponse);
        }
        break;
        
      case 'RESET':
        processor.reset();
        postMessage({
          type: 'RESET_COMPLETE'
        } as WorkerResponse);
        break;
        
      case 'CALIBRATE':
        // Simple calibration
        processor.reset();
        postMessage({
          type: 'CALIBRATION_COMPLETE',
          payload: { success: true }
        } as WorkerResponse);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
};

// Notify that worker is initialized
postMessage({
  type: 'SIGNAL_PROCESSED',
  payload: { initialized: true }
} as WorkerResponse);
