
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;  // Measurement noise
  private Q: number = 0.1;   // Process noise
  private P: number = 1;     // Estimation error covariance
  private X: number = 0;     // State estimate
  private K: number = 0;     // Kalman gain

  filter(measurement: number): number {
    // Prediction step
    this.P = this.P + this.Q;
    
    // Update step
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

// Advanced adaptive filter for PPG signal processing
class AdaptiveFilter {
  private weights: number[] = [];
  private readonly length: number;
  private readonly learningRate: number;
  private inputs: number[] = [];
  
  constructor(length: number = 5, learningRate: number = 0.01) {
    this.length = length;
    this.learningRate = learningRate;
    // Initialize weights with small random values
    this.weights = Array(length).fill(0).map(() => Math.random() * 0.1);
    this.inputs = Array(length).fill(0);
  }
  
  filter(input: number): number {
    // Shift inputs
    this.inputs.shift();
    this.inputs.push(input);
    
    // Calculate output
    let output = 0;
    for (let i = 0; i < this.length; i++) {
      output += this.weights[i] * this.inputs[i];
    }
    
    // Update weights (LMS algorithm)
    const error = input - output;
    for (let i = 0; i < this.length; i++) {
      this.weights[i] += this.learningRate * error * this.inputs[i];
    }
    
    return output;
  }
  
  reset(): void {
    this.weights = Array(this.length).fill(0).map(() => Math.random() * 0.1);
    this.inputs = Array(this.length).fill(0);
  }
}

// IIR Bandpass Filter optimized for PPG signals (0.5-5Hz range, typical heart rate range)
class BandpassFilter {
  private readonly a: number[] = [1, -1.80898117793047, 0.827224100935914];
  private readonly b: number[] = [0.095057507454072, 0, -0.095057507454072];
  private readonly order: number = 2;
  private x: number[] = [0, 0, 0]; // Input history
  private y: number[] = [0, 0, 0]; // Output history
  
  filter(input: number): number {
    // Shift input/output history
    for (let i = this.order; i > 0; i--) {
      this.x[i] = this.x[i-1];
      this.y[i] = this.y[i-1];
    }
    
    // New input
    this.x[0] = input;
    
    // Calculate new output
    this.y[0] = this.b[0] * this.x[0];
    for (let i = 1; i <= this.order; i++) {
      this.y[0] += this.b[i] * this.x[i] - this.a[i] * this.y[i];
    }
    
    return this.y[0];
  }
  
  reset(): void {
    this.x = Array(this.order + 1).fill(0);
    this.y = Array(this.order + 1).fill(0);
  }
}

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private adaptiveFilter: AdaptiveFilter;
  private bandpassFilter: BandpassFilter;
  private lastValues: number[] = [];
  private ppgBuffer: number[] = []; // Buffer for PPG values
  private readonly MAX_BUFFER_SIZE = 300;
  
  // Advanced configuration parameters
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 10,
    MIN_RED_THRESHOLD: 70,
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 3,
    // ROI detection parameters
    ROI_PERCENTAGE: 0.25, // Center 25% of the image by default
    ROI_ADAPTIVE: true,   // Dynamically adjust ROI based on signal quality
    // Signal enhancement parameters
    ENHANCE_CONTRAST: true,
    DENOISE_STRENGTH: 0.8,
    // Frame processing parameters
    SKIP_FRAMES: 0,       // Process every frame
    DOWNSAMPLE_FACTOR: 2  // Downsample resolution by 2x for faster processing
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035;
  private frameCounter: number = 0;
  private lastRoiCenter: {x: number, y: number} = {x: 0, y: 0};
  private roiQuality: number = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.adaptiveFilter = new AdaptiveFilter(8, 0.02); // 8-tap filter with 0.02 learning rate
    this.bandpassFilter = new BandpassFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Enhanced instance created with advanced filtering");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.ppgBuffer = [];
      this.frameCounter = 0;
      this.kalmanFilter.reset();
      this.adaptiveFilter.reset();
      this.bandpassFilter.reset();
      this.lastRoiCenter = {x: 0, y: 0};
      this.roiQuality = 0;
      console.log("PPGSignalProcessor: Initialized with advanced processing pipeline");
    } catch (error) {
      console.error("PPGSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", "Error initializing processor");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Started with optimized processing pipeline");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.ppgBuffer = [];
    this.kalmanFilter.reset();
    this.adaptiveFilter.reset();
    this.bandpassFilter.reset();
    console.log("PPGSignalProcessor: Stopped");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Starting advanced calibration");
      await this.initialize();
      
      // Adjust thresholds based on current conditions
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(25, this.currentConfig.MIN_RED_THRESHOLD - 5),
        MAX_RED_THRESHOLD: Math.min(255, this.currentConfig.MAX_RED_THRESHOLD + 5),
        ROI_PERCENTAGE: 0.3, // Larger initial ROI during calibration
        DENOISE_STRENGTH: 0.9 // Stronger denoising during calibration
      };

      console.log("PPGSignalProcessor: Calibration completed with optimized parameters", this.currentConfig);
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Calibration error", error);
      this.handleError("CALIBRATION_ERROR", "Error during calibration");
      return false;
    }
  }

  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuration reset to defaults");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Optional frame skipping for performance
      this.frameCounter++;
      if (this.currentConfig.SKIP_FRAMES > 0 && 
          this.frameCounter % (this.currentConfig.SKIP_FRAMES + 1) !== 0) {
        return;
      }
      
      // Advanced PPG extraction with adaptive ROI and multi-stage filtering
      const { redValue, greenValue, blueValue, roiQuality } = this.extractPPGSignal(imageData);
      
      // Update ROI quality metric
      this.roiQuality = this.roiQuality * 0.8 + roiQuality * 0.2;
      
      // Multi-stage filtering pipeline for optimal signal quality
      // 1. Apply bandpass filter to remove frequencies outside expected PPG range
      const bandpassFiltered = this.bandpassFilter.filter(redValue);
      
      // 2. Apply Kalman filter for noise reduction
      const kalmanFiltered = this.kalmanFilter.filter(bandpassFiltered);
      
      // 3. Apply adaptive filter for further enhancement
      const finalFiltered = this.adaptiveFilter.filter(kalmanFiltered);
      
      // Store in buffer for analysis
      this.ppgBuffer.push(finalFiltered);
      if (this.ppgBuffer.length > this.MAX_BUFFER_SIZE) {
        this.ppgBuffer.shift();
      }
      
      this.lastValues.push(finalFiltered);
      if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Advanced signal analysis
      const { isFingerDetected, quality } = this.analyzeSignal(finalFiltered, redValue);
      const perfusionIndex = this.calculatePerfusionIndex(this.lastValues);

      console.log("PPGSignalProcessor: Analysis", {
        redValue,
        filtered: finalFiltered,
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount,
        perfusionIndex,
        roiQuality: this.roiQuality
      });

      // Calculate additional spectral features for better metrics
      const spectralFeatures = this.calculateSpectralFeatures(this.lastValues);

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: finalFiltered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: perfusionIndex,
        // Additional advanced metrics
        spectralPower: spectralFeatures.totalPower,
        pulseAmplitude: spectralFeatures.amplitude,
        signalSnr: spectralFeatures.snr
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Frame processing error", error);
      this.handleError("PROCESSING_ERROR", "Error processing frame");
    }
  }

  private extractPPGSignal(imageData: ImageData): { 
    redValue: number, 
    greenValue: number, 
    blueValue: number,
    roiQuality: number
  } {
    const data = imageData.data;
    
    // Determine ROI (Region of Interest)
    let startX, endX, startY, endY;
    
    if (this.currentConfig.ROI_ADAPTIVE && this.lastRoiCenter.x !== 0) {
      // Use adaptive ROI based on previous signal quality
      const roiSize = Math.max(0.2, Math.min(0.4, 0.3 + (this.roiQuality / 100) * 0.1));
      startX = Math.max(0, Math.floor(this.lastRoiCenter.x - imageData.width * roiSize / 2));
      endX = Math.min(imageData.width, Math.floor(this.lastRoiCenter.x + imageData.width * roiSize / 2));
      startY = Math.max(0, Math.floor(this.lastRoiCenter.y - imageData.height * roiSize / 2));
      endY = Math.min(imageData.height, Math.floor(this.lastRoiCenter.y + imageData.height * roiSize / 2));
    } else {
      // Use fixed center ROI
      const roiPercentage = this.currentConfig.ROI_PERCENTAGE;
      startX = Math.floor(imageData.width * (0.5 - roiPercentage / 2));
      endX = Math.floor(imageData.width * (0.5 + roiPercentage / 2));
      startY = Math.floor(imageData.height * (0.5 - roiPercentage / 2));
      endY = Math.floor(imageData.height * (0.5 + roiPercentage / 2));
    }
    
    // Sample points within ROI (with optional downsampling)
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    
    const downsample = this.currentConfig.DOWNSAMPLE_FACTOR;
    
    for (let y = startY; y < endY; y += downsample) {
      for (let x = startX; x < endX; x += downsample) {
        const i = (y * imageData.width + x) * 4;
        
        const red = data[i];     // R
        const green = data[i+1]; // G
        const blue = data[i+2];  // B
        
        redSum += red;
        greenSum += green;
        blueSum += blue;
        
        // Track min/max for contrast calculation
        maxRed = Math.max(maxRed, red);
        minRed = Math.min(minRed, red);
        
        pixelCount++;
      }
    }
    
    // Calculate averages
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calculate ROI quality based on red channel contrast and uniformity
    const contrast = maxRed - minRed;
    const roiQuality = Math.min(100, Math.max(0, 
      contrast >= 10 && contrast <= 100 ? 70 + contrast * 0.3 : 40
    ));
    
    // Update ROI center if good quality
    if (roiQuality > 60) {
      this.lastRoiCenter = {
        x: startX + (endX - startX) / 2,
        y: startY + (endY - startY) / 2
      };
    }
    
    // Apply optional contrast enhancement
    let enhancedRed = avgRed;
    if (this.currentConfig.ENHANCE_CONTRAST) {
      // Stretch histogram for better contrast
      const normalizedRed = (avgRed - minRed) / (maxRed - minRed + 0.001);
      enhancedRed = normalizedRed * 255;
    }
    
    return { 
      redValue: enhancedRed, 
      greenValue: avgGreen, 
      blueValue: avgBlue,
      roiQuality
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Check if value is in expected range for finger detection
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Enhanced stability detection with cardiac cycle analysis
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate first and second derivatives for cardiac cycle detection
    const firstDerivative = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });
    
    const secondDerivative = firstDerivative.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });
    
    // Cardiac cycle feature extraction
    const maxFirstDeriv = Math.max(...firstDerivative.map(Math.abs));
    const maxSecondDeriv = Math.max(...secondDerivative.map(Math.abs));
    
    // Adaptive threshold based on signal amplitude
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.025);
    
    // Enhanced stability criteria using first and second derivatives
    const isStable = maxFirstDeriv < adaptiveThreshold * 2 && 
                     maxSecondDeriv < adaptiveThreshold * 3;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Multi-factor quality score
      const stabilityScore = Math.min(this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2), 1);
      
      const intensityScore = Math.min((rawValue - this.currentConfig.MIN_RED_THRESHOLD) / 
                                     (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD), 1);
      
      const variationScore = Math.max(0, 1 - (maxFirstDeriv / (adaptiveThreshold * 3)));
      
      const derivativeScore = Math.max(0, 1 - (maxSecondDeriv / (adaptiveThreshold * 4)));
      
      // Weighted quality score with greater emphasis on stability
      quality = Math.round((stabilityScore * 0.4 + intensityScore * 0.2 + 
                          variationScore * 0.2 + derivativeScore * 0.2) * 100);
    }

    return { isFingerDetected, quality };
  }

  private calculatePerfusionIndex(values: number[]): number {
    if (values.length < 5) return 0;
    
    // Calculate DC component (mean)
    const dc = values.reduce((a, b) => a + b, 0) / values.length;
    if (dc === 0) return 0;
    
    // Calculate AC component (peak-to-peak amplitude)
    const ac = Math.max(...values) - Math.min(...values);
    
    // Perfusion index = AC/DC ratio
    return ac / dc;
  }
  
  private calculateSpectralFeatures(values: number[]): {
    totalPower: number,
    peakFrequency: number,
    amplitude: number,
    snr: number
  } {
    if (values.length < 8) {
      return { totalPower: 0, peakFrequency: 0, amplitude: 0, snr: 0 };
    }
    
    // Apply Hamming window to reduce spectral leakage
    const windowed = values.map((v, i) => 
      v * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (values.length - 1))));
    
    // Simplified DFT calculation
    const numBins = Math.floor(values.length / 2);
    const powerSpectrum = Array(numBins).fill(0);
    
    for (let k = 0; k < numBins; k++) {
      let realPart = 0;
      let imagPart = 0;
      
      for (let n = 0; n < values.length; n++) {
        const angle = -2 * Math.PI * k * n / values.length;
        realPart += windowed[n] * Math.cos(angle);
        imagPart += windowed[n] * Math.sin(angle);
      }
      
      powerSpectrum[k] = (realPart * realPart + imagPart * imagPart) / values.length;
    }
    
    // Calculate total power
    const totalPower = powerSpectrum.reduce((sum, power) => sum + power, 0);
    
    // Find peak frequency
    let peakIdx = 0;
    let peakPower = 0;
    for (let i = 1; i < numBins - 1; i++) {
      if (powerSpectrum[i] > peakPower) {
        peakPower = powerSpectrum[i];
        peakIdx = i;
      }
    }
    
    // Calculate normalized peak frequency (in Hz, assuming 30fps)
    const samplingRate = 30; // Approximate frame rate
    const peakFrequency = (peakIdx * samplingRate) / values.length;
    
    // Calculate SNR - peak power vs average noise power
    const signalPower = peakPower;
    const noiseFloor = (totalPower - peakPower) / (numBins - 1);
    const snr = noiseFloor > 0 ? 10 * Math.log10(signalPower / noiseFloor) : 0;
    
    // Calculate amplitude - peak-to-peak in time domain
    const amplitude = Math.max(...values) - Math.min(...values);
    
    return {
      totalPower,
      peakFrequency,
      amplitude,
      snr
    };
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    // Use last known good ROI center
    const roi = {
      x: this.lastRoiCenter.x || 0,
      y: this.lastRoiCenter.y || 0,
      width: 100,
      height: 100
    };
    
    return roi;
  }

  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
  
  // Method to access the PPG buffer from outside
  getPPGBuffer(): number[] {
    return [...this.ppgBuffer];
  }
}
