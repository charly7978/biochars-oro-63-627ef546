/**
 * Service for managing arrhythmia detection and notifications
 */
import { ArrhythmiaWindow } from '../hooks/vital-signs/types';

type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

class ArrhythmiaDetectionServiceClass {
  private arrhythmiaWindows: ArrhythmiaWindow[] = [];
  private listeners: ArrhythmiaListener[] = [];
  private lastNotificationTime: number = 0;
  private MIN_NOTIFICATION_INTERVAL = 10000; // 10 seconds between notifications
  
  /**
   * Add a new arrhythmia detection window
   * @param start Start timestamp 
   * @param end End timestamp
   */
  public addArrhythmiaWindow(start: number, end: number): void {
    const newWindow: ArrhythmiaWindow = { start, end };
    this.arrhythmiaWindows.push(newWindow);
    
    // Keep only recent windows (last 3 minutes)
    const now = Date.now();
    const MAX_WINDOW_AGE = 3 * 60 * 1000; // 3 minutes
    
    this.arrhythmiaWindows = this.arrhythmiaWindows.filter(window => 
      now - window.end < MAX_WINDOW_AGE
    );
    
    // Notify listeners
    this.notifyListeners(newWindow);
    
    console.log('ArrhythmiaDetectionService: Added arrhythmia window', {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      totalWindows: this.arrhythmiaWindows.length
    });
  }
  
  /**
   * Check if a timestamp falls within any arrhythmia window
   * @param timestamp The timestamp to check
   */
  public isInArrhythmiaWindow(timestamp: number): boolean {
    return this.arrhythmiaWindows.some(window => 
      timestamp >= window.start && timestamp <= window.end
    );
  }
  
  /**
   * Get all arrhythmia windows
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return [...this.arrhythmiaWindows];
  }
  
  /**
   * Clear all arrhythmia windows
   */
  public clearArrhythmiaWindows(): void {
    this.arrhythmiaWindows = [];
    console.log('ArrhythmiaDetectionService: Cleared all arrhythmia windows');
  }
  
  /**
   * Add a listener for arrhythmia notifications
   * @param listener Function to call when arrhythmia is detected
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove an arrhythmia listener
   * @param listener The listener to remove
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Notify all listeners of a new arrhythmia window
   * @param window The arrhythmia window
   */
  private notifyListeners(window: ArrhythmiaWindow): void {
    const now = Date.now();
    
    // Only notify if enough time has passed since last notification
    if (now - this.lastNotificationTime >= this.MIN_NOTIFICATION_INTERVAL) {
      this.lastNotificationTime = now;
      
      for (const listener of this.listeners) {
        try {
          listener(window);
        } catch (error) {
          console.error('ArrhythmiaDetectionService: Error in listener:', error);
        }
      }
    }
  }
}

// Singleton instance
const ArrhythmiaDetectionService = new ArrhythmiaDetectionServiceClass();

export default ArrhythmiaDetectionService;
