import { AudioHandler } from './audio-handler';
import { SignalProcessor } from './signal-processor';
import { PeakDetector } from './peak-detector';
import { BPMAnalyzer } from './bpm-analyzer';
import { HeartBeatResult, RRIntervalData } from './types';
import HumSoundFile from '../../assets/sounds/heartbeat-low.mp3';

export class HeartBeatProcessor {
  // Debug mode
  private DEBUG = true;

  // Component modules
  private audioHandler: AudioHandler;
  private signalProcessor: SignalProcessor;
  private peakDetector: PeakDetector;
  private bpmAnalyzer: BPMAnalyzer;
  
  // State
  private lastBeatTime = 0;
  private lastMajorBeatTime = 0;
  private rrIntervals: { timestamp: number; interval: number }[] = [];
  private isInitialized = false;
  private lastSignalQuality = 0;
  private consecutiveMissedBeats = 0;
  private forcedDetectionMode = false;
  private readonly MAX_RR_DATA_POINTS = 20;
  private signalBuffer: number[] = [];
  private beatsCounter = 0;

  constructor() {
    // Initialize with more sensitive parameters
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(300, 10, 0.35); // Reduced EMA alpha for smoother signal
    
    // More sensitive peak detector settings
    this.peakDetector = new PeakDetector(
      3,       // Smaller peak window for faster detection
      0.12,    // Lower threshold for better sensitivity
      0.3,     // Reduced strong peak threshold
      0.8,     // Keep dynamic threshold
      220,     // Lower minimum time between beats
      1200     // Reduced max time for better responsiveness
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 180, 5);
    
    this.initialize();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const audioInit = await this.audioHandler.initialize();
      this.isInitialized = audioInit;
      
      if (this.isInitialized) {
        console.log("HeartBeatProcessor: Initialized");
      } else {
        console.warn("HeartBeatProcessor: Audio initialization failed, falling back to visual feedback only");
      }
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
    }
  }

  public processSignal(value: number, quality: number = 0): HeartBeatResult {
    const now = Date.now();
    this.lastSignalQuality = quality;
    
    // Keep a short buffer of raw values for anomaly detection
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Update the adaptive threshold periodically
    this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG && this.beatsCounter % 20 === 0);

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Only try to detect beats if we have enough samples
    if (this.signalProcessor.bufferLength > 8) {
      // Enhanced beat detection with signal quality consideration
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        quality, 
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // If beat detected, calculate new BPM
      if (isBeat) {
        this.beatsCounter++;
        
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // Validate interval before using (avoid extreme outliers)
          if (interval > 200 && interval < 2000) {
            // Store RR interval data
            this.rrIntervals.push({ timestamp: now, interval });
            if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
              this.rrIntervals.shift();
            }
            
            // Calculate BPM and update analyzer
            const newBpm = this.bpmAnalyzer.addBeatInterval(interval);
            if (newBpm !== null) {
              currentBpm = newBpm;
              
              // Update peak detector timing parameters
              this.peakDetector.setTimingParameters(interval);
            }
          }
        }
        
        // Update last beat time
        this.lastBeatTime = now;
        this.lastMajorBeatTime = now;
        
        // Play beep with volume based on confidence and signal quality
        // Adjust beep parameters based on beat strength
        const beatStrength = this.peakDetector.confidence;
        if (beatStrength > 0.3 || this.beatsCounter % 3 === 0) {
          this.audioHandler.playBeep(
            Math.min(0.9, beatStrength * 1.2), 
            Math.min(100, quality * 1.2)
          );
        }
        
        if (this.DEBUG && this.beatsCounter % 5 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${quality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // Missed beats handling - detect when we should have seen a beat
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.5 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After several missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 5 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
        }
      }
    }

    // Calculate final confidence, including adjustment for forced mode
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(quality);
    
    // Adjust confidence based on peak detector's stability
    finalConfidence *= (0.7 + (0.3 * this.peakDetector.stability));
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.7;
    }
    
    // Cap confidence at 100%
    finalConfidence = Math.min(1.0, finalConfidence);

    return {
      bpm: currentBpm,
      confidence: finalConfidence,
      isBeat,
      lastBeatTime: this.lastBeatTime,
      rrData: [...this.rrIntervals]
    };
  }

  public reset(): void {
    this.signalProcessor.reset();
    this.peakDetector.reset();
    this.bpmAnalyzer.reset();
    
    this.lastBeatTime = 0;
    this.lastMajorBeatTime = 0;
    this.rrIntervals = [];
    this.consecutiveMissedBeats = 0;
    this.forcedDetectionMode = false;
    this.signalBuffer = [];
    this.beatsCounter = 0;
  }

  public getRRIntervals(): RRIntervalData {
    // Convert RR interval data to a simple array of intervals
    const intervals = this.rrIntervals.map(rr => rr.interval);
    
    return {
      intervals,
      lastPeakTime: this.lastBeatTime > 0 ? this.lastBeatTime : null
    };
  }
}
