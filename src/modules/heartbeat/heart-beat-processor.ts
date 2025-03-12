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
  private lastProcessedTimestamp = 0;
  private initializationAttempts = 0;

  constructor() {
    // Initialize with more sensitive parameters
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(300, 8, 0.5); // Higher EMA alpha for less smoothing
    
    // Much more sensitive peak detector settings
    this.peakDetector = new PeakDetector(
      3,       // Smaller peak window for better sensitivity
      0.12,    // Lower threshold to detect more peaks
      0.25,    // Much lower strong peak threshold for better detection
      0.7,     // Lower dynamic threshold
      200,     // Much shorter minimum time between beats
      1500     // Keep same max time
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 180, 5);
    
    this.initialize();
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.initializationAttempts > 0) return true;
    
    this.initializationAttempts++;
    console.log(`HeartBeatProcessor initialization attempt #${this.initializationAttempts}`);

    try {
      // Initialize audio handler first (with additional attempts if needed)
      let audioInit = await this.audioHandler.initialize();
      
      // Retry audio initialization if it fails
      if (!audioInit) {
        console.log("Retrying audio initialization after short delay...");
        await new Promise(resolve => setTimeout(resolve, 500));
        audioInit = await this.audioHandler.initialize();
        
        // Try one more time with a different approach if still failing
        if (!audioInit) {
          console.log("Second retry for audio initialization...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          audioInit = await this.audioHandler.initialize();
        }
      }
      
      this.isInitialized = true;
      
      console.log("HeartBeatProcessor: Initialized with audio status:", audioInit);
      return true;
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
      // Still mark as initialized to allow processing without audio
      this.isInitialized = true;
      
      // Try to reinitialize after a delay
      setTimeout(() => {
        console.log("Attempting to reinitialize audio after error");
        this.audioHandler.initialize().catch(err => 
          console.error("Audio re-initialization failed:", err)
        );
      }, 2000);
      
      return true;
    }
  }

  public processSignal(value: number, quality: number = 0): HeartBeatResult {
    const now = Date.now();
    
    // Throttle processing rate to prevent overwhelming the system
    if (now - this.lastProcessedTimestamp < 16 && this.lastProcessedTimestamp !== 0) {
      // Return last result if we're processing too frequently
      return {
        bpm: this.bpmAnalyzer.currentBPM,
        confidence: 0,
        isBeat: false,
        lastBeatTime: this.lastBeatTime,
        rrData: [...this.rrIntervals]
      };
    }
    
    this.lastProcessedTimestamp = now;
    
    // Boost quality for better detection - never go below 20
    this.lastSignalQuality = Math.max(20, quality);
    
    // Keep a short buffer of raw values for anomaly detection
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Update the adaptive threshold periodically
    this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG && this.beatsCounter % 15 === 0);

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Improved beat detection with lower quality threshold - process all signals
    if (this.signalProcessor.bufferLength > 5) {
      // Enhanced beat detection with signal quality consideration
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        this.lastSignalQuality, 
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // False positive protection - reduce but be more permissive
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Only block extremely frequent beats
        if (timeSinceLastBeat < 200 && this.falsePositiveProtection > 3) {
          this.falsePositiveProtection++;
          isBeat = false;
          if (this.DEBUG) {
            console.log(`False positive rejected: extremely short interval (${timeSinceLastBeat}ms)`);
          }
        } else {
          this.falsePositiveProtection = Math.max(0, this.falsePositiveProtection - 1);
        }
      }
      
      // If beat detected and passes false positive check
      if (isBeat) {
        this.beatsCounter++;
        
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // Much more relaxed interval validation for better beat detection
          if (interval > 200 && interval < 2500) {
            // Store RR interval data
            this.rrIntervals.push({ timestamp: now, interval });
            if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
              this.rrIntervals.shift();
            }
            
            // Track quality of last 5 beats for confidence calculation
            this.lastFiveBeatsQuality.push(this.lastSignalQuality);
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
        
        // More lenient beep conditions - play sound on most beats
        const beatStrength = this.peakDetector.confidence;
        
        // Play more frequent beeps
        if ((beatStrength > 0.2 && this.lastSignalQuality > 25) || this.beatsCounter % 2 === 0) {
          // Use higher volume for better audibility
          this.audioHandler.playBeep(
            Math.min(1.0, beatStrength + 0.4), 
            Math.min(100, this.lastSignalQuality * 1.3)
          );
          
          if (this.DEBUG) {
            console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${this.lastSignalQuality}`);
          }
        }
        
        if (this.DEBUG && this.beatsCounter % 3 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${this.lastSignalQuality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // More aggressive missed beats handling
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.2 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After fewer missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 3 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat if we're missing too many - be more aggressive
          if (this.consecutiveMissedBeats > 4 && this.lastSignalQuality > 20) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound at higher volume
            this.audioHandler.playBeep(0.7, 60);
            console.log("Forced beat generated after missed beats");
          }
        }
      }
    }

    // Calculate final confidence with higher baseline
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                      (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality / 100);
    
    // Boost confidence significantly
    finalConfidence *= (0.9 + (0.3 * this.peakDetector.stability));
    finalConfidence = Math.min(1.0, finalConfidence + 0.15);
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.9;
    }

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
    this.lastProcessedTimestamp = 0;
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

