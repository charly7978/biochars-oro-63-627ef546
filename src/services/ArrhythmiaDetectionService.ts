
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
  private readonly DETECTION_THRESHOLD: number = 0.28;
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 10000;
  
  // False positive prevention
  private falsePositiveCounter: number = 0;
  private readonly MAX_FALSE_POSITIVES: number = 3;
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 3;
  private readonly CONFIRMATION_WINDOW_MS: number = 12000;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Setup automatic cleanup
    this.setupAutomaticCleanup();
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
   * Register for arrhythmia window notifications
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.arrhythmiaListeners.push(listener);
  }

  /**
   * Remove arrhythmia listener
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.arrhythmiaListeners = this.arrhythmiaListeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners about a new arrhythmia window
   */
  private notifyListeners(window: ArrhythmiaWindow): void {
    this.arrhythmiaListeners.forEach(listener => {
      try {
        listener(window);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }

  /**
   * Update RR intervals for analysis
   */
  public updateRRIntervals(rrIntervals: number[]): void {
    this.lastRRIntervals = rrIntervals;
  }

  /**
   * Detect arrhythmia based on RR interval variations
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
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
    
    // Requires at least 5 intervals for reliable analysis
    if (rrIntervals.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    // Get the 5 most recent intervals for analysis
    const lastIntervals = rrIntervals.slice(-5);
    
    // Verify intervals are physiologically valid
    const validIntervals = lastIntervals.filter(
      interval => interval >= this.MIN_INTERVAL && interval <= this.MAX_INTERVAL
    );
    
    // If less than 80% of intervals are valid, not reliable
    if (validIntervals.length < lastIntervals.length * 0.8) {
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
      thresholdFactor = 0.23;
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = 0.33;
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
      return; // Too soon, ignore
    }
    
    // Log detection for debugging
    console.log('CONFIRMED Arrhythmia detected:', {
      rmssd,
      variationRatio,
      threshold,
      stabilityCounter: this.stabilityCounter,
      timestamp: new Date(currentTime).toISOString()
    });
    
    // Create an arrhythmia window
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Larger window to ensure visualization
    const windowWidth = Math.max(1000, Math.min(1800, avgInterval * 3));
    
    const arrhythmiaWindow = {
      start: currentTime - windowWidth/2,
      end: currentTime + windowWidth/2
    };
    
    // Add window to collection and broadcast to listeners
    this.addArrhythmiaWindow(arrhythmiaWindow);
    
    // Update counters
    this.arrhythmiaCount++;
    this.lastArrhythmiaTriggeredTime = currentTime;
    
    // Trigger special feedback for arrhythmia
    AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');
    
    // Limit number of notifications
    const shouldShowToast = this.arrhythmiaCount <= 3 || this.arrhythmiaCount % 3 === 0;
    
    // Show toast notification (limited to avoid saturation)
    if (shouldShowToast) {
      if (this.arrhythmiaCount === 1) {
        toast({
          title: '¡Atención!',
          description: 'Se ha detectado una posible arritmia',
          variant: 'destructive',
          duration: 6000
        });
      } else {
        toast({
          title: 'Arritmia detectada',
          description: `Se han detectado ${this.arrhythmiaCount} posibles arritmias`,
          variant: 'destructive',
          duration: 6000
        });
      }
    }
    
    // Auto-cleanup to avoid continuous detections
    setTimeout(() => {
      this.currentBeatIsArrhythmia = false;
    }, windowWidth);
  }
  
  /**
   * Add a new arrhythmia window for visualization
   */
  public addArrhythmiaWindow(window: ArrhythmiaWindow): void {
    // Check if there's a similar recent window (within 500ms)
    const hasRecentWindow = this.arrhythmiaWindows.some(existingWindow => 
      Math.abs(existingWindow.start - window.start) < 500 && 
      Math.abs(existingWindow.end - window.end) < 500
    );
    
    if (hasRecentWindow) {
      return; // Don't add duplicate windows
    }
    
    // Add new arrhythmia window
    this.arrhythmiaWindows.push(window);
    
    // Sort by time for consistent visualization
    this.arrhythmiaWindows.sort((a, b) => b.start - a.start);
    
    // Limit to the 5 most recent windows
    if (this.arrhythmiaWindows.length > 5) {
      this.arrhythmiaWindows = this.arrhythmiaWindows.slice(0, 5);
    }
    
    // Debug log
    console.log("Arrhythmia window added for visualization", {
      startTime: new Date(window.start).toISOString(),
      endTime: new Date(window.end).toISOString(),
      duration: window.end - window.start,
      windowsCount: this.arrhythmiaWindows.length
    });
    
    // Notify listeners about the new window
    this.notifyListeners(window);
  }
  
  /**
   * Get current arrhythmia status and data
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    const statusMessage = this.arrhythmiaCount > 0 
      ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
      : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    const lastArrhythmiaData = this.currentBeatIsArrhythmia ? {
      timestamp: Date.now(),
      rmssd: calculateRMSSD(this.lastRRIntervals.slice(-5)),
      rrVariation: calculateRRVariation(this.lastRRIntervals.slice(-5))
    } : null;
    
    return {
      arrhythmiaCount: this.arrhythmiaCount,
      statusMessage,
      lastArrhythmiaData
    };
  }
  
  /**
   * Check if arrhythmia is currently detected
   */
  public isArrhythmia(): boolean {
    return this.currentBeatIsArrhythmia;
  }
  
  /**
   * Get arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Get all current arrhythmia windows
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return [...this.arrhythmiaWindows];
  }
  
  /**
   * Clear outdated arrhythmia windows
   */
  public cleanupOldWindows(): void {
    const currentTime = Date.now();
    // Filter only recent windows (less than 20 seconds)
    const oldWindows = this.arrhythmiaWindows.filter(window => 
      currentTime - window.end < 20000
    );
    
    // Only update if there are changes
    if (oldWindows.length !== this.arrhythmiaWindows.length) {
      console.log(`Cleaned up old arrhythmia windows: removed ${this.arrhythmiaWindows.length - oldWindows.length} windows`);
      this.arrhythmiaWindows = oldWindows;
    }
  }
  
  /**
   * Reset the service completely
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
    
    console.log("ArrhythmiaDetectionService: Reset complete");
  }
  
  /**
   * Clean up resources
   */
  public cleanUp(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create and export singleton instance
const instance = ArrhythmiaDetectionService.getInstance();
export default instance;
