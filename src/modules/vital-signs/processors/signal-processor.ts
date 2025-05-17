
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';
import { SignalFilter } from './signal-filter';
import { SignalQuality } from './signal-quality';
import { HeartRateDetector } from './heart-rate-detector';
import { SignalValidator } from '../validators/signal-validator';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  private readonly MIN_QUALITY_FOR_FINGER = 45; 
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.02; 

  private dcBaseline: number = 0;
  private rawSignalBuffer: number[] = []; 
  private readonly RAW_BUFFER_SIZE = 50;

  private readonly DC_BASELINE_ALPHA_SLOW = 0.005;
  private readonly DC_BASELINE_ALPHA_FAST = 0.1;  

  private acSignalRawBuffer: number[] = [];
  private medianFilteredAcSignalBuffer: number[] = [];
  private emaFilteredAcSignalBuffer: number[] = []; 

  private readonly FILTER_BUFFER_SIZE = 15; 
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); 
    this.dcBaseline = 0; 
    this.rawSignalBuffer = [];
  }
  
  private updateDcBaseline(rawValue: number): void {
    this.rawSignalBuffer.push(rawValue);
    if (this.rawSignalBuffer.length > this.RAW_BUFFER_SIZE) {
      this.rawSignalBuffer.shift();
    }

    if (this.dcBaseline === 0) { 
      this.dcBaseline = rawValue;
    } else {
      const diff = Math.abs(rawValue - this.dcBaseline);
      const adaptFastThreshold = Math.max(10, this.dcBaseline * 0.15);
      if (diff > adaptFastThreshold && this.dcBaseline > 0) { 
           this.dcBaseline = this.dcBaseline * (1 - this.DC_BASELINE_ALPHA_FAST) + rawValue * this.DC_BASELINE_ALPHA_FAST;
      } else {
           this.dcBaseline = this.dcBaseline * (1 - this.DC_BASELINE_ALPHA_SLOW) + rawValue * this.DC_BASELINE_ALPHA_SLOW;
      }
    }
  }

  private addToBuffer(buffer: number[], value: number, maxSize: number): void {
    buffer.push(value);
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }

  public applyFilters(value: number): { 
    filteredValue: number, 
    quality: number, 
    fingerDetected: boolean, 
    acSignalValue: number, 
    dcBaseline: number 
  } {
    this.signalValidator.trackSignalForPatternDetection(value); 
    
    this.updateDcBaseline(value);    
    const acSignal = value - this.dcBaseline;
    this.addToBuffer(this.acSignalRawBuffer, acSignal, this.FILTER_BUFFER_SIZE);

    const medianFiltered = this.filter.applyMedianFilter(acSignal, this.acSignalRawBuffer);
    this.addToBuffer(this.medianFilteredAcSignalBuffer, medianFiltered, this.FILTER_BUFFER_SIZE);
    
    const emaFiltered = this.filter.applyEMAFilter(medianFiltered, this.medianFilteredAcSignalBuffer); 
    this.addToBuffer(this.emaFilteredAcSignalBuffer, emaFiltered, this.FILTER_BUFFER_SIZE);
        
    const smaFiltered = this.filter.applySMAFilter(emaFiltered, this.emaFilteredAcSignalBuffer);
    
    this.ppgValues.push(smaFiltered); 
    if (this.ppgValues.length > 100) {
      this.ppgValues.shift();
    }

    this.quality.updateNoiseLevel(acSignal, smaFiltered);
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
        
    const patternFingerDetected = this.signalValidator.isFingerDetected(); 
    const fingerDetectedByQuality = qualityValue >= this.MIN_QUALITY_FOR_FINGER;

    let amplitudeAC = 0;
    if (this.ppgValues.length > 10) { 
      const recentAcValues = this.ppgValues.slice(-10);
      amplitudeAC = Math.max(...recentAcValues) - Math.min(...recentAcValues);
    }
    const hasValidAmplitude = amplitudeAC >= this.MIN_SIGNAL_AMPLITUDE;

    const finalFingerDetected = (patternFingerDetected && hasValidAmplitude && fingerDetectedByQuality) || this.fingerDetectionConfirmed;

    if (finalFingerDetected && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
      }
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true; 
      }
    } else if (!finalFingerDetected && this.fingerDetectionConfirmed) {
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }

    return { 
      filteredValue: smaFiltered, 
      quality: qualityValue,
      fingerDetected: finalFingerDetected,
      acSignalValue: acSignal, 
      dcBaseline: this.dcBaseline
    };
  }
  
  public calculateHeartRate(sampleRate: number = 30): number {
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate); 
  }
  
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    const peakTimes = this.heartRateDetector.getPeakTimes(); 
    if (peakTimes.length < 2) {
      return { intervals: [], lastPeakTime: peakTimes.length > 0 ? peakTimes[peakTimes.length - 1] : null };
    }
    const intervals: number[] = [];
    for (let i = 1; i < peakTimes.length; i++) {
      const interval = peakTimes[i] - peakTimes[i-1];
      if (interval >= 250 && interval <= 2000) { 
        intervals.push(interval);
      }
    }
    return {
      intervals,
      lastPeakTime: peakTimes.length > 0 ? peakTimes[peakTimes.length - 1] : null
    };
  }

  public hasValidAmplitude(values: number[]): boolean { 
    if (values.length < 10) return false;
    const amplitude = Math.max(...values) - Math.min(...values);
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE; 
  }

  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalProcessor logValidationResults (called externally):", { isValid, amplitude, valueCount: values.length });
  }

  public getRawSignalBuffer(): number[] {
    return [...this.rawSignalBuffer];
  }

  public reset(): void {
    super.reset(); 
    this.quality.reset();
    this.heartRateDetector.reset(); 
    this.signalValidator.resetFingerDetection(); 
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    this.dcBaseline = 0; 
    this.rawSignalBuffer = []; 
    this.acSignalRawBuffer = [];
    this.medianFilteredAcSignalBuffer = [];
    this.emaFilteredAcSignalBuffer = [];
    console.log("SignalProcessor: Reset complete");
  }
} 
