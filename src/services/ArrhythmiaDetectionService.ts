/**
 * Centralized service for arrhythmia detection
 * Only uses real data - no simulation
 */

import { ArrhythmiaWindow } from '@/hooks/vital-signs/types';
import { calculateRMSSD, calculateRRVariation } from '@/modules/vital-signs/arrhythmia/calculations';
import AudioFeedbackService from './AudioFeedbackService';
import { toast } from "sonner";

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
  timestamp: number;
}

export interface ArrhythmiaStatus {
  arrhythmiaCount: number;
  statusMessage: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  
  // Detection state
  private heartRateVariability: number[] = [];
  private stabilityCounter: number = 0;
  private lastRRIntervals: number[] = [];
  private lastIsArrhythmia: boolean = false;
  private currentBeatIsArrhythmia: boolean = false;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTriggeredTime: number = 0;
  private arrhythmiaWindows: ArrhythmiaWindow[] = [];
  private arrhythmiaListeners: ArrhythmiaListener[] = [];
  
  // Arrhythmia detection constants
  private readonly DETECTION_THRESHOLD: number = 0.17; // Lowered threshold for better sensitivity
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 5000;
  
  // False positive prevention
  private falsePositiveCounter: number = 0;
  private readonly MAX_FALSE_POSITIVES: number = 3;
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 1;
  private readonly CONFIRMATION_WINDOW_MS: number = 10000;
  
