
import { ArrhythmiaStatus, ArrhythmiaDetectionResult, ArrhythmiaListener, UserProfile } from './types';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import { categorizeArrhythmia } from './utils';

/**
 * Service for detecting and managing arrhythmias
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private windowManager: ArrhythmiaWindowManager;
  private currentStatus: ArrhythmiaStatus = 'normal';
  private arrhythmiaListeners: Array<(status: ArrhythmiaStatus) => void> = [];
  private detectionListeners: Array<ArrhythmiaListener> = [];
  private arrhythmiaCount: number = 0;
  private userProfile: UserProfile | null = null;
  private lastRRIntervals: number[] = [];
  private lastArrhythmiaData: Record<string, any> | null = null;
  
  private constructor() {
    this.windowManager = new ArrhythmiaWindowManager();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }
  
  /**
   * Check if an arrhythmia is currently detected
   */
  public isArrhythmia(): boolean {
    return this.currentStatus !== 'normal';
  }
  
  /**
   * Get the current arrhythmia status
   */
  public getArrhythmiaStatus(): {
    status: ArrhythmiaStatus; 
    statusMessage: string; 
    lastArrhythmiaData: Record<string, any> | null
  } {
    // Create a descriptive status message based on the current status
    let statusMessage = String(this.currentStatus); // Convert to string to avoid type issues
    if (this.arrhythmiaCount > 0) {
      statusMessage = `${this.currentStatus.toString()}|${this.arrhythmiaCount}`;
    }

    return {
      status: this.currentStatus,
      statusMessage,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  /**
   * Update the arrhythmia status
   */
  public updateStatus(status: ArrhythmiaStatus, probability: number = 0, details: Record<string, any> = {}): void {
    // Don't update if the status is the same, except for 'unknown' which can always be updated
    if (this.currentStatus === status && status !== 'unknown') {
      return;
    }
    
    // Set the new status
    this.currentStatus = status;
    
    // Increment arrhythmia count if status is abnormal
    if (status !== 'normal' && status !== 'unknown') {
      this.arrhythmiaCount++;
      this.lastArrhythmiaData = {
        timestamp: Date.now(),
        ...details
      };
    }
    
    // Log the status change
    console.log(`ArrhythmiaDetectionService: Status updated to ${status} (probability: ${probability})`);
    
    // Record this in the window manager if it's an actual arrhythmia
    if (status !== 'normal') {
      this.windowManager.addArrhythmiaWindow(
        Date.now(),
        details.duration || 5000, // Default duration of 5 seconds
        status,
        details.intervals || [],
        probability,
        details
      );
    }
    
    // Notify all listeners
    this.notifyListeners();

    // Notify detection listeners with more detailed information
    this.notifyDetectionListeners({
      timestamp: Date.now(),
      status,
      probability,
      signalQuality: details.signalQuality || 100,
      details,
      latestIntervals: details.intervals || this.lastRRIntervals,
      isArrhythmia: status !== 'normal'
    });
  }

  /**
   * Update RR intervals for analysis
   */
  public updateRRIntervals(intervals: number[]): void {
    if (!intervals || intervals.length === 0) return;
    
    // Store the intervals
    this.lastRRIntervals = [...intervals];
    
    // Analyze for arrhythmia if enough intervals
    if (intervals.length >= 3) {
      this.analyzeRRIntervals(intervals);
    }
  }
  
  /**
   * Analyze RR intervals for arrhythmia detection
   */
  private analyzeRRIntervals(intervals: number[]): void {
    if (intervals.length < 3) return;

    // Calculate average and variation
    let sum = 0;
    for (let i = 0; i < intervals.length; i++) {
      sum += intervals[i];
    }
    const avg = sum / intervals.length;
    
    // Look for significant variations
    const variations = intervals.map(rr => {
      const diff = rr - avg;
      return diff >= 0 ? diff / avg : -diff / avg;
    });
    
    const maxVariation = Math.max(...variations);
    
    // Detect arrhythmia based on variation
    if (maxVariation > 0.2) {
      // High variation could indicate arrhythmia
      const status: ArrhythmiaStatus = maxVariation > 0.4 ? 'possible-afib' : 'possible-arrhythmia';
      
      this.updateStatus(status, maxVariation, { 
        intervals, 
        variation: maxVariation,
        avgRR: avg
      });
    } else if (avg < 600) {
      // Tachycardia
      this.updateStatus('tachycardia', 0.8, { intervals, avgRR: avg });
    } else if (avg > 1000) {
      // Bradycardia
      this.updateStatus('bradycardia', 0.7, { intervals, avgRR: avg });
    } else {
      // Normal rhythm
      this.updateStatus('normal', 0, { intervals });
    }
  }
  
  /**
   * Process a single RR interval
   */
  public processRRInterval(rrInterval: number, signalQuality: number = 100): ArrhythmiaDetectionResult {
    // Add to the buffer
    if (rrInterval > 300 && rrInterval < 2000) {
      this.lastRRIntervals.push(rrInterval);
      
      // Keep buffer size reasonable
      if (this.lastRRIntervals.length > 10) {
        this.lastRRIntervals = this.lastRRIntervals.slice(-10);
      }
    }
    
    // Process if we have enough intervals
    if (this.lastRRIntervals.length >= 3) {
      this.analyzeRRIntervals(this.lastRRIntervals);
    }
    
    // Return current status
    const { status, statusMessage, lastArrhythmiaData } = this.getArrhythmiaStatus();
    
    return {
      timestamp: Date.now(),
      status,
      probability: this.isArrhythmia() ? 0.7 : 0,
      signalQuality,
      details: lastArrhythmiaData || {},
      latestIntervals: [...this.lastRRIntervals],
      category: this.isArrhythmia() ? 'abnormal' : 'normal'
    };
  }
  
  /**
   * Process PPG segment for arrhythmia detection 
   */
  public async processPPGSegment(
    ppgSegment: number[], 
    signalQuality: number = 100
  ): Promise<ArrhythmiaDetectionResult> {
    // For now, this is a placeholder for a more advanced analysis
    // In the future, we could implement a more sophisticated algorithm or neural network
    
    // Return current status (use some data from RR intervals if available)
    return this.processRRInterval(
      this.lastRRIntervals.length > 0 ? this.lastRRIntervals[this.lastRRIntervals.length - 1] : 800,
      signalQuality
    );
  }
  
  /**
   * Detect arrhythmia from RR intervals
   */
  public detectArrhythmia(rrIntervals: number[]): {
    isArrhythmia: boolean;
    category: string;
  } {
    if (!rrIntervals || rrIntervals.length < 3) {
      return { isArrhythmia: false, category: 'normal' };
    }

    // Calculate variation
    let sum = 0;
    for (let i = 0; i < rrIntervals.length; i++) {
      sum += rrIntervals[i];
    }
    const avg = sum / rrIntervals.length;
    
    // Calculate variance
    let variance = 0;
    for (let i = 0; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - avg;
      variance += diff * diff;
    }
    variance /= rrIntervals.length;
    
    // Detect arrhythmia based on variance
    const isArrhythmia = variance > 10000; // Threshold for arrhythmia
    const category = categorizeArrhythmia(rrIntervals);

    return { isArrhythmia, category };
  }
  
  /**
   * Get all arrhythmia windows
   */
  public getArrhythmiaWindows() {
    return this.windowManager.getArrhythmiaWindows();
  }
  
  /**
   * Add an arrhythmia listener
   */
  public addArrhythmiaListener(listener: (status: ArrhythmiaStatus) => void): void {
    this.arrhythmiaListeners.push(listener);
  }
  
  /**
   * Remove an arrhythmia listener
   */
  public removeArrhythmiaListener(listener: (status: ArrhythmiaStatus) => void): void {
    this.arrhythmiaListeners = this.arrhythmiaListeners.filter(l => l !== listener);
  }
  
  /**
   * Add a detailed detection listener
   */
  public addListener(listener: ArrhythmiaListener): void {
    this.detectionListeners.push(listener);
  }
  
  /**
   * Remove a detailed detection listener
   */
  public removeListener(listener: ArrhythmiaListener): void {
    this.detectionListeners = this.detectionListeners.filter(l => l !== listener);
  }
  
  /**
   * Set user profile for personalized analysis
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    console.log('ArrhythmiaDetectionService: User profile updated', profile);
  }
  
  /**
   * Get the arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Clear all arrhythmia data
   */
  public clear(): void {
    this.currentStatus = 'normal';
    this.windowManager.clear();
  }

  /**
   * Reset the service to initial state
   */
  public reset(): void {
    this.currentStatus = 'normal';
    this.arrhythmiaCount = 0;
    this.lastRRIntervals = [];
    this.lastArrhythmiaData = null;
    this.windowManager.clear();
    console.log('ArrhythmiaDetectionService: Reset complete');
  }
  
  /**
   * Notify all status listeners
   */
  private notifyListeners(): void {
    this.arrhythmiaListeners.forEach(listener => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('Error in arrhythmia listener', error);
      }
    });
  }

  /**
   * Notify all detection listeners
   */
  private notifyDetectionListeners(result: ArrhythmiaDetectionResult): void {
    this.detectionListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in arrhythmia detection listener', error);
      }
    });
  }
}

export default ArrhythmiaDetectionService.getInstance();
