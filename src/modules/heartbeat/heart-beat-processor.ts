
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
  private lastFiveBeatsQuality: number[] = [0, 0, 0, 0, 0];
  private falsePositiveProtection = 0;
  private initTime = Date.now();
  private forcePlayBeep = false;
  private beatsSinceLastBeep = 0;

  constructor() {
    // Initialize with optimized parameters
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(300, 10, 0.4); // Slightly higher EMA alpha for less smoothing
    
    // Peak detector settings optimized for better detection
    this.peakDetector = new PeakDetector(
      4,       // Peak window
      0.15,    // Lower threshold to detect more peaks
      0.3,     // Lower strong peak threshold
      0.85,    // Dynamic threshold adjustment
      250,     // Minimum time between beats
      1500     // Maximum time between beats
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 180, 5);
    
    this.initialize();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("HeartBeatProcessor: Initializing audio");
      const audioInit = await this.audioHandler.initialize();
      this.isInitialized = audioInit;
      
      if (this.isInitialized) {
        console.log("HeartBeatProcessor: Successfully initialized with audio");
        
        // Schedule a test beep after 1 second to verify audio works
        setTimeout(() => {
          if (this.isInitialized) {
            console.log("HeartBeatProcessor: Playing test beep");
            this.audioHandler.playBeep(0.9, 80);
            this.forcePlayBeep = true;
          }
        }, 1000);
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
    if (this.signalProcessor.bufferLength > 10) {
      // Enhanced beat detection with easier detection in early phase
      const detectionQualityThreshold = (now - this.initTime < 5000) ? 25 : 30; // Lower threshold at start
      
      if (quality >= detectionQualityThreshold) {
        isBeat = this.peakDetector.detectBeat(
          now, 
          smoothedValue, 
          quality, 
          signalBuffer, 
          derivative, 
          this.lastBeatTime
        );
        
        // Enhanced false positive protection
        if (isBeat) {
          const timeSinceLastBeat = now - this.lastBeatTime;
          
          if (timeSinceLastBeat < 300 && this.falsePositiveProtection < 3) {
            this.falsePositiveProtection++;
            isBeat = false;
            if (this.DEBUG) {
              console.log(`False positive rejected: too soon after last beat (${timeSinceLastBeat}ms)`);
            }
          } else {
            this.falsePositiveProtection = Math.max(0, this.falsePositiveProtection - 1);
          }
        }
        
        // If beat detected and passes false positive check
        if (isBeat) {
          this.beatsCounter++;
          this.beatsSinceLastBeep++;
          
          // Reset counter for forced mode
          this.consecutiveMissedBeats = 0;
          this.forcedDetectionMode = false;
          
          if (this.lastBeatTime > 0) {
            const interval = now - this.lastBeatTime;
            
            // More permissive interval validation
            if (interval > 250 && interval < 1800) {
              // Store RR interval data
              this.rrIntervals.push({ timestamp: now, interval });
              if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
                this.rrIntervals.shift();
              }
              
              // Track quality of last 5 beats for confidence calculation
              this.lastFiveBeatsQuality.push(quality);
              if (this.lastFiveBeatsQuality.length > 5) {
                this.lastFiveBeatsQuality.shift();
              }
              
              // Calculate BPM and update analyzer
              const newBpm = this.bpmAnalyzer.addBeatInterval(interval);
              if (newBpm !== null) {
                currentBpm = newBpm;
                
                // Update peak detector timing parameters
                this.peakDetector.setTimingParameters(interval);
              }
            } else if (this.DEBUG) {
              console.log(`Beat interval outside valid range: ${interval}ms`);
            }
          }
          
          // Update last beat time
          this.lastBeatTime = now;
          this.lastMajorBeatTime = now;
          
          // Play beep with enhanced logic to ensure it works
          const beatStrength = this.peakDetector.confidence;
          const shouldPlayBeep = this.forcePlayBeep || 
                                (beatStrength > 0.5 && quality > 50) || 
                                this.beatsCounter % 3 === 0 || 
                                this.beatsSinceLastBeep >= 5;
                                
          if (shouldPlayBeep) {
            this.audioHandler.playBeep(
              Math.min(0.9, beatStrength + 0.3), // Boost volume a bit
              Math.min(95, quality * 1.2) // Boost quality scaling
            );
            this.beatsSinceLastBeep = 0;
            this.forcePlayBeep = false;
          }
          
          if (this.DEBUG && this.beatsCounter % 3 === 0) {
            console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${quality}`);
          }
        }
      }
      
      // Missed beats handling - detect when we should have seen a beat
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.7 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After several missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 5 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          this.forcePlayBeep = true; // Force a beep on next detection
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
        }
      }
    }

    // Calculate final confidence
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                      (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality);
    
    // Adjust confidence based on peak detector's stability
    finalConfidence *= (0.7 + (0.3 * this.peakDetector.stability));
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.7;
    }
    
    // Cap confidence
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
    this.lastFiveBeatsQuality = [0, 0, 0, 0, 0];
    this.falsePositiveProtection = 0;
    this.initTime = Date.now();
    this.forcePlayBeep = true;
    this.beatsSinceLastBeep = 0;
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
