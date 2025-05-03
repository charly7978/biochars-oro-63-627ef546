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
  ArrhythmiaCategory
} from './types';
import { 
  DEFAULT_THRESHOLDS, 
  PROFILE_ADJUSTMENTS 
} from './constants';
import { categorizeArrhythmia } from './utils';
import { getModel } from '@/core/neural/ModelRegistry';
import { ArrhythmiaNeuralModel } from '@/core/neural/ArrhythmiaModel';
import { HeartBeatConfig } from '@/modules/heart-beat/config';

/**
 * Service for detecting arrhythmias from heart rate data
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private userProfile: UserProfile = {};
  
  // Window manager
  private windowManager = new ArrhythmiaWindowManager();
  
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

  private arrhythmiaModel: ArrhythmiaNeuralModel | null = null;

  private constructor() {
    this.setupAutomaticCleanup();
    this.adjustThresholdsForProfile();
    this.loadModel();
  }

  private async loadModel() {
    this.arrhythmiaModel = getModel<ArrhythmiaNeuralModel>('arrhythmia');
    if (this.arrhythmiaModel) {
      await this.arrhythmiaModel.preloadModel();
    }
    if (!this.arrhythmiaModel?.isLoaded()) {
      console.warn("Arrhythmia NN model not available, will use rule-based fallback.");
    }
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
  public addArrhythmiaListener(listener: (window: ArrhythmiaWindow) => void): void {
    this.windowManager.addArrhythmiaListener(listener);
  }

  /**
   * Remove arrhythmia listener
   */
  public removeArrhythmiaListener(listener: (window: ArrhythmiaWindow) => void): void {
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
   * Detect arrhythmia based on RR interval variations.
   * Uses Neural Network if available, otherwise falls back to rule-based detection.
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    if (currentTime - this.lastDetectionTime < 350) {
      return { isArrhythmia: this.currentBeatIsArrhythmia, rmssd: 0, rrVariation: 0, timestamp: currentTime, category: 'normal' };
    }
    this.lastDetectionTime = currentTime;
    
    if (rrIntervals.length < 6) {
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime, category: 'normal' };
    }
    
    const intervalsForAnalysis = rrIntervals.slice(-15);
    const validIntervals = intervalsForAnalysis.filter(i => i >= this.MIN_INTERVAL && i <= this.MAX_INTERVAL);
    
    if (validIntervals.length < intervalsForAnalysis.length * 0.85 || validIntervals.length < 5) {
      this.resetConfirmationState();
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime, category: 'normal' };
    }
    
    this.lastRRIntervals = validIntervals;
    
    if (this.arrhythmiaModel?.isLoaded()) {
      this.arrhythmiaModel.processSignal(validIntervals).then(modelResult => {
        if (!modelResult.error) {
          this.handleDetectionResult(modelResult.isArrhythmia, modelResult.confidence, modelResult.category, validIntervals);
        } else {
          console.warn("Arrhythmia model prediction failed, using fallback.");
          const [potential, confidence, category] = this.detectArrhythmiaRuleBased(validIntervals);
          this.handleDetectionResult(potential, confidence, category, validIntervals);
        }
      }).catch(err => {
        console.error("Error processing signal with Arrhythmia model:", err);
        const [potential, confidence, category] = this.detectArrhythmiaRuleBased(validIntervals);
        this.handleDetectionResult(potential, confidence, category, validIntervals);
      });
      
      const { rmssd, rrVariation } = this.calculateBaseMetrics(validIntervals);
      return { 
        isArrhythmia: this.currentBeatIsArrhythmia, 
        rmssd, 
        rrVariation, 
        timestamp: currentTime, 
        category: this.lastArrhythmiaData?.category || 'normal' 
      };
    } else {
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
  }
  
  /**
   * Calculates base HRV metrics used in multiple places.
   */
  private calculateBaseMetrics(intervals: number[]): { rmssd: number, rrVariation: number, sdnn: number, meanRR: number } {
    const rmssd = calculateRMSSD(intervals);
    const rrVariation = calculateRRVariation(intervals); 
    const sdnn = calculateSDNN(intervals);
    const meanRR = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return { rmssd, rrVariation, sdnn, meanRR };
  }
  
  /**
   * Fallback arrhythmia detection logic based on rules (RMSSD, CV).
   */
  private detectArrhythmiaRuleBased(validIntervals: number[]): [boolean, number, ArrhythmiaCategory] { 
    const { rmssd, sdnn, meanRR } = this.calculateBaseMetrics(validIntervals);
    const cv = meanRR > 0 ? sdnn / meanRR : 0;
    
    let potentialArrhythmia = false;
    let confidence = 0.3;
    let category: ArrhythmiaCategory = categorizeArrhythmia(validIntervals) as ArrhythmiaCategory;

    if (category !== 'normal') {
      potentialArrhythmia = true;
      switch(category) {
        case 'bradycardia':
        case 'tachycardia':
          confidence = Math.max(confidence, 0.35);
          break;
        case 'possible-arrhythmia':
          confidence = Math.max(confidence, 0.45);
          break;
        default:
          confidence = 0.3;
      }
    }
    
    return [potentialArrhythmia, confidence, category];
  }
  
  /**
   * Centralized handling of detection results (from NN or rules).
   */
  private handleDetectionResult(
    potentialArrhythmia: boolean,
    confidence: number,
    category: ArrhythmiaDetectionResult['category'] | undefined,
    validIntervalsForContext: number[]
  ): void {
    let confirmedArrhythmia = false;
    const { rmssd, rrVariation } = this.calculateBaseMetrics(validIntervalsForContext);
    
    const currentCategory: ArrhythmiaDetectionResult['category'] = category || 'normal';
    
    if (potentialArrhythmia && confidence > 0.3) {
      if (!this.currentBeatIsArrhythmia) { 
        this.arrhythmiaConfirmationCounter++;
        if (this.arrhythmiaConfirmationCounter >= this.REQUIRED_CONFIRMATIONS) {
          confirmedArrhythmia = true;
        }
      } else {
        confirmedArrhythmia = true; 
      }
    }

    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    let isNowConsideredArrhythmia = false;

    if (confirmedArrhythmia && currentCategory !== 'tachycardia') {
      isNowConsideredArrhythmia = true;
      if (!this.lastIsArrhythmia) {
        this.handleArrhythmiaNotification(rmssd, rrVariation, currentCategory);
      }
    }

    if (!isNowConsideredArrhythmia) {
      this.resetConfirmationState();
    }

    this.currentBeatIsArrhythmia = isNowConsideredArrhythmia;
    if (isNowConsideredArrhythmia) {
      this.lastArrhythmiaData = { 
        timestamp: Date.now(), 
        rmssd, 
        rrVariation, 
        category: currentCategory 
      };
    } else if (this.lastIsArrhythmia) {
      this.lastArrhythmiaData = null;
    }
  }
  
  /**
   * Resets the confirmation counter and state.
   */
  private resetConfirmationState(): void {
    if (this.arrhythmiaConfirmationCounter > 0) {
    }
    this.arrhythmiaConfirmationCounter = 0;
  }

  /**
   * Handle the notification and state update for a confirmed arrhythmia detection.
   */
  private handleArrhythmiaNotification(
    rmssd: number, 
    variationRatio: number, 
    category: ArrhythmiaDetectionResult['category']
  ): void {
    const currentTime = Date.now();
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;

    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      return;
    }
    
    console.log(`CONFIRMED ARRHYTHMIA (${category}):`, {
      rmssd: rmssd.toFixed(1),
      variationRatio: variationRatio.toFixed(2),
      timestamp: new Date(currentTime).toISOString()
    });
    
    const avgInterval = this.lastRRIntervals.reduce((sum, val) => sum + val, 0) / this.lastRRIntervals.length;
    const windowWidth = Math.max(1000, Math.min(1800, avgInterval * 2.5));
    const arrhythmiaWindow = { start: currentTime - windowWidth / 2, end: currentTime + windowWidth / 2 };
    this.windowManager.addArrhythmiaWindow(arrhythmiaWindow);
    
    this.arrhythmiaCount++;
    this.lastArrhythmiaTriggeredTime = currentTime;
    
    const shouldShowToast = this.arrhythmiaCount <= 3 || this.arrhythmiaCount % 3 === 0;
    if (shouldShowToast) {
      const message = `${category}. RMSSD: ${rmssd.toFixed(0)}ms`;
      toast({
        title: '⚠ Posible Arritmia Detectada',
        description: message,
        variant: 'destructive',
        duration: 7000
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
    
    const lastArrhythmiaData = this.currentBeatIsArrhythmia ? {
      timestamp: Date.now(),
      rmssd: calculateRMSSD(this.lastRRIntervals.slice(-5)),
      rrVariation: calculateRRVariation(this.lastRRIntervals.slice(-5)),
      category: categorizeArrhythmia(this.lastRRIntervals.slice(-5)) as ArrhythmiaCategory
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
    this.resetConfirmationState();
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
