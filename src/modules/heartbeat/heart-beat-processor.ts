
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

  constructor() {
    // Initialize with more balanced parameters
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(300, 10, 0.4); // Slightly higher EMA alpha for less smoothing
    
    // More sensitive peak detector settings
    this.peakDetector = new PeakDetector(
      3,       // Smaller peak window for better sensitivity
      0.15,    // Lower threshold to detect more peaks
      0.3,     // Decreased strong peak threshold
      0.8,     // Keep dynamic threshold
      220,     // Shorter minimum time between beats
      1500     // Increased max time for better accuracy
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 180, 5);
    
    this.initialize();
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Initialize audio handler first (with additional attempts if needed)
      let audioInit = await this.audioHandler.initialize();
      
      // Retry audio initialization if it fails
      if (!audioInit) {
        console.log("Retrying audio initialization...");
        await new Promise(resolve => setTimeout(resolve, 500));
        audioInit = await this.audioHandler.initialize();
      }
      
      this.isInitialized = true;
      
      console.log("HeartBeatProcessor: Initialized with audio status:", audioInit);
      return true;
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
      // Still mark as initialized to allow processing without audio
      this.isInitialized = true;
      return false;
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
    
    // Improved beat detection with lower quality threshold
    if (this.signalProcessor.bufferLength > 10 && quality > 20) {
      // Enhanced beat detection with signal quality consideration
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        quality, 
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // False positive protection - reduce frequent consecutive beats
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // If beats are coming too quickly, likely false positives
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
        
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // More relaxed interval validation for better beat detection
          if (interval > 250 && interval < 2000) {
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
        
        // More lenient beep conditions - play sound on more beats
        const beatStrength = this.peakDetector.confidence;
        
        // Play more frequent beeps
        if ((beatStrength > 0.3 && quality > 40) || this.beatsCounter % 3 === 0) {
          this.audioHandler.playBeep(
            Math.min(0.9, beatStrength + 0.3), 
            Math.min(100, quality * 1.2)
          );
          
          if (this.DEBUG) {
            console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${quality}`);
          }
        }
        
        if (this.DEBUG && this.beatsCounter % 5 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${quality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // Missed beats handling with more aggressive forcing of beats
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.4 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After fewer missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 4 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat if we're missing too many
          if (this.consecutiveMissedBeats > 6 && quality > 30) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound
            this.audioHandler.playBeep(0.5, 50);
            console.log("Forced beat generated after too many missed beats");
          }
        }
      }
    }

    // Calculate final confidence with higher baseline
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                      (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality / 100);
    
    // Boost confidence slightly to improve BPM display
    finalConfidence *= (0.8 + (0.3 * this.peakDetector.stability));
    finalConfidence = Math.min(1.0, finalConfidence + 0.1);
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.8;
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
