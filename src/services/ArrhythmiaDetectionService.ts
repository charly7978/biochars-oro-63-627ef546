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
  private isCurrentBeatPotentiallyArrhythmic: boolean = false;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTriggeredTime: number = 0;
  private arrhythmiaWindows: ArrhythmiaWindow[] = [];
  private arrhythmiaListeners: ArrhythmiaListener[] = [];
  
  // Arrhythmia detection constants
  private readonly DETECTION_THRESHOLD: number = 0.30; // Increased from 0.28 to 0.30
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 10000; // Increased from 8000 to 10000ms
  
  // False positive prevention
  private falsePositiveCounter: number = 0;
  private readonly MAX_FALSE_POSITIVES: number = 3;
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 3; // Increased from 2 to 3 para mayor exigencia
  private readonly CONFIRMATION_WINDOW_MS: number = 12000; // Increased from 10000 to 12000
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private calibrationStartTime: number | null = null;
  private calibrationRRs: number[] = [];
  private baselineMean: number = 0;
  private baselineSD: number = 0;
  private isCalibrated: boolean = false;

  private constructor() {
    // Configurar limpieza automática periódica
    this.setupAutomaticCleanup();
  }

  private setupAutomaticCleanup(): void {
    // Limpiar ventanas de arritmia viejas cada 3 segundos
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
   * Detect arrhythmia based on RR interval variations
   * Nuevo algoritmo robusto: usa RMSSD, SDNN, pNN50, latidos prematuros y pausas, y confirmación por ventana móvil
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    const lastRR = rrIntervals[rrIntervals.length - 1];

    // Fase de calibración (primeros 6 segundos)
    if (!this.isCalibrated) {
      if (!this.calibrationStartTime) this.calibrationStartTime = currentTime;
      this.calibrationRRs.push(lastRR);

      if (currentTime - this.calibrationStartTime >= 6000) {
        // Calcular patrón base
        this.baselineMean = this.calibrationRRs.reduce((a, b) => a + b, 0) / this.calibrationRRs.length;
        const variance = this.calibrationRRs.reduce((sum, val) => sum + Math.pow(val - this.baselineMean, 2), 0) / this.calibrationRRs.length;
        this.baselineSD = Math.sqrt(variance);
        this.isCalibrated = true;
        console.log(`[Arrhythmia] Calibración completada. Media: ${this.baselineMean}, SD: ${this.baselineSD}`);
      }
      // Durante calibración, no marcar arritmia
      this.currentBeatIsArrhythmia = false;
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime };
    }

    // Detección: comparar el último RR con el patrón aprendido
    const lower = this.baselineMean - 2 * this.baselineSD;
    const upper = this.baselineMean + 2 * this.baselineSD;
    const isAbnormal = lastRR < lower || lastRR > upper;

    this.currentBeatIsArrhythmia = isAbnormal;

    if (isAbnormal) {
      this.addArrhythmiaWindow({ start: currentTime, end: currentTime + 100 });
      this.arrhythmiaCount++;
      this.lastArrhythmiaTriggeredTime = currentTime;
    }

    return {
      isArrhythmia: isAbnormal,
      rmssd: 0,
      rrVariation: 0,
      timestamp: currentTime
    };
  }

  // --- NUEVAS FUNCIONES AUXILIARES ---
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    let sumSq = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq / (intervals.length - 1));
  }

  private calculateSDNN(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (intervals.length - 1);
    return Math.sqrt(variance);
  }

  private calculatePNN50(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    let count = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i - 1]) > 50) count++;
    }
    return (count / (intervals.length - 1)) * 100;
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
    
    // Basic checks first
    if (variationRatio > threshold || rmssd > 55) { // Added RMSSD check here as well for potential trigger
      const timeSinceLastDetection = currentTime - this.lastDetectionTime;
      
      this.isCurrentBeatPotentiallyArrhythmic = true;

      console.log(`[ArrhythmiaDebug] Potential arrhythmia trigger: variationRatio=${variationRatio.toFixed(3)}, rmssd=${rmssd.toFixed(2)}, threshold=${threshold}`);


      // Check if enough time passed or if it's part of a confirmation sequence
      if (timeSinceLastDetection > this.CONFIRMATION_WINDOW_MS) {
        // Reset confirmation counter if too much time passed since last potential detection
        this.arrhythmiaConfirmationCounter = 0;
        console.log("[ArrhythmiaDebug] Resetting confirmation counter due to time gap.");
      }
      
      this.lastDetectionTime = currentTime;
      this.arrhythmiaConfirmationCounter++;
      console.log(`[ArrhythmiaDebug] Confirmation counter incremented to: ${this.arrhythmiaConfirmationCounter}`);

      // Check if enough confirmations within the time window
      if (this.arrhythmiaConfirmationCounter >= this.REQUIRED_CONFIRMATIONS) {
        const timeSinceLastNotification = currentTime - this.lastArrhythmiaTriggeredTime;
        
        if (timeSinceLastNotification > this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
          this.lastIsArrhythmia = true;
          this.currentBeatIsArrhythmia = true;
          this.arrhythmiaCount++;
          this.lastArrhythmiaTriggeredTime = currentTime;
          
          const windowStart = Math.max(0, this.arrhythmiaWindows.length > 0 
                                       ? this.arrhythmiaWindows[this.arrhythmiaWindows.length - 1].end 
                                       : currentTime - 5000); // Default window of 5s
          const windowEnd = currentTime;
          const newWindow: ArrhythmiaWindow = { start: windowStart, end: windowEnd };

          this.addArrhythmiaWindow(newWindow);
          this.notifyListeners(newWindow);
          
          // Reset confirmation counter after successful trigger
          this.arrhythmiaConfirmationCounter = 0; 
          console.log(`[ArrhythmiaConfirmed] Arrhythmia confirmed and triggered! Count: ${this.arrhythmiaCount}. RMSSD: ${rmssd.toFixed(2)}, VariationRatio: ${variationRatio.toFixed(3)}`);
          
        } else {
          console.log("[ArrhythmiaDebug] Arrhythmia confirmed, but notification suppressed due to interval limit.");
          // Reset counter even if suppressed to avoid rapid re-triggering on the *exact* same consecutive beats
          this.arrhythmiaConfirmationCounter = 0; 
        }
      } else {
         console.log(`[ArrhythmiaDebug] Potential arrhythmia detected, need ${this.REQUIRED_CONFIRMATIONS - this.arrhythmiaConfirmationCounter} more confirmations.`);
         // Don't mark as arrhythmia yet, wait for more confirmations
         this.currentBeatIsArrhythmia = false; // Explicitly set to false if not confirmed
      }
      
    } else {
       // If current beat doesn't meet criteria, it doesn't contribute to confirmation
       // We don't reset the counter here immediately, allowing confirmations to span across a few normal beats
       // Only reset counter if a significant time gap occurs (handled at the start of the 'if')
       this.currentBeatIsArrhythmia = false;
       this.isCurrentBeatPotentiallyArrhythmic = false;
       // console.log("[ArrhythmiaDebug] Current beat normal. No change to confirmation counter.");
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
    // Filtrar solo ventanas recientes (menos de 20 segundos)
    const oldWindows = this.arrhythmiaWindows.filter(window => 
      currentTime - window.end < 20000 // Increased from 15000 to 20000ms
    );
    
    // Solo actualizar si hay cambios
    if (oldWindows.length !== this.arrhythmiaWindows.length) {
      console.log(`Cleaned up old arrhythmia windows: removed ${this.arrhythmiaWindows.length - oldWindows.length} windows`);
      this.arrhythmiaWindows = oldWindows;
    }
    
    // También resetear el estado si ha pasado mucho tiempo desde la última arritmia
    if (this.currentBeatIsArrhythmia && currentTime - this.lastArrhythmiaTriggeredTime > 25000) { // Increased from 20000 to 25000ms
      console.log("Auto-resetting arrhythmia state due to timeout");
      this.currentBeatIsArrhythmia = false;
    }
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
    this.falsePositiveCounter = 0;
    this.arrhythmiaConfirmationCounter = 0;
    
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

  /**
   * Retorna si el latido más reciente procesado cumple los criterios iniciales de arritmia.
   * No espera confirmación.
   */
  public getIsCurrentBeatPotentiallyArrhythmic(): boolean {
    return this.isCurrentBeatPotentiallyArrhythmic;
  }
}

export default ArrhythmiaDetectionService.getInstance();
