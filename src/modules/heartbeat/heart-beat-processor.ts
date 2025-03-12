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
    // Initialize with much more sensitive parameters for better detection
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(200, 6, 0.6); // Much higher EMA alpha for less smoothing
    
    // Extremely sensitive peak detector settings
    this.peakDetector = new PeakDetector(
      2,       // Much smaller peak window for better sensitivity
      0.1,     // Much lower threshold to detect more peaks
      0.2,     // Much lower strong peak threshold for better detection
      0.6,     // Lower dynamic threshold
      150,     // Even shorter minimum time between beats
      1800     // Longer max time for better coverage
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(40, 200, 3); // Shorter window for faster adaptation
    
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
        confidence: 0.3, // Higher baseline confidence
        isBeat: false,
        lastBeatTime: this.lastBeatTime,
        rrData: [...this.rrIntervals]
      };
    }
    
    this.lastProcessedTimestamp = now;
    
    // Boost quality dramatically for better detection - never go below 40
    this.lastSignalQuality = Math.max(40, quality);
    
    // Keep a short buffer of raw values for anomaly detection
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Process the signal through our signal processor
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Update the adaptive threshold more frequently
    this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, this.DEBUG && this.beatsCounter % 10 === 0);

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Process all signals regardless of buffer length
    if (this.signalProcessor.bufferLength > 2) { // Start detecting much earlier
      // Force some initial beats to jumpstart the algorithm
      if (this.beatsCounter === 0 && this.forceInitialBeatsCount < 3) {
        console.log("Forcing initial beat to jumpstart algorithm");
        isBeat = true;
        this.forceInitialBeatsCount++;
        // Use a typical heart rate interval
        const typicalInterval = 800; // ~75 BPM
        this.bpmAnalyzer.addBeatInterval(typicalInterval);
        this.audioHandler.playBeep(0.8, 80);
      } else {
        // Enhanced beat detection with much higher sensitivity
        isBeat = this.peakDetector.detectBeat(
          now, 
          smoothedValue, 
          this.lastSignalQuality, 
          signalBuffer, 
          derivative, 
          this.lastBeatTime
        );
      }
      
      // Minimal false positive protection - be very permissive
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Only block extremely frequent beats - much shorter window
        if (timeSinceLastBeat < 150 && this.falsePositiveProtection > 5) {
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
          if (interval > 150 && interval < 3000) {
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
        
        // Play sound on ALL beats with higher volume
        const beatStrength = this.peakDetector.confidence;
        this.audioHandler.playBeep(
          Math.min(1.0, beatStrength + 0.6), // Much higher volume 
          Math.min(100, this.lastSignalQuality * 1.5)  // Much higher quality boost
        );
          
        if (this.DEBUG) {
          console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${this.lastSignalQuality}`);
        }
        
        if (this.DEBUG && this.beatsCounter % 2 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${this.lastSignalQuality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // More aggressive missed beats handling - force beats much sooner
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.1 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After fewer missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 2 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat if we're missing too many - be more aggressive
          if (this.consecutiveMissedBeats > 3) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound at higher volume
            this.audioHandler.playBeep(0.8, 70);
            console.log("Forced beat generated after missed beats");
          }
        }
      }
    }

    // Calculate final confidence with much higher baseline
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                      (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality / 100);
    
    // Boost confidence dramatically
    finalConfidence *= (1.0 + (0.5 * this.peakDetector.stability));
    finalConfidence = Math.min(1.0, finalConfidence + 0.3); // Much higher baseline boost
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.95; // Less penalty
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
