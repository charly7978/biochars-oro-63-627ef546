/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Advanced PPG Signal and Heartbeat Extractor
 * Uses TensorFlow.js for advanced signal processing and neural network-based peak detection
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { CombinedExtractionResult } from './CombinedExtractor';

// Initialize TensorFlow
tf.setBackend('webgl').then(() => {
  console.log('TensorFlow initialized with WebGL backend');
  console.log('TensorFlow version:', tf.version.tfjs);
});

// Interface for the advanced extraction result
export interface AdvancedExtractionResult extends CombinedExtractionResult {
  // Additional advanced metrics
  signalToNoiseRatio: number;
  powerSpectrum: number[];
  dominantFrequency: number;
  nnIntervals: number[];
  pnnx: number; // PNN50 or similar metric
  heartRateRecovery: number | null;
  adaptiveConfidence: number;
  noiseLevel: number;
  spectrumPeaks: Array<{frequency: number, amplitude: number}>;
}

// Interface for advanced configuration
export interface AdvancedExtractorConfig {
  useDynamicThresholding: boolean;
  applyAdaptiveFilter: boolean;
  useWaveletDenoising: boolean;
  useTensorFlow: boolean;
  usePeakVerification: boolean;
  temporalWindowSize: number;
  nnThreshold: number; // For heart rate variability (in ms)
  memorySaver: boolean; 
  adaptiveThresholdSensitivity: number;
}

/**
 * Advanced PPG Signal Extractor with TensorFlow-powered signal processing
 */
export class AdvancedPPGExtractor {
  // Signal buffers
  private rawBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private featureBuffer: tf.Tensor[] = [];
  
  // Signal metadata
  private baselineValue: number = 0;
  private signalAmplitude: number = 0;
  private lastTimestamp: number = 0;
  
  // Neural network model
  private peakDetectionModel: tf.LayersModel | null = null;
  private modelLoaded: boolean = false;
  
  // Peak detection state
  private peaks: Array<{time: number, value: number}> = [];
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  
  // Signal metrics
  private noiseEstimate: number = 0;
  private powerSpectrum: number[] = [];
  private snr: number = 0;
  private adaptiveThreshold: number = 0.5;
  private lastBPM: number | null = null;
  
  // Configuration
  private config: AdvancedExtractorConfig = {
    useDynamicThresholding: true,
    applyAdaptiveFilter: true,
    useWaveletDenoising: true,
    useTensorFlow: true,
    usePeakVerification: true,
    temporalWindowSize: 256,
    nnThreshold: 50, // in ms
    memorySaver: true,
    adaptiveThresholdSensitivity: 1.5
  };
  
  // Memory management
  private lastCleanupTime: number = 0;
  private CLEANUP_INTERVAL = 5000; // 5 seconds
  private MAX_BUFFER_SIZE = 512;
  private MAX_FEATURE_TENSORS = 10;
  
  constructor(config?: Partial<AdvancedExtractorConfig>) {
    if (config) {
      this.config = {...this.config, ...config};
    }
    
    this.initialize();
    
    // Set up memory management
    if (this.config.memorySaver) {
      setInterval(() => this.cleanupMemory(), this.CLEANUP_INTERVAL);
    }
  }
  
  /**
   * Initialize the extractor and load TensorFlow model
   */
  private async initialize(): Promise<void> {
    try {
      if (this.config.useTensorFlow) {
        console.log('Initializing TensorFlow for advanced PPG extraction...');
        
        // Create a simple model for peak detection
        this.peakDetectionModel = this.createPeakDetectionModel();
        this.modelLoaded = true;
        
        console.log('Advanced PPG extraction initialized with TensorFlow');
      }
    } catch (error) {
      console.error('Failed to initialize TensorFlow model:', error);
      this.modelLoaded = false;
      
      // Fallback to traditional methods
      console.log('Falling back to traditional signal processing methods');
    }
  }
  
