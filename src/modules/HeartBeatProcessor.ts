
import { HeartBeatConfig } from './heart-beat/config';
import { applyFilterPipeline } from './heart-beat/signal-filters';
import { detectPeak, confirmPeak } from './heart-beat/peak-detector';
import { updateBPMHistory, calculateCurrentBPM, smoothBPM, calculateFinalBPM } from './heart-beat/bpm-calculator';
import { HeartbeatAudioManager } from './heart-beat/audio-manager';
import { checkSignalQuality, resetDetectionStates } from './heart-beat/signal-quality';

export class HeartBeatProcessor {
  private readonly HEART_BPM_BUFFER_SIZE = 10;
  private readonly HEART_PEAK_BUFFER_SIZE = 20;
  private readonly MIN_PEAK_INTERVAL_MS = 400; // Aumentado para prevenir detecciones falsas
  private readonly MAX_PEAK_INTERVAL_MS = 1500;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.25; // Aumentado para exigir mayor confianza

  private heartBPMBuffer: number[] = [];
  private peakTimestamps: number[] = [];
  private lastPeakTime: number | null = null;
  private lastProcessedTime: number = 0;
  private rrAnalyzer: RRDataAnalyzer;
  private audioContext: AudioContext | null = null;
  private beepGain: GainNode | null = null;
  private beepOscillator: OscillatorNode | null = null;
  private beepStarted = false;
  private arrhythmiaCounter = 0;
  private arrhythmiaWindows: Array<{start: number, end: number}> = [];
  private heartRateHistory: number[] = [];
  private confidenceHistory: number[] = [];
  private isMonitoring = false; // Estado de monitorización
  private consecutiveLowQualityCount = 0;

  constructor() {
    this.rrAnalyzer = new RRDataAnalyzer();
    this.initAudio();
  }

