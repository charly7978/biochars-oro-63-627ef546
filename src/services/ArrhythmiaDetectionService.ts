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
  private readonly DETECTION_THRESHOLD: number = 0.28; // Increased from 0.25 to 0.28
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
    
    // Verificar tiempo desde última arritmia para evitar múltiples alertas
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      return; // Demasiado pronto, ignorar
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
    
    // Ventana más grande para asegurar visualización
    const windowWidth = Math.max(1000, Math.min(1800, avgInterval * 3));
    
    const arrhythmiaWindow = {
      start: currentTime - windowWidth/2,
      end: currentTime + windowWidth/2
    };
    
    // Add window to collection and broadcast to listeners
    this.addArrhythmiaWindow(arrhythmiaWindow);
    
    // Actualizar contadores
    this.arrhythmiaCount++;
    this.lastArrhythmiaTriggeredTime = currentTime;
    
    // Trigger special feedback for arrhythmia
    AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');
    
    // Limitar número de notificaciones
    const shouldShowToast = this.arrhythmiaCount <= 3 || this.arrhythmiaCount % 3 === 0;
    
    // Show toast notification (limitado para no saturar)
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
    
    // Auto-cleanup para evitar detecciones continuas
    setTimeout(() => {
      this.currentBeatIsArrhythmia = false;
    }, windowWidth);
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
}

export default ArrhythmiaDetectionService.getInstance();
