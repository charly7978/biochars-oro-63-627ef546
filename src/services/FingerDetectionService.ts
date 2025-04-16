
import { BehaviorSubject, Observable } from 'rxjs';
import AudioFeedbackService from './AudioFeedbackService';

interface FingerDetectionState {
  isFingerDetected: boolean;
  detectionQuality: number;
  consecutiveFrames: number;
  lastUpdateTime: number;
}

class FingerDetectionService {
  private static instance: FingerDetectionService;
  private readonly REQUIRED_FRAMES = 3;
  private readonly QUALITY_HISTORY_SIZE = 9;

  private state: FingerDetectionState = {
    isFingerDetected: false,
    detectionQuality: 0,
    consecutiveFrames: 0,
    lastUpdateTime: 0
  };

  private stateSubject = new BehaviorSubject<FingerDetectionState>(this.state);
  private qualityHistory: number[] = [];

  private constructor() {
    // Private constructor for singleton
    console.log("FingerDetectionService: Service initialized");
  }

  public static getInstance(): FingerDetectionService {
    if (!FingerDetectionService.instance) {
      FingerDetectionService.instance = new FingerDetectionService();
    }
    return FingerDetectionService.instance;
  }

  public getStateObservable(): Observable<FingerDetectionState> {
    return this.stateSubject.asObservable();
  }

  public getCurrentState(): FingerDetectionState {
    return { ...this.state };
  }

  public updateDetection(isDetected: boolean, quality: number): void {
    const now = Date.now();
    
    // Update quality history
    this.updateQualityHistory(quality);
    
    // Update consecutive frames counter
    if (isDetected) {
      this.state.consecutiveFrames++;
    } else {
      this.state.consecutiveFrames = 0;
    }
    
    // Determine if finger is actually detected based on consecutive frames
    const wasDetected = this.state.isFingerDetected;
    this.state.isFingerDetected = this.state.consecutiveFrames >= this.REQUIRED_FRAMES;
    
    // Finger detection state change feedback
    if (!wasDetected && this.state.isFingerDetected) {
      this.notifyFingerDetected();
    } else if (wasDetected && !this.state.isFingerDetected) {
      this.notifyFingerLost();
    }
    
    // Update state
    this.state = {
      ...this.state,
      detectionQuality: this.getAverageQuality(),
      lastUpdateTime: now
    };
    
    // Notify subscribers
    this.stateSubject.next(this.state);
  }

  private updateQualityHistory(quality: number): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }

  public getAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    this.qualityHistory.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  public getQualityText(): string {
    const avgQuality = this.getAverageQuality();
    
    if (!this.state.isFingerDetected) return 'Sin detección';
    if (avgQuality > 65) return 'Señal óptima';
    if (avgQuality > 40) return 'Señal aceptable';
    return 'Señal débil';
  }

  public getQualityColor(): string {
    const avgQuality = this.getAverageQuality();
    
    if (!this.state.isFingerDetected) return 'from-gray-400 to-gray-500';
    if (avgQuality > 65) return 'from-green-500 to-emerald-500';
    if (avgQuality > 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }

  private notifyFingerDetected(): void {
    console.log("FingerDetectionService: Finger detected!");
    AudioFeedbackService.playBeep('notification', 0.7);
  }

  private notifyFingerLost(): void {
    console.log("FingerDetectionService: Finger lost!");
  }

  public reset(): void {
    this.qualityHistory = [];
    this.state = {
      isFingerDetected: false,
      detectionQuality: 0,
      consecutiveFrames: 0,
      lastUpdateTime: 0
    };
    this.stateSubject.next(this.state);
  }
}

export default FingerDetectionService;
