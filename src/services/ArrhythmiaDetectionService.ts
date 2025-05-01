
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaWindow } from '@/types/arrhythmia';
import { calculateRMSSD, calculateRRVariation } from '@/modules/vital-signs/arrhythmia/calculations';
import AudioFeedbackService from './AudioFeedbackService';
import { toast } from "@/hooks/use-toast";

// Definición del listener para ventanas de arritmia
export type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

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
  private lastRRIntervals: number[] = [];
  private lastIsArrhythmia: boolean = false;
  private currentBeatIsArrhythmia: boolean = false;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTriggeredTime: number = 0;
  private arrhythmiaWindows: ArrhythmiaWindow[] = [];
  private arrhythmiaListeners: ArrhythmiaListener[] = [];
  private lastArrhythmiaData: ArrhythmiaStatus['lastArrhythmiaData'] = null;
  
  // Arrhythmia detection constants - adjusted to reduce false positives
  private readonly RMSSD_THRESHOLD: number = 85; // Aumentado de 70 para mayor especificidad
  private readonly MIN_INTERVAL: number = 300;
  private readonly MAX_INTERVAL: number = 2000;
  private MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 12000; // Aumentado de 10000
  private RR_VARIATION_THRESHOLD = 0.20; // Aumentado de 0.17 para más especificidad
  
  // False positive prevention - adjusted to require more evidence
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private readonly REQUIRED_CONFIRMATIONS: number = 4; // Aumentado de 3
  private readonly CONFIRMATION_WINDOW_MS: number = 14000; // Aumentado de 12000
  
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
      this.RR_VARIATION_THRESHOLD *= 0.82; // Ajustado de 0.85 - más restrictivo para mayores
    }

    // Adjust for athletic or medical conditions
    if (condition === 'athlete') {
      this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL *= 1.3; // Aumentado de 1.2
    } else if (condition === 'hypertension' || condition === 'diabetes') {
      this.RR_VARIATION_THRESHOLD *= 0.85; // Ajustado de 0.9 - más sensible para condiciones médicas
    }
  }

  /**
   * Categorize arrhythmia based on RR intervals
   */
  private categorizeArrhythmia(intervals: number[]): ArrhythmiaDetectionResult['category'] {
    const lastRR = intervals.length > 0 ? intervals[intervals.length - 1] : 0;
    if (lastRR === 0) return 'possible-arrhythmia';
    if (lastRR < 500) return 'tachycardia';
    if (lastRR > 1200) return 'bradycardia';

    // Detect bigeminy pattern
    if (intervals.length >= 3) {
      let hasBigeminyPattern = true;
      for (let i = 1; i < intervals.length - 1; i += 2) {
        const evenRR = intervals[i];
        const oddRR = intervals[i - 1];
        if (oddRR === 0 || realAbs(evenRR - oddRR) / oddRR < 0.4) {
          hasBigeminyPattern = false;
          break;
        }
      }
      if (hasBigeminyPattern) return 'bigeminy';
    }

    return 'possible-arrhythmia';
  }

  /**
   * Detect arrhythmia based on RR interval variations (simplified using RMSSD)
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    // Protección contra llamadas frecuentes - previene detecciones falsas por ruido
    if (currentTime - this.lastDetectionTime < 350) { // Aumentado de 250 para prevenir falsos positivos
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
    if (rrIntervals.length < 6) { // Aumentado de 5 para mayor robustez
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    // Get the intervals for analysis (puede ser más de 5 si queremos RMSSD más estable)
    const intervalsForAnalysis = rrIntervals.slice(-15);
    
    // Verificar que los intervalos sean fisiológicamente válidos
    const validIntervals = intervalsForAnalysis.filter(
      interval => interval >= this.MIN_INTERVAL && interval <= this.MAX_INTERVAL
    );
    
    // Si menos del 85% de los intervalos recientes son válidos, no es confiable
    // (Aumentado de 80% para mayor especificidad)
    if (validIntervals.length < intervalsForAnalysis.length * 0.85 || validIntervals.length < 5) {
      // Resetear contador de confirmación si la señal no es fiable
      this.arrhythmiaConfirmationCounter = 0;
      this.currentBeatIsArrhythmia = false;
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    // Calcular RMSSD (métrica principal ahora)
    const rmssd = calculateRMSSD(validIntervals);
    
    // Detección de arritmia potencial basada en RMSSD
    const potentialArrhythmia = rmssd > this.RMSSD_THRESHOLD;
    
    // Procesamiento para confirmar arritmia
    let confirmedArrhythmia = false;
    let category: ArrhythmiaDetectionResult['category'] = 'normal';
    
    if (potentialArrhythmia) {
      // Si es un nuevo evento potencial y no estábamos en arritmia confirmada previamente
      if (!this.currentBeatIsArrhythmia) { 
        this.arrhythmiaConfirmationCounter++;
        if (this.arrhythmiaConfirmationCounter >= this.REQUIRED_CONFIRMATIONS) {
          confirmedArrhythmia = true;
          // No resetear contador aquí, se resetea abajo si no se confirma arritmia relevante
        } else {
          console.log(`Potential arrhythmia detected (RMSSD=${rmssd.toFixed(1)}), confirmation ${this.arrhythmiaConfirmationCounter}/${this.REQUIRED_CONFIRMATIONS}`);
        }
      }
      // Si ya estábamos en arritmia, potentialArrhythmia sigue siendo true, pero no incrementamos contador ni confirmamos de nuevo.
    } 
    // // Lógica anterior de reset basada en tiempo - Eliminada a favor de resetear si no hay confirmación abajo.
    // else {
    //   if (currentTime - this.lastArrhythmiaTriggeredTime > this.CONFIRMATION_WINDOW_MS) {
    //     this.arrhythmiaConfirmationCounter = 0;
    //   }
    // }

    // Determinar la categoría si hay una arritmia confirmada o potencial
    if (confirmedArrhythmia || potentialArrhythmia) { 
        category = this.categorizeArrhythmia(validIntervals);
    }

    // Guardar estado previo para comparación
    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    let isNowConsideredArrhythmia = false; // Variable local para el estado actual
    
    if (confirmedArrhythmia && category !== 'tachycardia') {
      // Arritmia confirmada y relevante
      isNowConsideredArrhythmia = true;
      const variationRatioForInfo = calculateRRVariation(validIntervals);
      // Llamar a handle solo si es una nueva detección (estado anterior era false)
      if (!this.lastIsArrhythmia) {
          this.handleArrhythmiaDetection(validIntervals, rmssd, variationRatioForInfo, this.RMSSD_THRESHOLD, category);
      }
    } 
    // Si no se confirmó una arritmia relevante este ciclo, el estado vuelve a ser no-arrítmico
    // y reseteamos el contador de confirmación para el próximo evento potencial.
    if (!isNowConsideredArrhythmia) { 
        this.arrhythmiaConfirmationCounter = 0; 
    }
    
    // Actualizar el estado persistente de la clase
    this.currentBeatIsArrhythmia = isNowConsideredArrhythmia;
    
    // Calcular rrVariation para devolverlo, aunque no se use para detección primaria
    const finalRRVariation = calculateRRVariation(validIntervals);

    return {
      rmssd, 
      rrVariation: finalRRVariation, 
      timestamp: currentTime,
      isArrhythmia: this.currentBeatIsArrhythmia, 
      // Devolver categoría correcta incluso si no es una arritmia activa
      category: this.currentBeatIsArrhythmia ? category : (potentialArrhythmia ? category : 'normal') 
    };
  }
  
  /**
   * Handle arrhythmia detection and create visualization window
   * Now receives category directly
   */
  private handleArrhythmiaDetection(
    intervals: number[], 
    rmssd: number, 
    variationRatio: number, 
    threshold: number,
    category: ArrhythmiaDetectionResult['category'] // Recibir categoría
  ): void {
    const currentTime = Date.now();
    
    // Verificar tiempo desde última arritmia para evitar múltiples alertas
    // (Esta lógica se aplica ahora solo a arritmias no-taquicardia)
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      console.log("Confirmed arrhythmia event ignored, too soon after last trigger.");
      return; // Demasiado pronto, ignorar
    }
    
    // Log detection for debugging (ya sabemos que no es taquicardia aquí)
    console.log(`CONFIRMED Non-Tachycardia Arrhythmia (${category}):`, {
      rmssd,
      variationRatio,
      threshold, // Este es RMSSD_THRESHOLD
      timestamp: new Date(currentTime).toISOString()
    });
    
    // const category = this.categorizeArrhythmia(intervals); // Ya la recibimos
    
    this.lastArrhythmiaData = {
      timestamp: currentTime,
      rmssd,
      rrVariation: variationRatio,
      category
    };

    // Create an arrhythmia window
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Ventana más grande para asegurar visualización
    const windowWidth = realMax(1000, realMin(1800, avgInterval * 3));
    
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
      const message = category === 'bradycardia' ? 'Ritmo cardíaco bajo detectado' :
                     category === 'bigeminy' ? 'Patrón de arritmia bigeminal detectado' :
                     'Posible arritmia detectada'; // Mensaje genérico para 'possible-arrhythmia'
                     
      toast({
        title: '¡Atención!',
        description: message,
        variant: 'destructive',
        duration: 6000
      });
    }
  }
  
  /**
   * Add a new arrhythmia window for visualization
   */
  public addArrhythmiaWindow(window: ArrhythmiaWindow): void {
    // Check if there's a similar recent window (within 500ms)
    const currentTime = Date.now();
    const hasRecentWindow = this.arrhythmiaWindows.some(existingWindow => 
      realAbs(existingWindow.start - window.start) < 500 && 
      realAbs(existingWindow.end - window.end) < 500
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
    this.lastRRIntervals = [];
    this.lastIsArrhythmia = false;
    this.currentBeatIsArrhythmia = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTriggeredTime = 0;
    this.arrhythmiaWindows = [];
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

// Utilidades deterministas para reemplazar Math
function realMin(a: number, b: number): number { return a < b ? a : b; }
function realMax(a: number, b: number): number { return a > b ? a : b; }
function realAbs(x: number): number { return x < 0 ? -x : x; }