  public initAudio(): void {
    try {
      // Close previous audio context if it exists
      if (this.audioContext) {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close().catch(err => console.error('Error closing audio context:', err));
        }
        this.audioContext = null;
        this.beepGain = null;
        this.beepOscillator = null;
        this.beepStarted = false;
      }

      // Create new audio context
      if (typeof window !== 'undefined' && window.AudioContext) {
        this.audioContext = new window.AudioContext({ latencyHint: 'interactive' });
        console.log('HeartBeatProcessor: New audio context initialized, state:', this.audioContext.state);
        
        // Create gain node
        this.beepGain = this.audioContext.createGain();
        this.beepGain.gain.value = 0;
        this.beepGain.connect(this.audioContext.destination);
        
        // Resume audio context if it's suspended
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(err => {
            console.error('Error resuming audio context:', err);
          });
        }
      } else {
        console.warn('HeartBeatProcessor: AudioContext not supported in this environment');
      }
    } catch (err) {
      console.error('HeartBeatProcessor: Error initializing audio system:', err);
    }
  }

  // Add method to set monitoring state
  public setMonitoring(isActive: boolean): void {
    this.isMonitoring = isActive;
    console.log(`HeartBeatProcessor: Monitoring state set to ${isActive}`);
    
    // If monitoring is disabled, ensure no sound can be played
    if (!isActive) {
      this.disableAudio();
    }
  }

  // Method to disable audio completely
  private disableAudio(): void {
    try {
      if (this.audioContext && this.audioContext.state !== 'closed') {
        // Disconnect all nodes
        if (this.beepGain) {
          this.beepGain.disconnect();
        }
        if (this.beepOscillator) {
          this.beepOscillator.disconnect();
        }
        // Set gain to 0
        if (this.beepGain) {
          this.beepGain.gain.value = 0;
        }
      }
    } catch (err) {
      console.error('HeartBeatProcessor: Error disabling audio:', err);
    }
  }

  public playBeep(volume: number = 0.7): boolean {
    // Check if we're in monitoring mode
    if (!this.isMonitoring) {
      console.warn('HeartBeatProcessor: Attempted to play beep while not monitoring');
      return false;
    }

    if (!this.audioContext || !this.beepGain) {
      console.warn('HeartBeatProcessor: Audio context not available for beep');
      this.initAudio(); // Try to reinitialize
      return false;
    }

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(err => {
          console.error('Error resuming audio context:', err);
          return false;
        });
      }

      // Create a new oscillator for each beep
      const beepOscillator = this.audioContext.createOscillator();
      beepOscillator.type = 'sine';
      beepOscillator.frequency.value = 800;
      
      // Create a new gain node for this beep
      const beepGain = this.audioContext.createGain();
      beepGain.gain.value = 0;
      
      // Connect oscillator to gain node and gain node to destination
      beepOscillator.connect(beepGain);
      beepGain.connect(this.audioContext.destination);
      
      // Start oscillator
      beepOscillator.start();
      
      // Set attack, decay, sustain, release envelope
      const now = this.audioContext.currentTime;
      beepGain.gain.setValueAtTime(0, now);
      beepGain.gain.linearRampToValueAtTime(volume, now + 0.02);
      beepGain.gain.linearRampToValueAtTime(0, now + 0.1);
      
      // Stop and disconnect after beep is done
      setTimeout(() => {
        beepOscillator.stop();
        beepOscillator.disconnect();
        beepGain.disconnect();
      }, 150);
      
      return true;
    } catch (err) {
      console.error('HeartBeatProcessor: Error playing beep:', err);
      return false;
    }
  }

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue?: number;
    arrhythmiaCount: number;
  } {
    // Only process if we're in monitoring mode
    if (!this.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0
      };
    }

    // Implementar detección de señal baja o ausente
    if (Math.abs(value) < 0.05) {
      this.consecutiveLowQualityCount++;
      if (this.consecutiveLowQualityCount > 30) {
        // Si hay muchas muestras de baja calidad consecutivas, devuelve confianza cero
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          arrhythmiaCount: 0
        };
      }
    } else {
      this.consecutiveLowQualityCount = 0;
    }

    const now = Date.now();
    const timeDelta = now - this.lastProcessedTime;
    this.lastProcessedTime = now;

    // Check if this is a peak with umbral más estricto
    const isPeak = this.isPeak(value, now);
    
    // Update RR intervals if this is a peak
    if (isPeak) {
      this.rrAnalyzer.addPeak(now);
      
      // Check for arrhythmia
      if (this.rrAnalyzer.isArrhythmia()) {
        this.arrhythmiaCounter++;
        this.arrhythmiaWindows.push({
          start: now - 300,
          end: now + 300
        });
        
        // Keep only the last 5 arrhythmia windows
        if (this.arrhythmiaWindows.length > 5) {
          this.arrhythmiaWindows.shift();
        }
      }
    }

    // Calculate current BPM
    const bpm = this.calculateCurrentBPM();
    
    // Calcular confianza con criterios más estrictos
    let confidence = 0;
    
    if (this.peakTimestamps.length >= 3) {
      // Calculate average interval
      let sumIntervals = 0;
      for (let i = 1; i < this.peakTimestamps.length; i++) {
        sumIntervals += this.peakTimestamps[i] - this.peakTimestamps[i-1];
      }
      const avgInterval = sumIntervals / (this.peakTimestamps.length - 1);
      
      // Calculate standard deviation
      let sumSquaredDiff = 0;
      for (let i = 1; i < this.peakTimestamps.length; i++) {
        const interval = this.peakTimestamps[i] - this.peakTimestamps[i-1];
        sumSquaredDiff += Math.pow(interval - avgInterval, 2);
      }
      const stdDev = Math.sqrt(sumSquaredDiff / (this.peakTimestamps.length - 1));
      
      // Calculate coefficient of variation (CV)
      const cv = stdDev / avgInterval;
      
      // Convert CV to confidence (lower CV = higher confidence)
      confidence = Math.max(0, Math.min(1, 1 - cv));
      
      // Adjust confidence based on physiological plausibility
      if (bpm < 40 || bpm > 200) {
        confidence *= 0.3; // Reduce confidence for implausible values
      }
      
      // Store confidence history
      this.confidenceHistory.push(confidence);
      if (this.confidenceHistory.length > 10) {
        this.confidenceHistory.shift();
      }
      
      // Smooth confidence
      const avgConfidence = this.confidenceHistory.reduce((sum, val) => sum + val, 0) / 
                           this.confidenceHistory.length;
      confidence = avgConfidence;
    }

    // Store heart rate history only if confidence is good
    if (bpm > 0 && confidence > 0.3) {
      this.heartRateHistory.push(bpm);
      if (this.heartRateHistory.length > 10) {
        this.heartRateHistory.shift();
      }
    }

    return {
      bpm,
      confidence,
      isPeak,
      filteredValue: value,
      arrhythmiaCount: this.arrhythmiaCounter
    };
  }

  public calculateCurrentBPM(): number {
    if (this.peakTimestamps.length < 4) { // Exigir más picos para calcular BPM
      return 0;
    }

    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimestamps.length; i++) {
      const interval = this.peakTimestamps[i] - this.peakTimestamps[i - 1];
      if (interval >= this.MIN_PEAK_INTERVAL_MS && interval <= this.MAX_PEAK_INTERVAL_MS) {
        intervals.push(interval);
      }
    }

    if (intervals.length < 3) { // Exigir más intervalos válidos
      return 0;
    }

    // Eliminar outliers usando IQR (rango intercuartil)
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const filteredIntervals = intervals.filter(
      interval => interval >= lowerBound && interval <= upperBound
    );
    
    if (filteredIntervals.length === 0) {
      return 0;
    }
    
    // Calculate average interval from filtered intervals
    const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
    
    // Convert to BPM
    const bpm = Math.round(60000 / avgInterval);
    
    // Validate physiological range
    if (bpm < 40 || bpm > 200) {
      return 0;
    }
    
    return bpm;
  }

  private isPeak(value: number, timestamp: number): boolean {
    if (this.lastPeakTime !== null) {
      const timeSinceLastPeak = timestamp - this.lastPeakTime;
      
      // Enforce minimum time between peaks (strict)
      if (timeSinceLastPeak < this.MIN_PEAK_INTERVAL_MS) {
        return false;
      }
    }
    
    // Peak detection with higher threshold
    if (value > this.MIN_CONFIDENCE_THRESHOLD) {
      this.lastPeakTime = timestamp;
      
      // Add to peak timestamps
      this.peakTimestamps.push(timestamp);
      if (this.peakTimestamps.length > this.HEART_PEAK_BUFFER_SIZE) {
        this.peakTimestamps.shift();
      }
      
      return true;
    }
    
    return false;
  }

  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: this.rrAnalyzer.getRRIntervals(),
      lastPeakTime: this.lastPeakTime
    };
  }

  public getArrhythmiaWindows(): Array<{start: number, end: number}> {
    return this.arrhythmiaWindows;
  }

  public isArrhythmia(): boolean {
    return this.rrAnalyzer.isArrhythmia();
  }

  public reset(): void {
    this.heartBPMBuffer = [];
    this.peakTimestamps = [];
    this.lastPeakTime = null;
    this.lastProcessedTime = 0;
    this.rrAnalyzer.reset();
    this.arrhythmiaCounter = 0;
    this.arrhythmiaWindows = [];
    this.heartRateHistory = [];
    this.confidenceHistory = [];
    this.consecutiveLowQualityCount = 0;
    
    // Mantener el estado de monitoreo actual
    const wasMonitoring = this.isMonitoring;
    
    // Reinitialize audio on reset
    this.initAudio();
    
    // Restore monitoring state
    this.setMonitoring(wasMonitoring);
  }

  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}