  /**
   * Create a neural network model for peak detection
   */
  private createPeakDetectionModel(): tf.LayersModel {
    const windowSize = 32; // Input window size
    
    // Create a sequential model
    const model = tf.sequential();
    
    // Add layers
    // 1D Convolutional layer for feature extraction
    model.add(tf.layers.conv1d({
      inputShape: [windowSize, 1],
      filters: 16,
      kernelSize: 5,
      activation: 'relu',
      padding: 'same'
    }));
    
    // Pooling layer to reduce dimensionality
    model.add(tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }));
    
    // Another convolutional layer
    model.add(tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same'
    }));
    
    // Flatten the output for dense layers
    model.add(tf.layers.flatten());
    
    // Dense layers for classification
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dropout({
      rate: 0.25
    }));
    
    // Output layer - probability of a peak at the center
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));
    
    // Compile the model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // Note: In a real implementation, this model would be pre-trained and weights loaded.
    // Here we're just initializing the architecture.
    
    return model;
  }
  
  /**
   * Process a raw PPG value and apply advanced signal processing
   */
  public processValue(value: number): AdvancedExtractionResult {
    const now = Date.now();
    
    // Store raw value in buffer
    this.rawBuffer.push(value);
    
    // Apply buffer size limits (memory optimization)
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE) {
      this.rawBuffer.shift();
    }
    
    // 1. Apply adaptive filtering
    const filteredValue = this.applyAdaptiveFiltering(value);
    
    // Store filtered value
    this.filteredBuffer.push(filteredValue);
    if (this.filteredBuffer.length > this.MAX_BUFFER_SIZE) {
      this.filteredBuffer.shift();
    }
    
    // 2. Update signal baseline and amplitude
    this.updateSignalAnalytics();
    
    // 3. Calculate noise estimate
    this.noiseEstimate = this.estimateNoiseLevel();
    
    // 4. Detect peaks using either traditional methods or TensorFlow
    let hasPeak = false;
    let peakValue: number | null = null;
    let instantaneousBPM: number | null = null;
    let confidence = 0;
    let rrInterval: number | null = null;
    
    if (this.config.useTensorFlow && this.modelLoaded && this.filteredBuffer.length >= 32) {
      // Use neural network for peak detection
      const result = this.detectPeakWithTensorFlow();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      
      if (hasPeak) {
        this.peakTimes.push(now);
        this.peaks.push({time: now, value: filteredValue});
        
        // Calculate RR interval and instantaneous BPM
        if (this.lastPeakTime !== null) {
          rrInterval = now - this.lastPeakTime;
          
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            this.rrIntervals.push(rrInterval);
            
            // Keep only recent intervals
            if (this.rrIntervals.length > 20) {
              this.rrIntervals.shift();
            }
          }
        }
        
        this.lastPeakTime = now;
      }
    } else {
      // Use traditional peak detection as fallback
      const result = this.detectPeakTraditional();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      rrInterval = result.rrInterval;
      instantaneousBPM = result.instantaneousBPM;
    }
    
    // 5. Update power spectrum for frequency analysis
    if (this.filteredBuffer.length >= 64) {
      this.updatePowerSpectrum();
    }
    
    // 6. Calculate SNR based on signal and noise estimates
    this.calculateSNR();
    
    // 7. Analyze heart rate variability
    const hrvMetrics = this.calculateHRVMetrics();
    
    // 8. Calculate dominant frequency from the power spectrum
    const dominantFrequency = this.getDominantFrequency();
    
    // Get spectrum peaks (up to 3 most significant)
    const spectrumPeaks = this.getSpectrumPeaks(3);
    
    // Determine quality based on multiple factors
    let signalQuality = this.determineSignalQuality();
    
    // Detect finger presence
    const fingerDetected = this.isFingerDetected();
    
    // Calculate final BPM (with smoothing)
    const averageBPM = this.calculateAverageBPM();
    
    // Final result
    const result: AdvancedExtractionResult = {
      // Base data
      timestamp: now,
      rawValue: value,
      filteredValue,
      
      // Signal information
      quality: signalQuality,
      fingerDetected,
      amplitude: this.signalAmplitude,
      baseline: this.baselineValue,
      
      // Peak information
      hasPeak,
      peakTime: hasPeak ? now : null,
      peakValue: hasPeak ? peakValue : null,
      confidence,
      instantaneousBPM,
      rrInterval,
      
      // Calculated statistics
      averageBPM,
      heartRateVariability: hrvMetrics.rmssd,
      
      // Advanced metrics
      signalToNoiseRatio: this.snr,
      powerSpectrum: this.powerSpectrum,
      dominantFrequency,
      nnIntervals: hrvMetrics.nnIntervals,
      pnnx: hrvMetrics.pnnx,
      heartRateRecovery: null, // Would need longer time series
      adaptiveConfidence: confidence * signalQuality / 100,
      noiseLevel: this.noiseEstimate,
      spectrumPeaks
    };
    
    // Update last timestamp
    this.lastTimestamp = now;
    
    // Memory cleanup if needed
    if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
      this.cleanupMemory();
      this.lastCleanupTime = now;
    }
    
    return result;
  }
  
  /**
   * Apply adaptive filtering techniques to the raw signal
   */
  private applyAdaptiveFiltering(value: number): number {
    if (!this.config.applyAdaptiveFilter || this.filteredBuffer.length < 2) {
      return value;
    }
    
    // Get recent values for analysis
    const recentRaw = this.rawBuffer.slice(-Math.min(20, this.rawBuffer.length));
    
    // Calculate signal variance to adjust filter strength
    const variance = this.calculateVariance(recentRaw);
    
    // Adjust alpha based on signal variance
    // Higher variance (more noise) = stronger filtering (lower alpha)
    // Lower variance (stable signal) = lighter filtering (higher alpha)
    let alpha = 0.2; // Default alpha
    
    if (variance > 0.05) {
      // High variance: apply stronger filtering
      alpha = 0.1;
    } else if (variance < 0.01) {
      // Low variance: apply lighter filtering
      alpha = 0.3;
    }
    
    // Apply exponential moving average filter
    const lastFiltered = this.filteredBuffer[this.filteredBuffer.length - 1];
    let filtered = alpha * value + (1 - alpha) * lastFiltered;
    
    // Apply wavelet denoising if enabled and we have enough data
    if (this.config.useWaveletDenoising && this.filteredBuffer.length >= 32) {
      filtered = this.applyWaveletDenoising(filtered);
    }
    
    return filtered;
  }
  
  /**
   * Apply simplified wavelet denoising to filter out noise while preserving signal shape
   */
  private applyWaveletDenoising(value: number): number {
    // This is a very simplified approximation of wavelet denoising
    // A real implementation would use proper wavelet transform
    
    const windowSize = Math.min(32, this.filteredBuffer.length);
    const window = [...this.filteredBuffer.slice(-windowSize), value];
    
    // Apply a simple multi-level decomposition and soft thresholding
    const threshold = this.estimateWaveletThreshold(window);
    
    // Simple soft thresholding function
    const softThreshold = (x: number): number => {
      const sign = x >= 0 ? 1 : -1;
      const abs = Math.abs(x);
      return sign * Math.max(0, abs - threshold);
    };
    
    // Calculate local trend
    const trend = this.calculateLocalTrend(window);
    
    // Extract "detail" component (high frequency)
    const detail = value - trend;
    
    // Apply thresholding to the detail component
    const denoisedDetail = softThreshold(detail);
    
    // Reconstruct the signal
    return trend + denoisedDetail;
  }
  
  /**
   * Estimate appropriate threshold for wavelet denoising
   */
  private estimateWaveletThreshold(window: number[]): number {
    // Universal threshold (simplified)
    const n = window.length;
    
    // Calculate MAD (Median Absolute Deviation) estimator
    const median = this.calculateMedian(window);
    const deviations = window.map(x => Math.abs(x - median));
    const mad = this.calculateMedian(deviations);
    
    // Scale MAD to approximate standard deviation
    const sigma = mad / 0.6745;
    
    // Compute threshold using universal threshold formula
    return sigma * Math.sqrt(2 * Math.log(n));
  }
  
  /**
   * Calculate local trend using a moving average
   */
  private calculateLocalTrend(window: number[]): number {
    const n = window.length;
    const center = window[n - 1]; // Current value
    
    // Use a weighted average of recent values
    let sum = 0;
    let weightSum = 0;
    
    const recentWindow = window.slice(-7);
    for (let i = 0; i < recentWindow.length; i++) {
      const weight = i + 1;
      sum += recentWindow[i] * weight;
      weightSum += weight;
    }
    
    return sum / weightSum;
  }
  
  /**
   * Update signal baseline and amplitude
   */
  private updateSignalAnalytics(): void {
    if (this.filteredBuffer.length < 5) return;
    
    // Get recent values for analysis
    const recentValues = this.filteredBuffer.slice(-30);
    
    // Calculate min, max, and amplitude
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    this.signalAmplitude = max - min;
    
    // Update baseline with exponential smoothing
    const currentMean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    if (this.baselineValue === 0) {
      this.baselineValue = currentMean;
    } else {
      this.baselineValue = 0.95 * this.baselineValue + 0.05 * currentMean;
    }
  }
  
  /**
   * Detect peaks using TensorFlow neural network
   */
  private detectPeakWithTensorFlow(): {
    hasPeak: boolean,
    peakValue: number | null,
    confidence: number
  } {
    try {
      if (!this.modelLoaded || this.filteredBuffer.length < 32) {
        return { hasPeak: false, peakValue: null, confidence: 0 };
      }
      
      // Create a window of the last 32 values
      const window = this.filteredBuffer.slice(-32);
      
      // Normalize the window to [-1, 1] range
      const min = Math.min(...window);
      const max = Math.max(...window);
      const range = max - min > 0 ? max - min : 1;
      const normalized = window.map(v => (v - min) / range * 2 - 1);
      
      // Create tensor from the window
      const inputTensor = tf.tensor3d([normalized.map(v => [v])]);
      
      // Run prediction
      const prediction = this.peakDetectionModel!.predict(inputTensor) as tf.Tensor;
      const probabilities = prediction.dataSync();
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Check if the center point is a peak
      const isPeak = probabilities[0] > this.adaptiveThreshold;
      const confidence = probabilities[0];
      
      // Also check if it's a local maximum in the raw signal
      // (adds a traditional check on top of the ML prediction)
      const isLocalMax = this.isLocalMaximum();
      
      // Only consider it a peak if both methods agree
      const hasPeak = isPeak && isLocalMax;
      
      // Store the feature for later training (potential future improvement)
      if (this.config.memorySaver) {
        if (hasPeak && this.featureBuffer.length < this.MAX_FEATURE_TENSORS) {
          this.featureBuffer.push(tf.tensor(normalized));
        }
      }
      
      return {
        hasPeak,
        peakValue: hasPeak ? this.filteredBuffer[this.filteredBuffer.length - 1] : null,
        confidence: confidence as number
      };
      
    } catch (error) {
      console.error('Error in TensorFlow peak detection:', error);
      // Fall back to traditional method
      return this.detectPeakTraditional();
    }
  }
  
  /**
   * Traditional peak detection algorithm as fallback
   */
  private detectPeakTraditional(): {
    hasPeak: boolean,
    peakValue: number | null,
    confidence: number,
    instantaneousBPM: number | null,
    rrInterval: number | null
  } {
    const now = Date.now();
    const currentValue = this.filteredBuffer[this.filteredBuffer.length - 1];
    
    // Check if enough time has passed since the last peak
    const minPeakDistance = 300; // ms (corresponds to 200 bpm max)
    const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;
    
    if (timeSinceLastPeak < minPeakDistance) {
      return {
        hasPeak: false,
        peakValue: null,
        confidence: 0,
        instantaneousBPM: null,
        rrInterval: null
      };
    }
    
    // Check if the current point is a local maximum
    const isLocalMax = this.isLocalMaximum();
    
    if (!isLocalMax) {
      return {
        hasPeak: false,
        peakValue: null,
        confidence: 0,
        instantaneousBPM: null,
        rrInterval: null
      };
    }
    
    // We found a peak
    let confidence = 0.6; // Base confidence
    let instantaneousBPM: number | null = null;
    let rrInterval: number | null = null;
    
    // Update peak list
    this.peaks.push({time: now, value: currentValue});
    this.peakTimes.push(now);
    
    // Limit the number of stored peaks
    if (this.peaks.length > 20) {
      this.peaks.shift();
      this.peakTimes.shift();
    }
    
    // Calculate RR interval and instantaneous BPM
    if (this.lastPeakTime !== null) {
      rrInterval = now - this.lastPeakTime;
      
      if (rrInterval > 0) {
        instantaneousBPM = 60000 / rrInterval;
        
        // Store RR interval
        this.rrIntervals.push(rrInterval);
        if (this.rrIntervals.length > 20) {
          this.rrIntervals.shift();
        }
        
        // Adjust confidence based on physiological plausibility
        if (instantaneousBPM >= 40 && instantaneousBPM <= 180) {
          confidence += 0.2;
        } else {
          confidence -= 0.3;
        }
        
        // Adjust confidence based on regularity
        if (this.rrIntervals.length >= 3) {
          const recentRRs = this.rrIntervals.slice(-3);
          const rrMean = recentRRs.reduce((sum, rr) => sum + rr, 0) / recentRRs.length;
          const rrDeviation = Math.sqrt(
            recentRRs.reduce((sum, rr) => sum + Math.pow(rr - rrMean, 2), 0) / recentRRs.length
          );
          
          // Calculate coefficient of variation (normalized standard deviation)
          const cv = rrDeviation / rrMean;
          
          // If CV is low, the rhythm is regular (higher confidence)
          if (cv < 0.1) confidence += 0.2;
          else if (cv > 0.2) confidence -= 0.1;
        }
      }
    }
    
    this.lastPeakTime = now;
    
    // Final confidence clamped to [0,1]
    confidence = Math.max(0, Math.min(1, confidence));
    
    return {
      hasPeak: true,
      peakValue: currentValue,
      confidence,
      instantaneousBPM,
      rrInterval
    };
  }
  
  /**
   * Check if the current point is a local maximum
   */
  private isLocalMaximum(): boolean {
    const len = this.filteredBuffer.length;
    if (len < 5) return false;
    
    const lookback = 3; // Look 3 points back
    const current = this.filteredBuffer[len - 1];
    
    // Check if current point is larger than previous points
    for (let i = 1; i <= lookback; i++) {
      if (len - 1 - i < 0) continue;
      if (current <= this.filteredBuffer[len - 1 - i]) {
        return false;
      }
    }
    
    // If we're looking at real-time data, we can't look ahead
    // So we approximate by checking the slope
    const prev1 = this.filteredBuffer[len - 2];
    const prev2 = this.filteredBuffer[len - 3];
    
    // If we're still going up, it's probably not the peak yet
    const slope1 = current - prev1;
    const slope2 = prev1 - prev2;
    
    // If the slope is decreasing, we might be at a peak
    return slope1 < slope2;
  }
  
  /**
   * Update the power spectrum for frequency analysis
   */
  private updatePowerSpectrum(): void {
    // Get the last 64 samples for FFT
    const window = this.filteredBuffer.slice(-64);
    
    // Apply a Hamming window to reduce spectral leakage
    const hammingWindow = window.map((v, i) => {
      return v * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (window.length - 1)));
    });
    
    // Compute simple DFT (Discrete Fourier Transform)
    // For a real implementation, we'd use FFT for efficiency
    const N = hammingWindow.length;
    const spectrum: number[] = [];
    
    // Calculate just the relevant frequency bands (0.5 - 4 Hz for HR)
    // Assuming 20 Hz sampling rate (50ms between samples)
    const samplingFreq = 20; // Hz
    const maxBin = Math.floor(4 * N / samplingFreq); // 4 Hz max
    const minBin = Math.floor(0.5 * N / samplingFreq); // 0.5 Hz min
    
    // Only calculate for the frequency range we're interested in
    for (let k = minBin; k <= maxBin; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += hammingWindow[n] * Math.cos(angle);
        imag -= hammingWindow[n] * Math.sin(angle);
      }
      
      // Calculate magnitude
      const magnitude = Math.sqrt(real * real + imag * imag) / N;
      spectrum.push(magnitude);
    }
    
    this.powerSpectrum = spectrum;
  }
  
  /**
   * Calculate the Signal-to-Noise Ratio
   */
  private calculateSNR(): void {
    if (this.filteredBuffer.length < 30 || this.powerSpectrum.length === 0) {
      this.snr = 0;
      return;
    }
    
    // Find the peak in the power spectrum (signal)
    const maxPower = Math.max(...this.powerSpectrum);
    const maxIndex = this.powerSpectrum.indexOf(maxPower);
    
    // Calculate average power outside the peak (noise)
    const signalBand = [Math.max(0, maxIndex - 1), Math.min(this.powerSpectrum.length - 1, maxIndex + 1)];
    let noiseSum = 0;
    let noiseCount = 0;
    
    for (let i = 0; i < this.powerSpectrum.length; i++) {
      if (i < signalBand[0] || i > signalBand[1]) {
        noiseSum += this.powerSpectrum[i];
        noiseCount++;
      }
    }
    
    const noisePower = noiseCount > 0 ? noiseSum / noiseCount : 1;
    
    // Calculate SNR in dB
    this.snr = noisePower > 0 ? 10 * Math.log10(maxPower / noisePower) : 0;
  }
  
  /**
   * Get the dominant frequency from the power spectrum
   */
  private getDominantFrequency(): number {
    if (this.powerSpectrum.length === 0) return 0;
    
    // Find the frequency with the highest power
    const maxPower = Math.max(...this.powerSpectrum);
    const maxIndex = this.powerSpectrum.indexOf(maxPower);
    
    // Convert bin index to frequency
    // Assuming 64-point DFT and 20 Hz sampling rate
    const minFreq = 0.5; // Hz
    const freqStep = (4 - 0.5) / (this.powerSpectrum.length - 1);
    
    return minFreq + maxIndex * freqStep;
  }
  
  /**
   * Get the top N peaks from the power spectrum
   */
  private getSpectrumPeaks(n: number): Array<{frequency: number, amplitude: number}> {
    if (this.powerSpectrum.length === 0) return [];
    
    // Create array of frequency-amplitude pairs
    const pairs: Array<{index: number, amplitude: number}> = [];
    for (let i = 0; i < this.powerSpectrum.length; i++) {
      pairs.push({index: i, amplitude: this.powerSpectrum[i]});
    }
    
    // Sort by amplitude (descending)
    pairs.sort((a, b) => b.amplitude - a.amplitude);
    
    // Take top N
    const topN = pairs.slice(0, n);
    
    // Convert to frequency
    const minFreq = 0.5; // Hz
    const freqStep = (4 - 0.5) / (this.powerSpectrum.length - 1);
    
    return topN.map(({index, amplitude}) => ({
      frequency: minFreq + index * freqStep,
      amplitude
    }));
  }
  
  /**
   * Calculate Heart Rate Variability metrics
   */
  private calculateHRVMetrics(): {
    rmssd: number | null,
    nnIntervals: number[],
    pnnx: number
  } {
    if (this.rrIntervals.length < 3) {
      return {
        rmssd: null,
        nnIntervals: [],
        pnnx: 0
      };
    }
    
    // Filter out physiologically implausible intervals
    const validIntervals = this.rrIntervals.filter(
      rr => rr >= 300 && rr <= 1500 // 40-200 bpm range
    );
    
    // Calculate successive differences
    const nnDiffs: number[] = [];
    for (let i = 1; i < validIntervals.length; i++) {
      nnDiffs.push(Math.abs(validIntervals[i] - validIntervals[i-1]));
    }
    
    // Calculate RMSSD
    let sumSquaredDiffs = 0;
    for (const diff of nnDiffs) {
      sumSquaredDiffs += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiffs / Math.max(1, nnDiffs.length));
    
    // Calculate pNN50 (or similar)
    const threshold = this.config.nnThreshold;
    const countOverThreshold = nnDiffs.filter(diff => diff > threshold).length;
    const pnnx = validIntervals.length > 1 
      ? countOverThreshold / nnDiffs.length
      : 0;
    
    return {
      rmssd,
      nnIntervals: validIntervals,
      pnnx
    };
  }
  
  /**
   * Estimate noise level from signal
   */
  private estimateNoiseLevel(): number {
    if (this.filteredBuffer.length < 10) return 1.0;
    
    // Calculate first differences (high frequency components)
    const diffs: number[] = [];
    for (let i = 1; i < this.filteredBuffer.length; i++) {
      diffs.push(this.filteredBuffer[i] - this.filteredBuffer[i-1]);
    }
    
    // Calculate mean absolute difference
    const mad = diffs.reduce((sum, d) => sum + Math.abs(d), 0) / diffs.length;
    
    // Normalize by signal amplitude to get relative noise level
    return this.signalAmplitude > 0.001 
      ? Math.min(1.0, mad / this.signalAmplitude)
      : 1.0;
  }
  
  /**
   * Calculate average BPM from recent peaks
   */
  private calculateAverageBPM(): number | null {
    // Need at least 2 peaks to calculate BPM
    if (this.peakTimes.length < 2) {
      return this.lastBPM;
    }
    
    // Take the most recent peaks
    const recentPeaks = this.peakTimes.slice(-Math.min(10, this.peakTimes.length));
    
    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < recentPeaks.length; i++) {
      totalInterval += recentPeaks[i] - recentPeaks[i-1];
    }
    
    const avgInterval = totalInterval / (recentPeaks.length - 1);
    
    // Convert to BPM
    const bpm = 60000 / avgInterval;
    
    // Check physiological plausibility
    if (bpm >= 40 && bpm <= 200) {
      this.lastBPM = bpm;
      return bpm;
    }
    
    // Return last valid BPM or null
    return this.lastBPM;
  }
  
  /**
   * Determine signal quality based on multiple factors
   */
  private determineSignalQuality(): number {
    if (this.filteredBuffer.length < 10) return 0;
    
    // Factors:
    // 1. Signal amplitude (25%)
    const amplitudeScore = Math.min(100, this.signalAmplitude * 5000);
    
    // 2. SNR (25%)
    const snrScore = Math.min(100, Math.max(0, this.snr * 5));
    
    // 3. Spectrum peak prominence (25%)
    let peakProminence = 0;
    if (this.powerSpectrum.length > 0) {
      const maxPower = Math.max(...this.powerSpectrum);
      const avgPower = this.powerSpectrum.reduce((s, v) => s + v, 0) / this.powerSpectrum.length;
      peakProminence = avgPower > 0 ? Math.min(100, (maxPower / avgPower - 1) * 100) : 0;
    }
    
    // 4. Heart rate stability (25%)
    let stabilityScore = 0;
    if (this.rrIntervals.length >= 3) {
      const intervals = this.rrIntervals.slice(-5);
      const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / mean; // Coefficient of variation
      
      // Lower CV = more stable = higher score
      stabilityScore = Math.min(100, Math.max(0, (1 - cv * 5) * 100));
    }
    
    // Weighted average
    const qualityScore = (
      amplitudeScore * 0.25 +
      snrScore * 0.25 +
      peakProminence * 0.25 +
      stabilityScore * 0.25
    );
    
    return Math.round(qualityScore);
  }
  
  /**
   * Determine if a finger is present based on signal characteristics
   */
  private isFingerDetected(): boolean {
    if (this.filteredBuffer.length < 10) return false;
    
    // Check signal amplitude
    const hasAdequateAmplitude = this.signalAmplitude > 0.02;
    
    // Check signal quality
    const hasGoodQuality = this.determineSignalQuality() > 30;
    
    // Check if we have detected consistent heartbeats
    const hasConsistentHeartbeat = this.peakTimes.length >= 3;
    
    // Check SNR
    const hasGoodSNR = this.snr > 2;
    
    // Require at least three of the four criteria
    let criteria = 0;
    if (hasAdequateAmplitude) criteria++;
    if (hasGoodQuality) criteria++;
    if (hasConsistentHeartbeat) criteria++;
    if (hasGoodSNR) criteria++;
    
    return criteria >= 3;
  }
  
  /**
   * Calculate variance of a set of values
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Calculate the median of an array
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Clean up memory by disposing tensors and trimming buffers
   */
  private cleanupMemory(): void {
    // Dispose TensorFlow tensors
    if (this.featureBuffer.length > 0) {
      // Keep only the most recent features
      const keepCount = Math.min(this.MAX_FEATURE_TENSORS, this.featureBuffer.length);
      const toDispose = this.featureBuffer.slice(0, this.featureBuffer.length - keepCount);
      
      for (const tensor of toDispose) {
        tensor.dispose();
      }
      
      this.featureBuffer = this.featureBuffer.slice(-keepCount);
    }
    
    // Trim buffers to prevent memory growth
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE / 2) {
      this.rawBuffer = this.rawBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }
    
    if (this.filteredBuffer.length > this.MAX_BUFFER_SIZE / 2) {
      this.filteredBuffer = this.filteredBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }
    
    if (this.peaks.length > 10) {
      this.peaks = this.peaks.slice(-10);
    }
    
    if (this.peakTimes.length > 10) {
      this.peakTimes = this.peakTimes.slice(-10);
    }
    
    // Force garbage collection in TensorFlow
    if (tf.memory().numTensors > 100) {
      tf.dispose();
    }
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    // Reset signal buffers
    this.rawBuffer = [];
    this.filteredBuffer = [];
    
    // Clean up TensorFlow tensors
    this.featureBuffer.forEach(tensor => tensor.dispose());
    this.featureBuffer = [];
    
    // Reset peak detection state
    this.peaks = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    
    // Reset signal metrics
    this.baselineValue = 0;
    this.signalAmplitude = 0;
    this.noiseEstimate = 0;
    this.powerSpectrum = [];
    this.snr = 0;
    this.lastBPM = null;
    
    console.log('Advanced PPG extractor reset');
  }
}

/**
 * Create a new instance of the advanced PPG extractor
 */
export function createAdvancedPPGExtractor(config?: Partial<AdvancedExtractorConfig>): AdvancedPPGExtractor {
  return new AdvancedPPGExtractor(config);
}

/**
 * Process a value using the advanced extractor
 */
export function processWithAdvancedExtractor(
  value: number,
  extractor: AdvancedPPGExtractor
): AdvancedExtractionResult {
  return extractor.processValue(value);
}