  // Debug mode for forced detection
  private forcedArrhythmiaDetection: boolean = false;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Setup automatic cleanup
    this.setupAutomaticCleanup();
    console.log("ArrhythmiaDetectionService initialized");
  }

  private setupAutomaticCleanup(): void {
    // Clean old arrhythmia windows every 3 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldWindows();
    }, 3000);
  }

  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  /**
   * Force arrhythmia detection for testing
   */
  public forceArrhythmiaDetection(): void {
    this.forcedArrhythmiaDetection = true;
    
    // Create a new arrhythmia window
    const currentTime = Date.now();
    const window: ArrhythmiaWindow = {
      id: `forced-${currentTime}`,
      start: currentTime,
      end: currentTime + 5000,
      type: 'forced',
      intensity: 0.8
    };
    
    // Add to windows
    this.arrhythmiaWindows.push(window);
    
    // Notify listeners
    this.notifyListeners(window);
    
    // Trigger audio alert
    AudioFeedbackService.playAlertSound('arrhythmia');
    
    // Update count
    this.arrhythmiaCount++;
    this.currentBeatIsArrhythmia = true;
    
    // Show toast
    toast.warning("¡Arritmia detectada!", {
      description: "Se ha detectado un posible patrón de arritmia.",
      duration: 5000
    });
    
    console.log("Forced arrhythmia detection triggered");
    setTimeout(() => {
      this.forcedArrhythmiaDetection = false;
      this.currentBeatIsArrhythmia = false;
    }, 5000);
  }

  /**
   * Register for arrhythmia window notifications
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    // Make sure we don't add duplicate listeners
    if (!this.arrhythmiaListeners.includes(listener)) {
      this.arrhythmiaListeners.push(listener);
      console.log(`ArrhythmiaDetectionService: Added listener, count: ${this.arrhythmiaListeners.length}`);
    }
  }

  /**
   * Remove arrhythmia listener
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    const prevCount = this.arrhythmiaListeners.length;
    this.arrhythmiaListeners = this.arrhythmiaListeners.filter(l => l !== listener);
    console.log(`ArrhythmiaDetectionService: Removed listener, count: ${prevCount} -> ${this.arrhythmiaListeners.length}`);
  }

  /**
   * Clean up old arrhythmia windows
   */
  private cleanupOldWindows(): void {
    const now = Date.now();
    const oldWindows = this.arrhythmiaWindows.filter(w => w.end < now);
    
    if (oldWindows.length > 0) {
      this.arrhythmiaWindows = this.arrhythmiaWindows.filter(w => w.end >= now);
      console.log(`ArrhythmiaDetectionService: Cleaned up ${oldWindows.length} expired arrhythmia windows`);
    }
  }

  /**
   * Notify all listeners about a new arrhythmia window
   */
  private notifyListeners(window: ArrhythmiaWindow): void {
    if (this.arrhythmiaListeners.length === 0) {
      console.warn("ArrhythmiaDetectionService: No listeners to notify about arrhythmia window");
      return;
    }
    
    console.log(`ArrhythmiaDetectionService: Notifying ${this.arrhythmiaListeners.length} listeners about arrhythmia window`, {
      windowStart: new Date(window.start).toISOString(),
      windowEnd: new Date(window.end).toISOString()
    });
    
    this.arrhythmiaListeners.forEach(listener => {
      try {
        listener(window);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }

  /**
   * Get arrhythmia windows for visualization
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return [...this.arrhythmiaWindows];
  }

  /**
   * Update RR intervals for analysis
   */
  public updateRRIntervals(rrIntervals: number[]): void {
    if (rrIntervals && rrIntervals.length > 0) {
      this.lastRRIntervals = rrIntervals;
    }
  }

  /**
   * Check if there's currently an arrhythmia
   */
  public isArrhythmia(): boolean {
    return this.currentBeatIsArrhythmia || this.forcedArrhythmiaDetection;
  }

  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }

  /**
   * Detect arrhythmia based on RR interval variations
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    // Forced detection mode (for testing)
    if (this.forcedArrhythmiaDetection) {
      return {
        isArrhythmia: true,
        rmssd: 50,
        rrVariation: 0.3,
        timestamp: currentTime
      };
    }
    
    // Protection against frequent calls - prevents false detections from noise
    if (currentTime - this.lastDetectionTime < 250) {
      return {
        isArrhythmia: this.currentBeatIsArrhythmia,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    this.lastDetectionTime = currentTime;
    
    // Use provided intervals if available, otherwise use stored intervals
    const intervalsToUse = rrIntervals && rrIntervals.length > 0 ? rrIntervals : this.lastRRIntervals;
    
    // Requires at least 5 intervals for reliable analysis
    if (!intervalsToUse || intervalsToUse.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    // Get the most recent intervals for analysis
    const lastIntervals = intervalsToUse.slice(-5);
    
    // Verify intervals are physiologically valid
    const validIntervals = lastIntervals.filter(
      interval => interval >= this.MIN_INTERVAL && interval <= this.MAX_INTERVAL
    );
    
    // If less than 60% of intervals are valid, not reliable
    if (validIntervals.length < lastIntervals.length * 0.6) {
      // Reset detection to avoid false positives from noise
      this.stabilityCounter = Math.min(this.stabilityCounter + 1, 30);
      this.currentBeatIsArrhythmia = false;
      
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(validIntervals);
    
    // Calculate variation ratio (normalized variability)
    const variationRatio = calculateRRVariation(validIntervals);
    
    // Adjust threshold based on stability
    let thresholdFactor = this.DETECTION_THRESHOLD;
    if (this.stabilityCounter > 15) {
      thresholdFactor = this.DETECTION_THRESHOLD * 0.9;
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = this.DETECTION_THRESHOLD * 1.4;
    }
    
    // Determine if rhythm is irregular
    const isIrregular = variationRatio > thresholdFactor;
    
    // Update stability counter
    if (!isIrregular) {
      this.stabilityCounter = Math.min(30, this.stabilityCounter + 1);
      this.falsePositiveCounter = Math.max(0, this.falsePositiveCounter - 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
    }
    
    // Detection of arrhythmia (real data only)
    const potentialArrhythmia = isIrregular && this.stabilityCounter < 18;
    
    if (potentialArrhythmia) {
      console.log("Potential arrhythmia detected:", { 
        rmssd, 
        variationRatio, 
        threshold: thresholdFactor,
        rrIntervals: validIntervals
      });
    }
    
    // Update HRV data
    this.heartRateVariability.push(variationRatio);
    if (this.heartRateVariability.length > 20) {
      this.heartRateVariability.shift();
    }
    
    // Processing to confirm arrhythmia - requires multiple confirmation
    let confirmedArrhythmia = false;
    
    if (potentialArrhythmia) {
      // If it's a new potential arrhythmia event
      if (!this.currentBeatIsArrhythmia) {
        this.arrhythmiaConfirmationCounter++;
        
        // Check if we've accumulated enough confirmations
        if (this.arrhythmiaConfirmationCounter >= this.REQUIRED_CONFIRMATIONS) {
          confirmedArrhythmia = true;
          this.arrhythmiaConfirmationCounter = 0;
        } else {
          // Not yet confirmed, but continuing to track
          console.log(`Potential arrhythmia detected, confirmation ${this.arrhythmiaConfirmationCounter}/${this.REQUIRED_CONFIRMATIONS}`);
        }
      }
    } else {
      // If too much time has passed without confirmation, reset counter
      if (currentTime - this.lastArrhythmiaTriggeredTime > this.CONFIRMATION_WINDOW_MS) {
        this.arrhythmiaConfirmationCounter = 0;
      }
    }
    
    // Update arrhythmia state
    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    
    // Only update to true if confirmed
    if (confirmedArrhythmia) {
      this.currentBeatIsArrhythmia = true;
      this.handleArrhythmiaDetection(validIntervals, rmssd, variationRatio, thresholdFactor);
    } else if (!potentialArrhythmia) {
      // Reset only if there's no potential arrhythmia
      this.currentBeatIsArrhythmia = false;
    }
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: currentTime,
      isArrhythmia: this.currentBeatIsArrhythmia
    };
  }
  
  /**
   * Handle arrhythmia detection and create visualization window
   */
  private handleArrhythmiaDetection(
    intervals: number[], 
    rmssd: number, 
    variationRatio: number, 
    threshold: number
  ): void {
    const currentTime = Date.now();
    
    // Check time since last arrhythmia to avoid multiple alerts
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      console.log("Arrhythmia detection ignored - too soon after previous detection", {
        timeSinceLastTriggered,
        minInterval: this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL
      });
      return; // Too soon, ignore
    }
    
    // Log detection
    console.log("ARRHYTHMIA DETECTED", {
      rmssd,
      variationRatio,
      threshold,
      intervals,
      timestamp: new Date(currentTime).toISOString()
    });
    
    // Play alert sound
    AudioFeedbackService.playAlertSound('arrhythmia');
    
    // Show toast notification
    toast.warning("¡Arritmia detectada!", {
      description: "Se ha detectado un posible patrón de arritmia.",
      duration: 5000
    });
    
    // Increment arrhythmia count
    this.arrhythmiaCount++;
    
    // Create arrhythmia window for visualization
    const window: ArrhythmiaWindow = {
      id: `arrhythmia-${currentTime}`,
      start: currentTime,
      end: currentTime + 5000, // 5 second window
      type: 'irregular',
      intensity: variationRatio
    };
    
    // Add to arrhythmia windows
    this.arrhythmiaWindows.push(window);
    
    // Notify listeners
    this.notifyListeners(window);
    
    // Update last triggered time
    this.lastArrhythmiaTriggeredTime = currentTime;
  }
  
  /**
   * Clean up resources
   */
  public cleanUp(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear listeners
    this.arrhythmiaListeners = [];
    
    // Reset detection state
    this.reset();
    
    console.log("ArrhythmiaDetectionService: All detection data reset");
  }
  
  /**
   * Reset the arrhythmia detection
   */
  public reset(): void {
    this.heartRateVariability = [];
    this.stabilityCounter = 0;
    this.lastRRIntervals = [];
    this.lastIsArrhythmia = false;
    this.currentBeatIsArrhythmia = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTriggeredTime = 0;
    this.arrhythmiaWindows = [];
    this.falsePositiveCounter = 0;
    this.lastDetectionTime = 0;
    this.arrhythmiaConfirmationCounter = 0;
    this.forcedArrhythmiaDetection = false;
    
    console.log("ArrhythmiaDetectionService: Reset complete");
  }
}

// Export singleton instance
export default ArrhythmiaDetectionService.getInstance();
