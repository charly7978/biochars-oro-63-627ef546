
import { ArrhythmiaData, ArrhythmiaWindow } from '@/types/arrhythmia';
import { 
  ArrhythmiaDetectionResult,
  ArrhythmiaStatus,
  ArrhythmiaListener,
  UserProfile
} from './types';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import { ARRHYTHMIA_CONFIG, NORMAL_INTERVAL_MS } from './constants';
import { calculateRMSSD, measureRRVariation } from './utils';

/**
 * Service for detecting arrhythmias from RR intervals
 * Uses real data analysis without simulations
 */
class ArrhythmiaDetectionService {
  // Configuration
  private readonly RMSSD_THRESHOLD = ARRHYTHMIA_CONFIG.RMSSD_THRESHOLD;
  private readonly VARIATION_THRESHOLD = ARRHYTHMIA_CONFIG.VARIATION_THRESHOLD;
  private readonly MIN_INTERVALS = ARRHYTHMIA_CONFIG.MIN_INTERVALS_FOR_DETECTION;
  
  // State
  private arrhythmiaCount: number = 0;
  private lastDetectionResult: ArrhythmiaDetectionResult | null = null;
  private currentStatus: ArrhythmiaStatus = { 
    statusMessage: "--", 
    lastArrhythmiaData: null 
  };
  
  // Window manager for visualizing arrhythmia events
  private windowManager: ArrhythmiaWindowManager;
  
  // Listeners for arrhythmia events
  private listeners: ArrhythmiaListener[] = [];
  
  // User profile for personalized thresholds
  private userProfile: UserProfile | null = null;
  
  constructor() {
    this.windowManager = new ArrhythmiaWindowManager();
    console.log("ArrhythmiaDetectionService initialized");
  }
  
  /**
   * Update RR intervals and perform arrhythmia detection
   * @param rrIntervals Array of RR intervals in milliseconds
   */
  public updateRRIntervals(rrIntervals: number[]): void {
    if (!rrIntervals || rrIntervals.length < this.MIN_INTERVALS) {
      return;
    }
    
    // Get most recent intervals for analysis
    const recentIntervals = rrIntervals.slice(-this.MIN_INTERVALS);
    
    // Only analyze if we have enough intervals
    if (recentIntervals.length >= this.MIN_INTERVALS) {
      // Perform real metrics calculation based on HRV analysis
      const rmssd = calculateRMSSD(recentIntervals);
      const variation = measureRRVariation(recentIntervals);
      
      // Detect arrhythmia based on user-specific or default thresholds
      const rmssdThreshold = this.userProfile?.rmssdThreshold || this.RMSSD_THRESHOLD;
      const variationThreshold = this.userProfile?.variationThreshold || this.VARIATION_THRESHOLD;
      
      const isArrhythmia = 
        rmssd > rmssdThreshold &&
        variation > variationThreshold;
      
      // Log detection results periodically
      if (Math.random() < 0.05) { // Log ~5% of updates to reduce console spam
        console.log("ArrhythmiaDetection: Analyzing intervals", {
          intervals: recentIntervals,
          rmssd,
          variation,
          rmssdThreshold,
          variationThreshold,
          isArrhythmia
        });
      }
      
      // If arrhythmia detected, update status and notify listeners
      if (isArrhythmia) {
        this.arrhythmiaCount++;
        
        // Create detection result
        const timestamp = Date.now();
        const detectionResult: ArrhythmiaDetectionResult = {
          timestamp,
          rmssd,
          rrVariation: variation,
          isArrhythmia
        };
        
        // Update status
        this.updateStatus(detectionResult);
        
        // Add window for visualization
        this.windowManager.addArrhythmiaWindow({
          start: timestamp - 1000, // 1 second before detection
          end: timestamp + 1000    // 1 second after detection
        });
        
        // Notify listeners
        this.notifyListeners(detectionResult);
        
        // Log detection
        console.log(`ArrhythmiaDetection: ARRHYTHMIA DETECTED | Count: ${this.arrhythmiaCount}`, {
          rmssd,
          variation,
          thresholds: { rmssd: rmssdThreshold, variation: variationThreshold }
        });
      }
      
      // Store last result regardless of whether it was an arrhythmia
      this.lastDetectionResult = {
        timestamp: Date.now(),
        rmssd,
        rrVariation: variation,
        isArrhythmia
      };
    }
  }
  
  /**
   * Check if the given RR intervals constitute an arrhythmia
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    if (!rrIntervals || rrIntervals.length < this.MIN_INTERVALS) {
      return {
        timestamp: Date.now(),
        rmssd: 0,
        rrVariation: 0,
        isArrhythmia: false
      };
    }
    
    // Calculate real metrics
    const rmssd = calculateRMSSD(rrIntervals);
    const variation = measureRRVariation(rrIntervals);
    
    // Get appropriate thresholds
    const rmssdThreshold = this.userProfile?.rmssdThreshold || this.RMSSD_THRESHOLD;
    const variationThreshold = this.userProfile?.variationThreshold || this.VARIATION_THRESHOLD;
    
    // Determine if it's an arrhythmia based on thresholds
    const isArrhythmia = 
      rmssd > rmssdThreshold &&
      variation > variationThreshold;
      
    return {
      timestamp: Date.now(),
      rmssd,
      rrVariation: variation,
      isArrhythmia
    };
  }
  
  /**
   * Check if current state is an arrhythmia 
   */
  public isArrhythmia(): boolean {
    return this.lastDetectionResult?.isArrhythmia || false;
  }
  
  /**
   * Update the arrhythmia status
   */
  private updateStatus(result: ArrhythmiaDetectionResult): void {
    if (result.isArrhythmia) {
      this.currentStatus = {
        statusMessage: `ARRHYTHMIA DETECTED | ${this.arrhythmiaCount}`,
        lastArrhythmiaData: {
          timestamp: result.timestamp,
          rmssd: result.rmssd,
          rrVariation: result.rrVariation
        }
      };
    }
  }
  
  /**
   * Get the current arrhythmia status
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    return this.currentStatus;
  }
  
  /**
   * Get the total arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Register a listener for arrhythmia events
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove a listener
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Notify listeners of an arrhythmia event
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }
  
  /**
   * Set user profile for personalized thresholds
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    console.log("ArrhythmiaDetection: User profile updated", profile);
  }
  
  /**
   * Get all arrhythmia windows for visualization
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return this.windowManager.getWindows();
  }
  
  /**
   * Clear arrhythmia windows
   */
  public clearArrhythmiaWindows(): void {
    this.windowManager.clearWindows();
  }
  
  /**
   * Reset the service
   */
  public resetService(): void {
    this.arrhythmiaCount = 0;
    this.lastDetectionResult = null;
    this.currentStatus = { 
      statusMessage: "--", 
      lastArrhythmiaData: null 
    };
    this.windowManager.clearWindows();
    console.log("ArrhythmiaDetectionService has been reset");
  }
}

// Singleton instance
export default new ArrhythmiaDetectionService();
