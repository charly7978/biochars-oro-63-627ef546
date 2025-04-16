
import { ArrhythmiaWindow } from '../hooks/vital-signs/types';

type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

// Result interface for arrhythmia detection
export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  intensity?: number;
  category?: string;
}

class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private listeners: ArrhythmiaListener[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private isArrhythmiaDetected: boolean = false;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTime: number = 0;

  // Detection thresholds
  private readonly MIN_RR_INTERVALS = 8;
  private readonly MIN_VARIATION_PERCENT = 55;
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 10000;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  public static addArrhythmiaListener(listener: ArrhythmiaListener): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners.push(listener);
  }

  public static removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners = service.listeners.filter(l => l !== listener);
  }

  public static notifyArrhythmia(window: ArrhythmiaWindow): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners.forEach(listener => {
      try {
        listener(window);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }

  // Update RR intervals data
  public static updateRRIntervals(intervals: number[]): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.rrIntervals = intervals;
  }

  // Detect arrhythmia based on RR intervals
  public static detectArrhythmia(intervals: number[]): ArrhythmiaDetectionResult {
    const service = ArrhythmiaDetectionService.getInstance();
    
    if (intervals.length < service.MIN_RR_INTERVALS) {
      return { isArrhythmia: false };
    }

    // Calculate average RR interval
    const avgRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Check last few intervals for variations
    const recentIntervals = intervals.slice(-3);
    let hasSignificantVariation = false;
    
    for (const interval of recentIntervals) {
      const variation = Math.abs(interval - avgRR) / avgRR * 100;
      if (variation > service.MIN_VARIATION_PERCENT) {
        hasSignificantVariation = true;
        break;
      }
    }
    
    // Update arrhythmia status
    const currentTime = Date.now();
    const timeSinceLastArrhythmia = currentTime - service.lastArrhythmiaTime;
    
    if (hasSignificantVariation && timeSinceLastArrhythmia > service.MIN_ARRHYTHMIA_INTERVAL_MS) {
      service.isArrhythmiaDetected = true;
      service.arrhythmiaCount++;
      service.lastArrhythmiaTime = currentTime;
      
      // Notify listeners
      const window: ArrhythmiaWindow = {
        start: currentTime - 5000,
        end: currentTime,
        intensity: 0.8,
        category: 'Irregular Rhythm'
      };
      
      ArrhythmiaDetectionService.notifyArrhythmia(window);
      
      console.log("ArrhythmiaDetectionService: Arrhythmia detected", {
        count: service.arrhythmiaCount,
        time: new Date(currentTime).toISOString()
      });
    } else if (timeSinceLastArrhythmia > service.MIN_ARRHYTHMIA_INTERVAL_MS * 1.5) {
      // Reset arrhythmia detection after some time
      service.isArrhythmiaDetected = false;
    }
    
    return {
      isArrhythmia: service.isArrhythmiaDetected,
      intensity: service.isArrhythmiaDetected ? 0.8 : 0,
      category: service.isArrhythmiaDetected ? 'Irregular Rhythm' : undefined
    };
  }

  // Check if currently in arrhythmia state
  public static isArrhythmia(): boolean {
    const service = ArrhythmiaDetectionService.getInstance();
    return service.isArrhythmiaDetected;
  }

  // Get current arrhythmia count
  public static getArrhythmiaCount(): number {
    const service = ArrhythmiaDetectionService.getInstance();
    return service.arrhythmiaCount;
  }

  // Reset the service state
  public static reset(): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.rrIntervals = [];
    service.lastPeakTime = null;
    service.isArrhythmiaDetected = false;
    service.lastArrhythmiaTime = 0;
    console.log("ArrhythmiaDetectionService: Reset");
  }

  // Clean up resources
  public static cleanUp(): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners = [];
    service.rrIntervals = [];
    service.lastPeakTime = null;
    service.isArrhythmiaDetected = false;
    service.arrhythmiaCount = 0;
    service.lastArrhythmiaTime = 0;
    console.log("ArrhythmiaDetectionService: Cleaned up");
  }
}

export default ArrhythmiaDetectionService;
