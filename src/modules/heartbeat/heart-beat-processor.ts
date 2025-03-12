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
    // Balanced parameters for reliable detection
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(200, 8, 0.3); // Balanced smoothing
    
    // Balanced peak detector settings
    this.peakDetector = new PeakDetector(
      3,       // Balanced peak window
      0.2,     // Moderate threshold
      0.35,    // Moderate strong peak threshold
      0.65,    // Moderate dynamic threshold
      250,     // Realistic minimum time between beats (250ms = 240bpm max)
      1500     // Realistic maximum time (1500ms = 40bpm min)
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
    
    // Use signal quality as provided, with balanced minimum
    this.lastSignalQuality = Math.max(30, quality);
    
    // Keep a short buffer of raw values for anomaly detection
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
    
    // Only start detecting with sufficient buffer
    if (this.signalProcessor.bufferLength > 5) {
      // Standard beat detection
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        this.lastSignalQuality, 
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // Basic false positive protection
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Block extremely frequent beats
        if (timeSinceLastBeat < 200) {
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
        this.beatsCounter++;
        
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // Validate interval is physiologically plausible
          if (interval > 250 && interval < 1800) {
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
        
        // Play sound with balanced volume based on confidence
        const beatStrength = this.peakDetector.confidence;
        this.audioHandler.playBeep(
          Math.min(0.8, beatStrength + 0.3), // Balanced volume
          Math.min(80, this.lastSignalQuality)  // Quality-based tone
        );
          
        if (this.DEBUG) {
          console.log(`BEEP played with strength ${beatStrength.toFixed(2)} and quality ${this.lastSignalQuality}`);
        }
        
        if (this.DEBUG && this.beatsCounter % 2 === 0) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.peakDetector.confidence.toFixed(2)}, Quality: ${this.lastSignalQuality}, Stability: ${this.peakDetector.stability.toFixed(2)}`);
        }
      }
      
      // Missed beats handling - balanced approach
      const expectedBeatInterval = 60000 / (currentBpm || 75);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.5 && this.lastBeatTime > 0) {
        this.consecutiveMissedBeats++;
        
        // After several missed beats, try to recalibrate
        if (this.consecutiveMissedBeats > 4 && !this.forcedDetectionMode) {
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entering forced detection mode after missed beats");
          
          // Force a beat only after a significant period with no beats
          if (this.consecutiveMissedBeats > 6 && now - this.lastBeatTime > expectedBeatInterval * 2) {
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Play a forced beat sound at moderate volume
            this.audioHandler.playBeep(0.5, 50);
            console.log("Forced beat generated after missing multiple beats");
          }
        }
      }
    }

    // Calculate confidence with balanced approach
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                     (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality / 100);
    
    // Moderate confidence boost based on stability
    finalConfidence *= (1.0 + (0.3 * this.peakDetector.stability));
    finalConfidence = Math.min(1.0, finalConfidence + 0.15); // Reasonable baseline
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.7; // Significant penalty for forced mode
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