// Create helper class for RR interval analysis to replace the missing RRIntervalAnalyzer
class RRDataAnalyzer {
  private readonly MAX_RR_INTERVALS = 20;
  private readonly MIN_INTERVALS_FOR_ANALYSIS = 5;
  private readonly ARRHYTHMIA_THRESHOLD = 0.2;
  
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private isArrhythmiaDetected = false;
  
  public addPeak(timestamp: number): void {
    if (this.lastPeakTime !== null) {
      const interval = timestamp - this.lastPeakTime;
      
      // Only add physiologically plausible intervals (400ms to 1500ms)
      if (interval >= 400 && interval <= 1500) {
        this.rrIntervals.push(interval);
        
        // Keep buffer size limited
        if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
          this.rrIntervals.shift();
        }
        
        // Check for arrhythmia
        this.detectArrhythmia();
      }
    }
    
    this.lastPeakTime = timestamp;
  }
  
  public getRRIntervals(): number[] {
    return [...this.rrIntervals];
  }
  
  public isArrhythmia(): boolean {
    return this.isArrhythmiaDetected;
  }
  
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.MIN_INTERVALS_FOR_ANALYSIS) {
      this.isArrhythmiaDetected = false;
      return;
    }
    
    // Get the last few intervals
    const recentIntervals = this.rrIntervals.slice(-this.MIN_INTERVALS_FOR_ANALYSIS);
    
    // Calculate mean
    const mean = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    
    // Check if the most recent interval deviates significantly from the mean
    const lastInterval = recentIntervals[recentIntervals.length - 1];
    const deviation = Math.abs(lastInterval - mean) / mean;
    
    // Utilizar umbral más exigente para arritmias
    this.isArrhythmiaDetected = deviation > this.ARRHYTHMIA_THRESHOLD && mean > 0;
  }
  
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isArrhythmiaDetected = false;
  }
}
