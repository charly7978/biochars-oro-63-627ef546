/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaWindow } from '@/types/arrhythmia';
import { calculateRMSSD, calculateRRVariation, calculateSDNN } from '@/modules/vital-signs/arrhythmia/calculations';
import { toast } from "@/hooks/use-toast";
import AudioFeedbackService from '../AudioFeedbackService';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import { 
  ArrhythmiaDetectionResult, 
  ArrhythmiaStatus, 
  UserProfile,
  ArrhythmiaListener
} from './types';
import { 
  DEFAULT_THRESHOLDS, 
  PROFILE_ADJUSTMENTS 
} from './constants';
import { categorizeArrhythmia } from './utils';
import { HeartBeatConfig } from '@/modules/heart-beat/config';

/**
 * Service for detecting arrhythmias from heart rate data
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private userProfile: UserProfile = {};
  
  // Window manager - exportado como público para unificar la visualización
  public windowManager = new ArrhythmiaWindowManager();
  
  // Detection state
  private lastRRIntervals: number[] = [];
  private lastIsArrhythmia: boolean = false;
  private currentBeatIsArrhythmia: boolean = false;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTriggeredTime: number = 0;
  private lastArrhythmiaData: ArrhythmiaStatus['lastArrhythmiaData'] = null;
  
  // Arrhythmia detection thresholds - adjusted to reduce false positives
  private RMSSD_THRESHOLD: number = DEFAULT_THRESHOLDS.RMSSD_THRESHOLD;
  private MIN_INTERVAL: number = DEFAULT_THRESHOLDS.MIN_INTERVAL;
  private MAX_INTERVAL: number = DEFAULT_THRESHOLDS.MAX_INTERVAL;
  private MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = DEFAULT_THRESHOLDS.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL;
  private RR_VARIATION_THRESHOLD: number = DEFAULT_THRESHOLDS.RR_VARIATION_THRESHOLD;
  
  // False positive prevention - adjusted to require more evidence
  private lastDetectionTime: number = 0;
  private arrhythmiaConfirmationCounter: number = 0;
  private REQUIRED_CONFIRMATIONS: number = 1;
  private CONFIRMATION_WINDOW_MS: number = 10000;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Añadir constantes para reglas de fallback
  private readonly RULE_RMSSD_HIGH = 100;
  private readonly RULE_RMSSD_LOW = 15;
  private readonly RULE_CV_HIGH = 0.20;

  private constructor() {
    this.setupAutomaticCleanup();
    this.adjustThresholdsForProfile();
  }

  private setupAutomaticCleanup(): void {
    // Clean up old arrhythmia windows every 3 seconds
    this.cleanupInterval = setInterval(() => {
      this.windowManager.cleanupOldWindows();
      
      // Also reset the arrhythmia state if it has been a while since the last trigger
      if (this.currentBeatIsArrhythmia && 
          Date.now() - this.lastArrhythmiaTriggeredTime > 25000) {
        console.log("Auto-resetting arrhythmia state due to timeout");
        this.currentBeatIsArrhythmia = false;
      }
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
    this.windowManager.addArrhythmiaListener(listener);
  }

  /**
   * Remove arrhythmia listener
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.windowManager.removeArrhythmiaListener(listener);
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

    // Reset to defaults first
    this.RMSSD_THRESHOLD = DEFAULT_THRESHOLDS.RMSSD_THRESHOLD;
    this.RR_VARIATION_THRESHOLD = DEFAULT_THRESHOLDS.RR_VARIATION_THRESHOLD;
    this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = DEFAULT_THRESHOLDS.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL;

    // Adjust RR variation threshold based on age
    if (age && age > PROFILE_ADJUSTMENTS.AGE_THRESHOLD) {
      this.RR_VARIATION_THRESHOLD *= PROFILE_ADJUSTMENTS.AGE_FACTOR;
    }

    // Adjust for athletic or medical conditions
    if (condition === 'athlete') {
      this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL *= PROFILE_ADJUSTMENTS.ATHLETE_FACTOR;
    } else if (condition === 'hypertension' || condition === 'diabetes') {
      this.RR_VARIATION_THRESHOLD *= PROFILE_ADJUSTMENTS.MEDICAL_CONDITION_FACTOR;
    }
  }

  /**
   * Detect arrhythmia based on RR interval variations (simplified using RMSSD)
   * Only uses real data - no simulation
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    // Protection against frequent calls - prevents false detections from noise
    if (currentTime - this.lastDetectionTime < 350) {
      return {
        isArrhythmia: this.currentBeatIsArrhythmia,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    this.lastDetectionTime = currentTime;
    
    // Requires at least 6 intervals for reliable analysis
    if (rrIntervals.length < 6) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: currentTime,
        category: 'normal'
      };
    }
    
    // Get the intervals for analysis
    const intervalsForAnalysis = rrIntervals.slice(-15);
    
    // Verify that intervals are physiologically valid
    const validIntervals = intervalsForAnalysis.filter(
      interval => interval >= this.MIN_INTERVAL && interval <= this.MAX_INTERVAL
    );
    
    // If less than 85% of recent intervals are valid, it's not reliable
    if (validIntervals.length < intervalsForAnalysis.length * 0.85 || validIntervals.length < 5) {
      // Reset confirmation counter if signal isn't reliable
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
    
    this.lastRRIntervals = validIntervals;
    
    // --- Use Rule-Based Detection --- 
    const [potential, confidence, category] = this.detectArrhythmiaRuleBased(validIntervals);
    this.handleDetectionResult(potential, confidence, category, validIntervals);
    const { rmssd, rrVariation } = this.calculateBaseMetrics(validIntervals);
    
    return { 
      isArrhythmia: this.currentBeatIsArrhythmia, 
      rmssd, 
      rrVariation, 
      timestamp: currentTime, 
      category: this.lastArrhythmiaData?.category || 'normal' 
    };
  }
  
  /**
   * Handle arrhythmia detection and create visualization window
   */
  private handleArrhythmiaDetection(
    intervals: number[], 
    rmssd: number, 
    variationRatio: number, 
    threshold: number,
    category: ArrhythmiaDetectionResult['category']
  ): void {
    const currentTime = Date.now();
    
    // Check time since last arrhythmia to avoid multiple alerts
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      console.log("Confirmed arrhythmia event ignored, too soon after last trigger.");
      return; // Too soon, ignore
    }
    
    // Log detection for debugging
    console.log(`CONFIRMED Non-Tachycardia Arrhythmia (${category}):`, {
      rmssd,
      variationRatio,
      threshold,
      timestamp: new Date(currentTime).toISOString()
    });
    
    this.lastArrhythmiaData = {
      timestamp: currentTime,
      rmssd,
      rrVariation: variationRatio,
      category
    };

    // Create an arrhythmia window
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Larger window to ensure visualization
    const windowWidth = Math.max(1000, Math.min(1800, avgInterval * 2.5));
    
    const arrhythmiaWindow = {
      start: currentTime - windowWidth/2,
      end: currentTime + windowWidth/2
    };
    
    // Add window to collection and broadcast to listeners
    this.windowManager.addArrhythmiaWindow(arrhythmiaWindow);
    
    // Update counters
    this.arrhythmiaCount++;
    this.lastArrhythmiaTriggeredTime = currentTime;
    
    // Trigger special feedback for arrhythmia
    AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');
    
    // Limit number of notifications
    const shouldShowToast = this.arrhythmiaCount <= 3 || this.arrhythmiaCount % 3 === 0;
    
    // Show more detailed toast based on category
    if (shouldShowToast) {
      const message = category === 'bradycardia' ? 'Ritmo cardíaco bajo detectado' :
                     category === 'bigeminy' ? 'Patrón de arritmia bigeminal detectado' :
                     'Posible arritmia detectada'; // Generic message for 'possible-arrhythmia'
                     
      toast({
        title: '¡Atención!',
        description: message,
        variant: 'destructive',
        duration: 6000
      });
    }
  }
  
  /**
   * Get current arrhythmia status and data
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    const statusMessage = this.arrhythmiaCount > 0 
      ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
      : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Renamed to avoid conflict
    const currentCalculatedCategory: ArrhythmiaDetectionResult['category'] = 
        this.lastRRIntervals.length > 5 ? categorizeArrhythmia(this.lastRRIntervals.slice(-5)) : 'normal';
    const categoryFromLastData = this.lastArrhythmiaData?.category as ArrhythmiaDetectionResult['category'] | undefined;
    // Use the renamed variable
    const lastDataCategory = categoryFromLastData || currentCalculatedCategory;

    const lastData = this.currentBeatIsArrhythmia ? {
      timestamp: Date.now(),
      rmssd: calculateRMSSD(this.lastRRIntervals.slice(-5)),
      rrVariation: calculateRRVariation(this.lastRRIntervals.slice(-5)),
      category: lastDataCategory // Assign validated category
    } : null;
    
    return {
      arrhythmiaCount: this.arrhythmiaCount,
      statusMessage,
      lastArrhythmiaData: lastData // Type should now match ArrhythmiaStatus definition
    };
  }
  
  /**
   * Get all current arrhythmia windows
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    return this.windowManager.getArrhythmiaWindows();
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
    this.lastRRIntervals = [];
    this.lastIsArrhythmia = false;
    this.currentBeatIsArrhythmia = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTriggeredTime = 0;
    this.arrhythmiaConfirmationCounter = 0;
    this.lastArrhythmiaData = null;
    this.windowManager.reset();
    
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

  private calculateBaseMetrics(intervals: number[]): { rmssd: number, rrVariation: number, sdnn: number, meanRR: number } {
    const rmssd = calculateRMSSD(intervals);
    const rrVariation = calculateRRVariation(intervals);
    const sdnn = calculateSDNN(intervals);
    const meanRR = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    return { rmssd, rrVariation, sdnn, meanRR };
  }
  
  private detectArrhythmiaRuleBased(validIntervals: number[]): [boolean, number, ArrhythmiaDetectionResult['category']] { 
      const { rmssd, sdnn, meanRR } = this.calculateBaseMetrics(validIntervals);
      const cv = meanRR > 0 ? sdnn / meanRR : 0;
      
      // Use categorizeArrhythmia from utils
      let category: ArrhythmiaDetectionResult['category'] = categorizeArrhythmia(validIntervals);
      let potentialArrhythmia = category !== 'normal';
      let confidence = 0.3; 

      // Adjust confidence based on category
      if (potentialArrhythmia) {
        switch(category) {
            case 'bradycardia': case 'tachycardia':
                confidence = Math.max(confidence, 0.35); break;
            case 'bigeminy': 
                 confidence = Math.max(confidence, 0.5); break;
            case 'possible-arrhythmia': 
                 confidence = Math.max(confidence, 0.45); break;
        }
      }
      // Override based on HRV metrics
      if (rmssd > this.RULE_RMSSD_HIGH || rmssd < this.RULE_RMSSD_LOW || cv > this.RULE_CV_HIGH) {
          potentialArrhythmia = true;
          if (category === 'normal') category = 'possible-arrhythmia';
          confidence = Math.max(confidence, 0.4); 
      }
      
      return [potentialArrhythmia, confidence, category];
  }

  private handleDetectionResult(
    potential: boolean,
    confidence: number,
    category: ArrhythmiaDetectionResult['category'],
    intervals: number[]
  ): void {
    if (potential) {
      this.currentBeatIsArrhythmia = true;
      this.handleArrhythmiaDetection(intervals, calculateRMSSD(intervals), calculateRRVariation(intervals), this.RMSSD_THRESHOLD, category);
    } else {
      this.currentBeatIsArrhythmia = false;
    }
  }
}

// Export the class directly instead of the instance
export { ArrhythmiaDetectionService };
