
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal-processor';
import { KalmanFilter } from './signal-processing/KalmanFilter';
import { SignalQualityAnalyzer } from './signal-processing/SignalQualityAnalyzer';
import { FingerDetector } from './signal-processing/FingerDetector';
import { PerfusionIndexCalculator } from './signal-processing/PerfusionIndexCalculator';
import { RedChannelExtractor } from './signal-processing/RedChannelExtractor';

/**
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
  private lastProcessedValues: number[] = [];
  private readonly BUFFER_SIZE = 10;
  
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
      this.kalmanFilter.reset();
      this.signalQualityAnalyzer.reset();
      this.fingerDetector.reset();
      this.perfusionCalculator.reset();
      this.lastProcessedValues = [];
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
    this.kalmanFilter.reset();
    this.signalQualityAnalyzer.reset();
    this.fingerDetector.reset();
    this.perfusionCalculator.reset();
    this.lastProcessedValues = [];
    console.log("PPGSignalProcessor: Stopped");
  }

  /**
   * Calibrate the processor (analyze baseline signal properties)
   */
  async calibrate(): Promise<boolean> {
    try {
      await this.initialize();
      console.log("PPGSignalProcessor: Calibration complete");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Calibration error", error);
      this.handleError("CALIBRATION_ERROR", "Error during calibration");
      return false;
    }
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
      
      // Store processed values for trend analysis
      this.lastProcessedValues.push(filtered);
      if (this.lastProcessedValues.length > this.BUFFER_SIZE) {
        this.lastProcessedValues.shift();
      }
      
      // Calculate signal quality with improved sensitivity
      const quality = this.signalQualityAnalyzer.assessQuality(filtered, redValue);
      
      // Enhanced finger detection with trend analysis
      const hasTrend = this.hasSignificantTrend();
      const { isFingerDetected, confidence } = 
        this.fingerDetector.detectFinger(redValue, filtered, quality);
      
      // Improve detection by considering trend
      const enhancedFingerDetection = isFingerDetected || (hasTrend && quality > 30);
      
      // Calculate perfusion index
      const perfusionIndex = this.perfusionCalculator.calculatePI(filtered);

      // Log detailed detection info for debugging
      if (Math.random() < 0.05) { // Log only occasionally to avoid flooding
        console.log("PPGSignalProcessor: Detection details", {
          redValue,
          filtered,
          quality,
          originalDetection: isFingerDetected,
          enhancedDetection: enhancedFingerDetection,
          hasTrend,
          confidence,
          perfusionIndex,
          valueBuffer: [...this.lastProcessedValues]
        });
      }

      // Create processed signal object
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: Math.round(quality),
        fingerDetected: enhancedFingerDetection,
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
   * Analyze if there's a significant trend in the signal that indicates finger presence
   */
  private hasSignificantTrend(): boolean {
    if (this.lastProcessedValues.length < 5) return false;

    // Calculate the min-max range in recent values
    const recentValues = this.lastProcessedValues.slice(-5);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;

    // Check for variation - a good PPG signal should have peaks and valleys
    const hasVariation = range > 0.8;

    // Calculate if values are changing in a pattern (not just random noise)
    let patternCount = 0;
    for (let i = 2; i < recentValues.length; i++) {
      const prev2 = recentValues[i-2];
      const prev1 = recentValues[i-1];
      const current = recentValues[i];
      
      // Check if we have a consecutive increase or decrease (potential pattern)
      if ((prev2 < prev1 && prev1 < current) || (prev2 > prev1 && prev1 > current)) {
        patternCount++;
      }
    }
    
    const hasPattern = patternCount >= 2;
    
    return hasVariation && hasPattern;
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
