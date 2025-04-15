
/**
 * Centralized service for arrhythmia detection
 * Only uses real data - no simulation
 */

import { ArrhythmiaWindow } from '@/hooks/vital-signs/types';
import { calculateRMSSD, calculateRRVariation } from '@/modules/vital-signs/arrhythmia/calculations';
import AudioFeedbackService from './AudioFeedbackService';
import { toast } from "@/hooks/use-toast";

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
  private readonly DETECTION_THRESHOLD: number = 0.2; // 20% threshold for HRV variation
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 5000; // 5 seconds between notifications
  
  private constructor() {}

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
   * Detect arrhythmia based on RR interval variations
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    if (rrIntervals.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now()
      };
    }
    
    // Get the 5 most recent intervals for analysis
    const lastIntervals = rrIntervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(lastIntervals);
    
    // Calculate variation ratio (normalized variability)
    const variationRatio = calculateRRVariation(lastIntervals);
    
    // Adjust threshold based on stability
    let thresholdFactor = this.DETECTION_THRESHOLD;
    if (this.stabilityCounter > 15) {
      thresholdFactor = 0.15; // Lower threshold when stable for higher sensitivity
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = 0.25; // Higher threshold when unstable
    }
    
    // Determine if rhythm is irregular
    const isIrregular = variationRatio > thresholdFactor;
    
    // Update stability counter
    if (!isIrregular) {
      this.stabilityCounter = Math.min(30, this.stabilityCounter + 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2);
    }
    
    // Detection of arrhythmia (real data only)
    const isArrhythmia = isIrregular && this.stabilityCounter < 25;
    
    // Update HRV data
    this.heartRateVariability.push(variationRatio);
    if (this.heartRateVariability.length > 20) {
      this.heartRateVariability.shift();
    }
    
    // Update arrhythmia state
    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    this.currentBeatIsArrhythmia = isArrhythmia;
    
    // Create arrhythmia window for visualization if needed
    if (isArrhythmia) {
      this.handleArrhythmiaDetection(lastIntervals, rmssd, variationRatio, thresholdFactor);
    }

    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: Date.now(),
      isArrhythmia
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
    
    // Log detection for debugging
    console.log('Arrhythmia detected:', {
      rmssd,
      variationRatio,
      threshold,
      timestamp: new Date(currentTime).toISOString()
    });
    
    // Create an arrhythmia window
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const windowWidth = Math.max(800, Math.min(1200, avgInterval * 3));
    const arrhythmiaWindow = {
      start: currentTime - windowWidth/2,
      end: currentTime + windowWidth/2
    };
    
    // Add window to collection
    this.addArrhythmiaWindow(arrhythmiaWindow);
    
    // Maybe trigger notification
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered > this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaTriggeredTime = currentTime;
      
      // Trigger special feedback for arrhythmia
      AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');
      
      // Show toast notification
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
  }
  
  /**
   * Add a new arrhythmia window for visualization
   */
  public addArrhythmiaWindow(window: ArrhythmiaWindow): void {
    // Check if there's a similar recent window (within 500ms)
    const currentTime = Date.now();
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
    this.arrhythmiaWindows = this.arrhythmiaWindows.filter(window => 
      currentTime - window.end < 15000 // Keep only windows from the last 15 seconds
    );
  }
  
  /**
   * Force add an arrhythmia window (for testing)
   */
  public forceAddArrhythmiaWindow(): void {
    const now = Date.now();
    this.addArrhythmiaWindow({
      start: now - 500,
      end: now + 500
    });
    console.log("Arrhythmia window FORCED for visualization");
  }
  
  /**
   * Update RR intervals for detection
   */
  public updateRRIntervals(intervals: number[]): void {
    this.lastRRIntervals = intervals;
  }
  
  /**
   * Reset all detection state
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
    
    console.log("ArrhythmiaDetectionService: All detection data reset");
  }
  
  /**
   * Get current arrhythmia state
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
}

export default ArrhythmiaDetectionService.getInstance();
