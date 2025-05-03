
import { ArrhythmiaStatus } from './types';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';

/**
 * Service for detecting and managing arrhythmias
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private windowManager: ArrhythmiaWindowManager;
  private currentStatus: ArrhythmiaStatus = 'normal';
  private arrhythmiaListeners: Array<(status: ArrhythmiaStatus) => void> = [];
  
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
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    return this.currentStatus;
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
   * Clear all arrhythmia data
   */
  public clear(): void {
    this.currentStatus = 'normal';
    this.windowManager.clear();
  }
  
  /**
   * Notify all listeners of the current status
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
}

export default ArrhythmiaDetectionService.getInstance();
