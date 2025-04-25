/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
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
  category?: 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';
}

export interface ArrhythmiaStatus {
  arrhythmiaCount: number;
  statusMessage: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: string;
  } | null;
}

interface UserProfile {
  age?: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private userProfile: UserProfile = {};
  
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
  private lastArrhythmiaData: ArrhythmiaStatus['lastArrhythmiaData'] = null;
  
  // Arrhythmia detection constants
  private readonly DETECTION_THRESHOLD: number = 0.28; // Increased from 0.25 to 0.28
  private readonly MIN_INTERVAL: number = 300; // 300ms minimum (200 BPM max)
  private readonly MAX_INTERVAL: number = 2000; // 2000ms maximum (30 BPM min)
  private MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 10000; // Increased from 8000 to 10000ms
  private RR_VARIATION_THRESHOLD = 0.17;
  
  // False positive prevention
  private falsePositiveCounter: number = 0;
  private readonly MAX_FALSE_POSITIVES: number = 3;
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 3; // Increased from 2 to 3 para mayor exigencia
  private readonly CONFIRMATION_WINDOW_MS: number = 12000; // Increased from 10000 to 12000
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupAutomaticCleanup();
    this.adjustThresholdsForProfile();
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
   * Update user profile and adjust thresholds accordingly
   */
  public updateUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.adjustThresholdsForProfile();
  }

  private adjustThresholdsForProfile(): void {
    const { age, condition } = this.userProfile;

    // Adjust RR variation threshold based on age
    if (age && age > 60) {
      this.RR_VARIATION_THRESHOLD *= 0.85;
    }

    // Adjust for athletic or medical conditions
    if (condition === 'athlete') {
      this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL *= 1.2;
    } else if (condition === 'hypertension' || condition === 'diabetes') {
      this.RR_VARIATION_THRESHOLD *= 0.9;
    }
  }

  /**
   * Categorize arrhythmia based on RR intervals
   */
  private categorizeArrhythmia(intervals: number[]): ArrhythmiaDetectionResult['category'] {
    if (intervals.length < 3) return 'possible-arrhythmia';

    const lastRR = intervals[intervals.length - 1];
    if (lastRR < 500) return 'tachycardia';
    if (lastRR > 1200) return 'bradycardia';

    // Detect bigeminy pattern
    let hasBigeminyPattern = true;
    for (let i = 1; i < intervals.length - 1; i += 2) {
      const evenRR = intervals[i];
      const oddRR = intervals[i - 1];
      if (Math.abs(evenRR - oddRR) / oddRR < 0.4) {
        hasBigeminyPattern = false;
        break;
      }
    }
    if (hasBigeminyPattern) return 'bigeminy';

    return 'possible-arrhythmia';
  }

  /**
   * Detect arrhythmia based on RR interval variations
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    // Protección contra llamadas frecuentes - previene detecciones falsas por ruido
    if (currentTime - this.lastDetectionTime < 250) { // Increased from 200 to 250ms
      return {
        isArrhythmia: this.currentBeatIsArrhythmia,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    this.lastDetectionTime = currentTime;
    
    // Requiere al menos 5 intervalos para un análisis confiable
    if (rrIntervals.length < 5) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
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
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(validIntervals);
    
    // Calculate variation ratio (normalized variability)
    const variationRatio = calculateRRVariation(validIntervals);
    
    // Adjust threshold based on stability
    let thresholdFactor = this.DETECTION_THRESHOLD;
    if (this.stabilityCounter > 15) {
      thresholdFactor = 0.23; // Increased from 0.20 to 0.23
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = 0.33; // Increased from 0.30 to 0.33
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
    const potentialArrhythmia = isIrregular && this.stabilityCounter < 18; // Changed from 20 to 18
    
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
      isArrhythmia: this.currentBeatIsArrhythmia,
      category: this.categorizeArrhythmia(validIntervals)
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
    
    const category = this.categorizeArrhythmia(intervals);
    
    this.lastArrhythmiaData = {
      timestamp: currentTime,
      rmssd,
      rrVariation: variationRatio,
      category
    };

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
    
    // Show more detailed toast based on category
    if (shouldShowToast) {
      const message = category === 'tachycardia' ? 'Ritmo cardíaco elevado detectado' :
                     category === 'bradycardia' ? 'Ritmo cardíaco bajo detectado' :
                     category === 'bigeminy' ? 'Patrón de arritmia bigeminal detectado' :
                     'Posible arritmia detectada';
                     
      toast({
        title: '¡Atención!',
        description: message,
        variant: 'destructive',
        duration: 6000
      });
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
      rrVariation: calculateRRVariation(this.lastRRIntervals.slice(-5)),
      category: this.categorizeArrhythmia(this.lastRRIntervals.slice(-5))
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
    this.lastArrhythmiaData = null;
    
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
