
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

  constructor() {
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(300, 10, 0.4);
    this.peakDetector = new PeakDetector(4, 0.15, 0.4, 0.8, 250, 500);
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
      }
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
    }
  }

  public processSignal(value: number, quality: number = 0): HeartBeatResult {
    const now = Date.now();
    this.lastSignalQuality = quality;
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Update the adaptive threshold periodically
    this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG);

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Only try to detect beats if we have enough samples
    if (this.signalProcessor.bufferLength > 8) {
      // First, try normal beat detection
      isBeat = this.peakDetector.detectBeat(
        now, 
        value, 
        quality, 
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // If beat detected, calculate new BPM
      if (isBeat) {
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
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
        
        // Update last beat time
        this.lastBeatTime = now;
        this.lastMajorBeatTime = now;
        
        // Play beep with volume based on confidence and signal quality
        this.audioHandler.playBeep(this.peakDetector.confidence, quality);
        
        if (this.DEBUG) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${quality}`);
        }
      }
    }

    // Calculate final confidence, including adjustment for forced mode
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(quality);
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
