
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
  private readonly DETECTION_THRESHOLD: number = 0.25; // Increased from 0.2 to reduce false positives
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 8000; // Increased from 5000 to 8000ms
  
  // False positive prevention
  private falsePositiveCounter: number = 0;
  private readonly MAX_FALSE_POSITIVES: number = 3;
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 2; // Requiere al menos 2 detecciones para confirmar
  private readonly CONFIRMATION_WINDOW_MS: number = 10000; // Ventana de 10 segundos para confirmación
  
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
    const currentTime = Date.now();
    
    // Protección contra llamadas frecuentes - previene detecciones falsas por ruido
    if (currentTime - this.lastDetectionTime < 200) {
      return {
        isArrhythmia: this.currentBeatIsArrhythmia,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    this.lastDetectionTime = currentTime;
    
    // Requiere al menos 5 intervalos para un análisis confiable
    if (rrIntervals.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    // Get the 5 most recent intervals for analysis
    const lastIntervals = rrIntervals.slice(-5);
    
    // Verificar que los intervalos sean fisiológicamente válidos
    const validIntervals = lastIntervals.filter(
      interval => interval >= this.MIN_INTERVAL && interval <= this.MAX_INTERVAL
    );
    
    // Si menos del 80% de los intervalos son válidos, no es confiable
    if (validIntervals.length < lastIntervals.length * 0.8) {
      // Resetear detección para evitar falsos positivos por ruido
      this.stabilityCounter = Math.min(this.stabilityCounter + 1, 30);
      this.currentBeatIsArrhythmia = false;
      
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime
      };
    }
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(validIntervals);
    
    // Calculate variation ratio (normalized variability)
    const variationRatio = calculateRRVariation(validIntervals);
    
    // Adjust threshold based on stability
    let thresholdFactor = this.DETECTION_THRESHOLD;
    if (this.stabilityCounter > 15) {
      thresholdFactor = 0.20; // Increased from 0.15 to reduce false positives
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = 0.30; // Increased from 0.25 to reduce false positives
    }
    
    // Determine if rhythm is irregular
    const isIrregular = variationRatio > thresholdFactor;
    
    // Update stability counter
    if (!isIrregular) {
      this.stabilityCounter = Math.min(30, this.stabilityCounter + 1);
      this.falsePositiveCounter = Math.max(0, this.falsePositiveCounter - 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
    }
    
    // Detection of arrhythmia (real data only)
    const potentialArrhythmia = isIrregular && this.stabilityCounter < 20; // Changed from 25 to 20
    
    // Update HRV data
    this.heartRateVariability.push(variationRatio);
    if (this.heartRateVariability.length > 20) {
      this.heartRateVariability.shift();
    }
    
    // Procesamiento para confirmar arritmia - requiere confirmación múltiple
    let confirmedArrhythmia = false;
    
    if (potentialArrhythmia) {
      // Si es un nuevo evento potencial de arritmia
      if (!this.currentBeatIsArrhythmia) {
        this.arrhythmiaConfirmationCounter++;
        
        // Verificar si hemos acumulado suficientes confirmaciones
        if (this.arrhythmiaConfirmationCounter >= this.REQUIRED_CONFIRMATIONS) {
          confirmedArrhythmia = true;
          this.arrhythmiaConfirmationCounter = 0;
        } else {
          // Todavía no confirmada, pero seguimos registrando
          console.log(`Potential arrhythmia detected, confirmation ${this.arrhythmiaConfirmationCounter}/${this.REQUIRED_CONFIRMATIONS}`);
        }
      }
    } else {
      // Si ha pasado mucho tiempo sin confirmación, resetear contador
      if (currentTime - this.lastArrhythmiaTriggeredTime > this.CONFIRMATION_WINDOW_MS) {
        this.arrhythmiaConfirmationCounter = 0;
      }
    }
    
    // Actualizar estado de arritmia
    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    
    // Solo actualizar a true si está confirmada
    if (confirmedArrhythmia) {
      this.currentBeatIsArrhythmia = true;
      this.handleArrhythmiaDetection(validIntervals, rmssd, variationRatio, thresholdFactor);
    } else if (!potentialArrhythmia) {
      // Resetear solo si no hay potencial arritmia
      this.currentBeatIsArrhythmia = false;
    }
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: currentTime,
      isArrhythmia: this.currentBeatIsArrhythmia
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
    
    // Ventana más corta para reducir falsos positivos
    const windowWidth = Math.max(800, Math.min(1200, avgInterval * 2.5));
    
    const arrhythmiaWindow = {
      start: currentTime - windowWidth/2,
      end: currentTime + windowWidth/2
    };
    
    // Add window to collection
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
    this.arrhythmiaWindows = this.arrhythmiaWindows.filter(window => 
      currentTime - window.end < 15000 // Keep only windows from the last 15 seconds
    );
    
    // También resetear el estado si ha pasado mucho tiempo desde la última arritmia
    if (this.currentBeatIsArrhythmia && currentTime - this.lastArrhythmiaTriggeredTime > 20000) {
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
