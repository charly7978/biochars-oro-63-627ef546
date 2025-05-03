import { ArrhythmiaStatus } from './types';

interface ArrhythmiaWindow {
  timestamp: number;
  duration: number;
  status: ArrhythmiaStatus;
  intervals: number[];
  probability: number;
  details: Record<string, any>;
}

/**
 * Manager for arrhythmia detection windows
 * Tracks when arrhythmias occur and their duration
 */
export class ArrhythmiaWindowManager {
  private windows: ArrhythmiaWindow[] = [];
  private maxWindows: number = 20;

  constructor(maxWindows: number = 20) {
    this.maxWindows = maxWindows;
  }

  /**
   * Add a new arrhythmia window
   */
  public addArrhythmiaWindow(
    timestamp: number,
    duration: number,
    status: ArrhythmiaStatus,
    intervals: number[],
    probability: number,
    details: Record<string, any> = {}
  ): void {
    const window: ArrhythmiaWindow = {
      timestamp,
      duration,
      status,
      intervals: [...intervals],
      probability,
      details
    };

    this.windows.push(window);

    // Keep only the latest windows
    if (this.windows.length > this.maxWindows) {
      this.windows = this.windows.slice(-this.maxWindows);
    }
  }

  /**
   * Get all arrhythmia windows
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return [...this.windows];
  }

  /**
   * Get windows that match a specific status
   */
  public getWindowsByStatus(status: ArrhythmiaStatus): ArrhythmiaWindow[] {
    return this.windows.filter(window => window.status === status);
  }

  /**
   * Get windows from a time range
   */
  public getWindowsInTimeRange(startTime: number, endTime: number): ArrhythmiaWindow[] {
    return this.windows.filter(window => {
      const windowEnd = window.timestamp + window.duration;
      return (window.timestamp >= startTime && window.timestamp <= endTime) ||
             (windowEnd >= startTime && windowEnd <= endTime) ||
             (window.timestamp <= startTime && windowEnd >= endTime);
    });
  }

  /**
   * Clear all windows
   */
  public clear(): void {
    this.windows = [];
  }
}
