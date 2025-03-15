
import type { VitalSignsResult } from '../core/VitalSignsProcessor';
import type { RRData } from '../core/ArrhythmiaProcessor';
import { WaveletDenoiser } from './signal/WaveletDenoiser';
import { HilbertHuangTransform } from './signal/HilbertHuangTransform';
import { PeakDetector } from './signal/PeakDetector';
import { SpectralAnalyzer } from './signal/SpectralAnalyzer';
import { SignalQualityAnalyzer } from './analysis/SignalQualityAnalyzer';
import { SignalBuffer } from './signal/SignalBuffer';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from './config/ProcessorConfig';
import { applyPressureCompensation } from './utils/SignalProcessingUtils';

/**
 * Manages the coordination between different signal processing components
 */
export class ProcessorManager {
  // Signal processing components
  private waveletDenoiser: WaveletDenoiser;
  private hilbertTransform: HilbertHuangTransform;
  private peakDetector: PeakDetector;
  private spectralAnalyzer: SpectralAnalyzer;
  private qualityAnalyzer: SignalQualityAnalyzer;
  private signalBuffer: SignalBuffer;
  
  // Configuration
  private config: ProcessorConfig;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    // Initialize with default config and override with provided values
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    
    // Initialize components
    this.waveletDenoiser = new WaveletDenoiser();
    this.hilbertTransform = new HilbertHuangTransform();
    this.peakDetector = new PeakDetector();
    this.spectralAnalyzer = new SpectralAnalyzer();
    this.qualityAnalyzer = new SignalQualityAnalyzer();
    this.signalBuffer = new SignalBuffer(this.config.bufferSize);
    
    // Configure components based on power mode
    this.setLowPowerMode(this.config.lowPowerMode);
  }
  
  /**
   * Processes a new PPG signal value
   */
  public processValue(ppgValue: number): { 
    denoisedValue: number, 
    hasEnoughData: boolean,
    signalQuality: number,
    pressureArtifactLevel: number 
  } {
    // Apply advanced wavelet denoising
    const denoisedValue = this.waveletDenoiser.denoise(ppgValue);
    
    // Add to signal buffer
    this.signalBuffer.addValue(denoisedValue);
    
    // Analyze signal quality
    const signalQuality = this.qualityAnalyzer.analyzeSignalQuality(this.signalBuffer.getValues());
    
    // Detect pressure artifacts
    const pressureArtifactLevel = this.qualityAnalyzer.detectPressureArtifacts(this.signalBuffer.getValues());
    
    // Check if we have enough data for full analysis
    const hasEnoughData = this.signalBuffer.hasEnoughData();
    
    return {
      denoisedValue,
      hasEnoughData,
      signalQuality,
      pressureArtifactLevel
    };
  }
  
  /**
   * Performs peak detection and analysis on the current signal buffer
   */
  public analyzeSignal(): {
    peakInfo: { peakIndices: number[], intervals: number[] },
    compensatedValues: number[],
    hhResults: any | null
  } {
    // Get current values
    const values = this.signalBuffer.getValues();
    const pressureArtifactLevel = this.qualityAnalyzer.getPressureArtifactLevel();
    
    // Apply pressure compensation if needed
    const compensatedValues = pressureArtifactLevel > 0.3 
      ? applyPressureCompensation(values, pressureArtifactLevel)
      : values;
    
    // Detect peaks using advanced algorithm
    const peakInfo = this.peakDetector.detectPeaks(compensatedValues);
    
    // Perform Hilbert-Huang transform analysis if not in low power mode
    const hhResults = !this.config.lowPowerMode 
      ? this.hilbertTransform.analyze(compensatedValues) 
      : null;
    
    return {
      peakInfo,
      compensatedValues,
      hhResults
    };
  }
  
  /**
   * Configure low power mode for all components
   */
  public setLowPowerMode(enabled: boolean): void {
    this.config.lowPowerMode = enabled;
    
    // Configure components accordingly
    this.waveletDenoiser.setLowComplexity(enabled);
    this.hilbertTransform.setEnabled(!enabled);
    this.spectralAnalyzer.setLowResolution(enabled);
  }
  
  /**
   * Get the current signal quality metrics
   */
  public getQualityMetrics(): {
    signalQuality: number,
    perfusionIndex: number,
    pressureArtifactLevel: number
  } {
    return {
      signalQuality: this.qualityAnalyzer.getSignalQuality(),
      perfusionIndex: this.qualityAnalyzer.getPerfusionIndex(),
      pressureArtifactLevel: this.qualityAnalyzer.getPressureArtifactLevel()
    };
  }
  
  /**
   * Update signal quality based on morphology analysis
   */
  public updateQualityFromMorphology(morphologyFeatures: { perfusion: number }): void {
    this.qualityAnalyzer.updatePerfusionIndex(morphologyFeatures.perfusion);
  }
  
  /**
   * Reset all processors
   */
  public reset(fullReset: boolean = false): void {
    this.signalBuffer.clear();
    this.qualityAnalyzer.reset();
    this.peakDetector.reset();
    
    if (fullReset) {
      this.waveletDenoiser.resetToDefaults();
      this.hilbertTransform.reset();
      this.spectralAnalyzer.reset();
    }
  }
  
  /**
   * Update denoiser parameters based on signal quality
   */
  public updateDenoiserParameters(signalQuality: number): void {
    this.waveletDenoiser.updateParameters(signalQuality);
  }
}
