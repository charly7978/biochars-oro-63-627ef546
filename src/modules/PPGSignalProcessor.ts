
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal-processor';
import { KalmanFilter } from './signal-processing/KalmanFilter';
import { SignalQualityAnalyzer } from './signal-processing/SignalQualityAnalyzer';
import { FingerDetector } from './signal-processing/FingerDetector';
import { PerfusionIndexCalculator } from './signal-processing/PerfusionIndexCalculator';
import { RedChannelExtractor } from './signal-processing/RedChannelExtractor';

/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Main PPG signal processor that integrates various processing components
 * to extract and analyze photoplethysmogram signals from camera data
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private signalQualityAnalyzer: SignalQualityAnalyzer;
  private fingerDetector: FingerDetector;
  private perfusionCalculator: PerfusionIndexCalculator; 
  private redChannelExtractor: RedChannelExtractor;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.signalQualityAnalyzer = new SignalQualityAnalyzer();
    this.fingerDetector = new FingerDetector();
    this.perfusionCalculator = new PerfusionIndexCalculator();
    this.redChannelExtractor = new RedChannelExtractor();
    console.log("PPGSignalProcessor: Instance created");
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    try {
      this.reset();
      console.log("PPGSignalProcessor: Initialized");
    } catch (error) {
      console.error("PPGSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", "Error initializing the processor");
    }
  }

  /**
   * Start signal processing
   */
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Started");
  }

  /**
   * Stop signal processing
   */
  stop(): void {
    this.isProcessing = false;
    this.reset();
    console.log("PPGSignalProcessor: Stopped");
  }

  /**
   * Reset all processor components
   */
  reset(): void {
    this.kalmanFilter.reset();
    this.signalQualityAnalyzer.reset();
    this.fingerDetector.reset();
    this.perfusionCalculator.reset();
    console.log("PPGSignalProcessor: Reset complete");
  }

  /**
   * Process a single frame from the camera
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extract red channel value from image
      const redValue = this.redChannelExtractor.extractRedValue(imageData);
      
      // Apply Kalman filter to reduce noise
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Calculate signal quality
      const quality = this.signalQualityAnalyzer.assessQuality(filtered, redValue);
      
      // Detect if finger is present
      const { isFingerDetected, confidence } = 
        this.fingerDetector.detectFinger(redValue, filtered, quality);
      
      // Calculate perfusion index
      const perfusionIndex = this.perfusionCalculator.calculatePI(filtered);

      // Create processed signal object
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: Math.round(quality),
        fingerDetected: isFingerDetected,
        roi: {
          x: 0,
          y: 0,
          width: 100,
          height: 100
        },
        perfusionIndex
      };

      // Notify listeners
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }

    } catch (error) {
      console.error("PPGSignalProcessor: Error processing frame", error);
      this.handleError("PROCESSING_ERROR", "Error processing frame");
    }
  }

  /**
   * Handle and report processor errors
   */
  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    if (this.onError) {
      this.onError(error);
    }
  }
}
