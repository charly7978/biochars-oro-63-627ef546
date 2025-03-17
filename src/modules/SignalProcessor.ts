
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { KalmanFilter } from './signal/KalmanFilter';
import { analyzeSignalPeriodicity, calculateMovementScore, calculateSpectrumData } from './signal/consistencyAnalysis';
import { extractRedChannel, calculatePerfusionIndex, detectROI, analyzeSignal } from './signal/signalExtraction';
import { applySMAFilter, updateConsistencyMetrics } from './signal/filtering';
import { handleSignalProcessingError } from './signal/errorHandling';

/**
 * PPG Signal Processor
 * Implements the SignalProcessor interface
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Default configuration
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 30, // Reduced for higher sensitivity
    MAX_RED_THRESHOLD: 250, // Increased for wider detection range
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 2 // Reduced for faster detection
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Processing parameters
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 30; // Lower value
  private readonly MAX_RED_THRESHOLD = 250; // Higher value
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2; // Reduced
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // New parameters for improved analysis
  private consistencyHistory: number[] = []; // History for consistency evaluation
  private readonly CONSISTENCY_BUFFER_SIZE = 8; // Window size for consistency
  private movementScores: number[] = []; // Movement scores
  private readonly MOVEMENT_HISTORY_SIZE = 10; // Movement history
  
  // Temporal processing
  private lastProcessedTime: number = 0;
  private readonly MIN_PROCESS_INTERVAL = 30; // Min interval in ms between processing
  
  // Periodicity analysis
  private readonly PERIODICITY_BUFFER_SIZE = 60; // Window for periodicity analysis
  private periodicityBuffer: number[] = [];
  private lastPeriodicityScore: number = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instance created");
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.consistencyHistory = [];
      this.movementScores = [];
      this.periodicityBuffer = [];
      this.lastPeriodicityScore = 0;
      console.log("PPGSignalProcessor: Initialized");
    } catch (error) {
      console.error("PPGSignalProcessor: Initialization error", error);
      handleSignalProcessingError("INIT_ERROR", "Error initializing processor", this.onError);
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
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.consistencyHistory = [];
    this.movementScores = [];
    this.periodicityBuffer = [];
    console.log("PPGSignalProcessor: Stopped");
  }

  /**
   * Calibrate the processor for better results
   */
  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Starting calibration");
      await this.initialize();

      // Calibration time
      await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced for faster response
      
      // Adjust thresholds based on current conditions - MORE PERMISSIVE
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(20, this.MIN_RED_THRESHOLD - 10), // Much more permissive
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD + 5),
        STABILITY_WINDOW: 3, // Smaller window to allow more variation
        MIN_STABILITY_COUNT: 2 // Requires fewer consecutive frames
      };

      console.log("PPGSignalProcessor: Calibration completed", this.currentConfig);
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Calibration error", error);
      handleSignalProcessingError("CALIBRATION_ERROR", "Error during calibration", this.onError);
      return false;
    }
  }

  /**
   * Reset to default configuration
   */
  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuration reset to defaults");
  }

  /**
   * Process a frame to extract PPG information
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Frequency control to avoid processing overload
      const now = Date.now();
      if (now - this.lastProcessedTime < this.MIN_PROCESS_INTERVAL) {
        return;
      }
      this.lastProcessedTime = now;
      
      // Extract red channel (primary for PPG)
      const redValue = extractRedChannel(imageData);
      
      // Apply initial filtering to reduce noise
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Store for analysis
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      // Periodicity analysis
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      // Calculate consistency over time
      this.consistencyHistory = updateConsistencyMetrics(
        filtered, 
        this.consistencyHistory, 
        this.CONSISTENCY_BUFFER_SIZE
      );
      
      // Calculate movement score (instability)
      const movementResult = calculateMovementScore(this.consistencyHistory, this.movementScores);
      const movementScore = movementResult.score;
      this.movementScores = movementResult.updatedMovementScores;
      
      // Analyze signal to determine quality and finger presence
      const analyzeResult = analyzeSignal(
        filtered, 
        redValue, 
        movementScore, 
        this.lastValues,
        this.stableFrameCount,
        this.lastPeriodicityScore,
        this.currentConfig
      );
      
      this.stableFrameCount = analyzeResult.updatedStableFrameCount;
      if (analyzeResult.lastStableValue !== 0) {
        this.lastStableValue = analyzeResult.lastStableValue;
      }
      
      // Calculate perfusion index
      const perfusionIndex = calculatePerfusionIndex(this.lastValues);
      
      // Analyze periodicity if we have enough data
      if (this.periodicityBuffer.length > 30) {
        this.lastPeriodicityScore = analyzeSignalPeriodicity(this.periodicityBuffer);
      }
      
      // Calculate spectral data
      const spectrumData = calculateSpectrumData(this.periodicityBuffer);

      // Create processed signal
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: analyzeResult.quality,
        fingerDetected: analyzeResult.isFingerDetected,
        roi: detectROI(redValue),
        perfusionIndex,
        spectrumData
      };

      // Send processed signal
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error processing frame", error);
      handleSignalProcessingError("PROCESSING_ERROR", "Error processing frame", this.onError);
    }
  }

  /**
   * Apply SMA filter (used externally)
   */
  applySMAFilter(value: number): number {
    return applySMAFilter(value, this.lastValues);
  }
}
