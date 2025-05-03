
import { ArrhythmiaWindow } from './types';

/**
 * Manages arrhythmia windows for visualization purposes
 */
export class ArrhythmiaWindowManager {
  private windows: ArrhythmiaWindow[] = [];
  private readonly MAX_WINDOWS = 10;
  
  /**
   * Add a new arrhythmia window
   * @param window Window time range to add
   */
  public addArrhythmiaWindow(window: ArrhythmiaWindow): void {
    // Add window to the list
    this.windows.push(window);
    
    // Limit to MAX_WINDOWS by removing oldest windows
    if (this.windows.length > this.MAX_WINDOWS) {
      this.windows.shift(); // Remove oldest window
    }
  }
  
  /**
   * Get all arrhythmia windows
   * @returns Array of arrhythmia windows
   */
  public getWindows(): ArrhythmiaWindow[] {
    return [...this.windows]; // Return copy to prevent external modification
  }
  
  /**
   * Clear all windows
   */
  public clearWindows(): void {
    this.windows = [];
  }
  
  /**
   * Check if a timestamp falls within any arrhythmia window
   * @param timestamp Timestamp to check
   * @returns True if timestamp is within any arrhythmia window
   */
  public isInArrhythmiaWindow(timestamp: number): boolean {
    return this.windows.some(window => 
      timestamp >= window.start && timestamp <= window.end
    );
  }
  
  /**
   * Find window containing a timestamp
   * @param timestamp Timestamp to check
   * @returns The window containing the timestamp, or undefined
   */
  public findWindowContaining(timestamp: number): ArrhythmiaWindow | undefined {
    return this.windows.find(window => 
      timestamp >= window.start && timestamp <= window.end
    );
  }
  
  /**
   * Get total duration of all windows
   * @returns Total duration in ms
   */
  public getTotalDuration(): number {
    return this.windows.reduce((total, window) => 
      total + (window.end - window.start), 0
    );
  }
  
  /**
   * Get count of windows
   * @returns Number of windows
   */
  public getWindowCount(): number {
    return this.windows.length;
  }
}
