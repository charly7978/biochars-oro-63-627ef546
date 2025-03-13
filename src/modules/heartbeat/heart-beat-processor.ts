
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
    // Improved parameters for more sensitive detection
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(200, 6, 0.4); // More responsive smoothing
    
    // More sensitive peak detector settings for better capturing beats
    this.peakDetector = new PeakDetector(
      2,       // Smaller peak window for faster detection
      0.15,    // Lower threshold to catch more peaks
      0.25,    // Lower strong peak threshold
      0.55,    // More aggressive dynamic threshold
      240,     // Slightly lower minimum time (240ms = 250bpm max)
      1600     // Increased maximum time (1600ms = 37.5bpm min)
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 200, 5); // Standard physiological range with good window
    
    this.initialize();
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.initializationAttempts > 0) return true;
    
    this.initializationAttempts++;
    console.log(`HeartBeatProcessor initialization attempt #${this.initializationAttempts}`);

    try {
      // Initialize audio handler first
      let audioInit = await this.audioHandler.initialize();
      
      // Retry audio initialization if it fails
      if (!audioInit) {
        console.log("Retrying audio initialization after short delay...");
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
    if (now - this.lastProcessedTimestamp < 20 && this.lastProcessedTimestamp !== 0) {
      // Return last result if we're processing too frequently
      return {
        bpm: this.bpmAnalyzer.currentBPM,
        confidence: 0.2, // Balanced confidence
        isBeat: false,
        lastBeatTime: this.lastBeatTime,
        rrData: [...this.rrIntervals]
      };
    }
    
    this.lastProcessedTimestamp = now;
    
    // Increase minimum signal quality to help with detection
    this.lastSignalQuality = Math.max(40, quality);
    
    // Keep a short buffer of raw values for anomaly detection
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // More frequent update of adaptive threshold for faster response
    if (this.beatsCounter % 5 === 0 || this.forcedDetectionMode) {
      this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG);
    }
    
    // Log more detailed signal information for debugging
    if (this.DEBUG && this.beatsCounter % 20 === 0) {
      console.log(`Signal values - Raw: ${value.toFixed(2)}, Smoothed: ${smoothedValue.toFixed(2)}, Derivative: ${derivative.toFixed(2)}, Quality: ${this.lastSignalQuality}`);
    }

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Faster detection with smaller buffer requirement
    if (this.signalProcessor.bufferLength > 3) {
      // More sensitive beat detection with relaxed quality check
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        Math.max(30, this.lastSignalQuality), // Use a minimum quality threshold
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // Less aggressive false positive protection
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Block only extremely frequent beats (less restrictive)
        if (timeSinceLastBeat < 180) {
          isBeat = false;
          this.falsePositiveProtection++;
          if (this.DEBUG) {
            console.log(`False positive rejected: extremely short interval (${timeSinceLastBeat}ms)`);
          }
        } else {
          this.falsePositiveProtection = Math.max(0, this.falsePositiveProtection - 1);
        }
      }
      
      // If beat detected and passes false positive check
      if (isBeat) {
        console.log(`BEAT DETECTED at timestamp ${now} with quality ${this.lastSignalQuality}`);
        this.beatsCounter++;
        
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // More permissive interval validation
          if (interval > 240 && interval < 1600) {
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
        
        // Play sound with increased volume based on confidence
        const beatStrength = this.peakDetector.confidenceLevel; // Using getter instead of private property
        this.audioHandler.playBeep(
          Math.min(0.9, beatStrength + 0.4), // Increased volume
          Math.min(85, this.lastSignalQuality)  // Higher quality-based tone
        );
          
        if (this.DEBUG) {
          console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${this.lastSignalQuality}`);
        }
        
        if (this.DEBUG && this.beatsCounter % 2 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidenceLevel.toFixed(2)}, Quality: ${this.lastSignalQuality}, Stability: ${this.peakDetector.stabilityLevel.toFixed(2)}`);
        }
      }
      
      // More aggressive missed beats handling
      const expectedBeatInterval = 60000 / (currentBpm || 70);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.3 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // Enter forced mode sooner
        if (this.consecutiveMissedBeats > 3 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat after fewer missed beats
          if (this.consecutiveMissedBeats > 4 && now - this.lastBeatTime > expectedBeatInterval * 1.6) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound at higher volume
            this.audioHandler.playBeep(0.7, 60);
            console.log("Forced beat generated after missing multiple beats");
          }
        }
      }
    }

    // Calculate confidence with more aggressive boost
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                     (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality);
    
    // Strong confidence boost based on stability
    finalConfidence *= (1.0 + (0.5 * this.peakDetector.stabilityLevel)); // Using getter instead of private property
    finalConfidence = Math.min(1.0, finalConfidence + 0.2); // Higher baseline
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.8; // Less penalty for forced mode
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
