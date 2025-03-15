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
  private forceInitialBeatsCount = 0;

  constructor() {
    // Initialize with less sensitive parameters for more reliable detection
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(200, 8, 0.3); // Lower EMA alpha for more smoothing
    
    // Less sensitive peak detector settings
    this.peakDetector = new PeakDetector(
      5,       // Larger peak window for better noise rejection
      0.25,    // Higher threshold to detect fewer but stronger peaks
      0.45,    // Higher strong peak threshold for better reliability
      0.7,     // Standard dynamic threshold
      300,     // Longer minimum time between beats to avoid false positives
      1500     // Standard max time
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(45, 180, 5); // Longer window for better stability
    
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
        confidence: 0.2, // Lower baseline confidence
        isBeat: false,
        lastBeatTime: this.lastBeatTime,
        rrData: [...this.rrIntervals]
      };
    }
    
    this.lastProcessedTimestamp = now;
    
    // Use quality as-is, don't artificially boost
    this.lastSignalQuality = quality;
    
    // Keep a buffer of raw values for anomaly detection
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Update the adaptive threshold periodically
    this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG && this.beatsCounter % 10 === 0);

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Process signal only when we have enough buffer
    if (this.signalProcessor.bufferLength > 10) { // Require more data before detecting
      // Only force first beat if quality is good
      if (this.beatsCounter === 0 && this.forceInitialBeatsCount < 2 && quality > 50) {
        console.log("Forcing initial beat to jumpstart algorithm");
        isBeat = true;
        this.forceInitialBeatsCount++;
        // Use a typical heart rate interval
        const typicalInterval = 800; // ~75 BPM
        this.bpmAnalyzer.addBeatInterval(typicalInterval);
        this.audioHandler.playBeep(0.6, 60);
      } else {
        // Standard beat detection with normal sensitivity
        isBeat = this.peakDetector.detectBeat(
          now, 
          smoothedValue, 
          this.lastSignalQuality, 
          signalBuffer, 
          derivative, 
          this.lastBeatTime
        );
      }
      
      // Enhanced false positive protection
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Block frequent beats - reasonable window
        if (timeSinceLastBeat < 300) {
          isBeat = false;
          this.falsePositiveProtection++;
          if (this.DEBUG) {
            console.log(`False positive rejected: short interval (${timeSinceLastBeat}ms)`);
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
          
          // Stricter interval validation for better reliability
          if (interval > 300 && interval < 1500) {
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
        
        // Play sound on beats with volume based on quality
        const beatStrength = this.peakDetector.confidence;
        this.audioHandler.playBeep(
          Math.min(0.8, beatStrength + 0.2),  // Lower volume
          Math.min(80, this.lastSignalQuality)  // Standard quality mapping
        );
          
        if (this.DEBUG) {
          console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${this.lastSignalQuality}`);
        }
        
        if (this.DEBUG && this.beatsCounter % 2 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${this.lastSignalQuality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // Less aggressive missed beats handling
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.3 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After more missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 4 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat if we're missing too many, but be conservative
          if (this.consecutiveMissedBeats > 6 && quality > 45) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound at moderate volume
            this.audioHandler.playBeep(0.5, 50);
            console.log("Forced beat generated after missed beats");
          }
        }
      }
    }

    // Calculate final confidence with lower baseline
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                      (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality / 100);
    
    // Adjust confidence based on stability
    finalConfidence *= (0.9 + (0.3 * this.peakDetector.stability));
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.8; // More penalty for forced mode
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
    this.forceInitialBeatsCount = 0;
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
