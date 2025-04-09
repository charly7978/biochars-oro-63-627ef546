
/**
 * Intelligent calibration system for vital signs processing
 * Manages calibration state and provides bidirectional feedback
 */

export interface CalibrationFeedback {
  signalQuality: number; // 0-100
  stabilityScore: number; // 0-100
  motionDetected: boolean;
  lightingQuality: number; // 0-100
  recommendations: string[];
  overallStatus: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface CalibrationState {
  isCalibrating: boolean;
  progress: number; // 0-100
  estimatedTimeRemaining: number; // seconds
  feedback: CalibrationFeedback;
}

export interface CalibrationConfig {
  minCalibrationTime: number; // milliseconds
  maxCalibrationTime: number; // milliseconds
  targetSamples: number;
  qualityThreshold: number; // 0-100
  adaptiveMode: boolean;
}

export class CalibrationManager {
  private config: CalibrationConfig;
  private state: CalibrationState;
  private startTime: number = 0;
  private sampleCount: number = 0;
  private qualityHistory: number[] = [];
  private signalHistory: number[] = [];
  private isFirstCalibration: boolean = true;
  private calibrationComplete: boolean = false;
  private onUpdateCallback: ((state: CalibrationState) => void) | null = null;
  
  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = {
      minCalibrationTime: 5000,
      maxCalibrationTime: 15000,
      targetSamples: 150,
      qualityThreshold: 60,
      adaptiveMode: true,
      ...config
    };
    
    this.state = {
      isCalibrating: false,
      progress: 0,
      estimatedTimeRemaining: 0,
      feedback: {
        signalQuality: 0,
        stabilityScore: 0,
        motionDetected: false,
        lightingQuality: 0,
        recommendations: [],
        overallStatus: 'poor'
      }
    };
  }
  
  /**
   * Start the calibration process
   */
  public startCalibration(): void {
    this.state.isCalibrating = true;
    this.startTime = Date.now();
    this.sampleCount = 0;
    this.qualityHistory = [];
    this.signalHistory = [];
    this.calibrationComplete = false;
    
    this.state.progress = 0;
    this.state.estimatedTimeRemaining = this.config.maxCalibrationTime / 1000;
    
    // Reset feedback
    this.state.feedback = {
      signalQuality: 0,
      stabilityScore: 0,
      motionDetected: false,
      lightingQuality: 0,
      recommendations: ['Place your finger firmly on the camera'],
      overallStatus: 'poor'
    };
    
    this.updateCallback();
    
    console.log('Calibration started');
  }
  
  /**
   * Process a signal sample during calibration
   */
  public processSample(value: number, signalQuality: number, auxData?: any): void {
    if (!this.state.isCalibrating) {
      return;
    }
    
    // Update counters
    this.sampleCount++;
    this.qualityHistory.push(signalQuality);
    this.signalHistory.push(value);
    
    // Trim history if too long
    if (this.qualityHistory.length > 30) {
      this.qualityHistory.shift();
    }
    if (this.signalHistory.length > 30) {
      this.signalHistory.shift();
    }
    
    // Calculate signal stability
    const stability = this.calculateStability();
    
    // Detect motion
    const motionDetected = this.detectMotion();
    
    // Assess lighting
    const lightingQuality = this.assessLighting(value);
    
    // Update feedback
    this.state.feedback.signalQuality = this.calculateAverageQuality();
    this.state.feedback.stabilityScore = stability;
    this.state.feedback.motionDetected = motionDetected;
    this.state.feedback.lightingQuality = lightingQuality;
    
    // Generate recommendations
    this.updateRecommendations();
    
    // Update progress
    this.updateProgress();
    
    // Check if calibration should complete
    this.checkCalibrationCompletion();
    
    // Notify callback
    this.updateCallback();
  }
  
  /**
   * Calculate signal stability score
   */
  private calculateStability(): number {
    if (this.signalHistory.length < 10) {
      return 0;
    }
    
    // Calculate standard deviation
    const mean = this.signalHistory.reduce((a, b) => a + b, 0) / this.signalHistory.length;
    const variance = this.signalHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.signalHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to stability score (lower stdDev = higher stability)
    const normalizedStdDev = Math.min(1, stdDev / mean);
    const stabilityScore = 100 * (1 - normalizedStdDev);
    
    return Math.max(0, Math.min(100, stabilityScore));
  }
  
  /**
   * Detect motion based on signal variation
   */
  private detectMotion(): boolean {
    if (this.signalHistory.length < 10) {
      return false;
    }
    
    // Calculate differences between consecutive samples
    const diffs = [];
    for (let i = 1; i < this.signalHistory.length; i++) {
      diffs.push(Math.abs(this.signalHistory[i] - this.signalHistory[i - 1]));
    }
    
    // Calculate average difference
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const maxDiff = Math.max(...diffs);
    
    // Detect sudden large changes
    return maxDiff > avgDiff * 3;
  }
  
  /**
   * Assess lighting quality based on signal value
   */
  private assessLighting(value: number): number {
    // Simplified lighting assessment
    // Too dark: values near 0
    // Too bright: values near 1
    // Ideal: values around 0.3-0.7
    
    if (value < 0.1) {
      return 30; // Too dark
    } else if (value > 0.9) {
      return 40; // Too bright
    } else if (value > 0.3 && value < 0.7) {
      return 90; // Ideal range
    } else {
      return 70; // Acceptable
    }
  }
  
  /**
   * Calculate average signal quality
   */
  private calculateAverageQuality(): number {
    if (this.qualityHistory.length === 0) {
      return 0;
    }
    
    return this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
  }
  
  /**
   * Update user recommendations based on feedback
   */
  private updateRecommendations(): void {
    const recommendations: string[] = [];
    const { signalQuality, stabilityScore, motionDetected, lightingQuality } = this.state.feedback;
    
    if (signalQuality < 40) {
      recommendations.push('Ensure your finger covers the camera lens completely');
    }
    
    if (stabilityScore < 50) {
      recommendations.push('Try to hold your finger more steady');
    }
    
    if (motionDetected) {
      recommendations.push('Avoid moving your finger during measurement');
    }
    
    if (lightingQuality < 50) {
      if (this.signalHistory.length > 0 && this.signalHistory[this.signalHistory.length - 1] < 0.2) {
        recommendations.push('The environment is too dark, try using in a brighter area');
      } else if (this.signalHistory.length > 0 && this.signalHistory[this.signalHistory.length - 1] > 0.8) {
        recommendations.push('Too much light detected, try moving to a less bright area');
      }
    }
    
    // Set overall status
    let overallStatus: 'poor' | 'fair' | 'good' | 'excellent';
    const overallScore = (signalQuality + stabilityScore + lightingQuality) / 3;
    
    if (overallScore < 40) {
      overallStatus = 'poor';
    } else if (overallScore < 60) {
      overallStatus = 'fair';
    } else if (overallScore < 85) {
      overallStatus = 'good';
    } else {
      overallStatus = 'excellent';
    }
    
    this.state.feedback.recommendations = recommendations;
    this.state.feedback.overallStatus = overallStatus;
  }
  
  /**
   * Update calibration progress
   */
  private updateProgress(): void {
    const elapsed = Date.now() - this.startTime;
    const timeProgress = Math.min(100, (elapsed / this.config.maxCalibrationTime) * 100);
    const sampleProgress = Math.min(100, (this.sampleCount / this.config.targetSamples) * 100);
    
    // Use the greater of time or sample progress
    this.state.progress = Math.max(timeProgress, sampleProgress);
    
    // Calculate estimated time remaining
    if (sampleProgress > 0) {
      const estimatedTotalTime = (elapsed / sampleProgress) * 100;
      this.state.estimatedTimeRemaining = Math.max(0, (estimatedTotalTime - elapsed) / 1000);
    } else {
      this.state.estimatedTimeRemaining = (this.config.maxCalibrationTime - elapsed) / 1000;
    }
  }
  
  /**
   * Check if calibration should complete
   */
  private checkCalibrationCompletion(): void {
    if (this.calibrationComplete) {
      return;
    }
    
    const elapsed = Date.now() - this.startTime;
    const averageQuality = this.calculateAverageQuality();
    
    // Criteria for completion:
    // 1. Minimum time elapsed
    // 2. Either max time reached or enough samples with good quality
    
    const minTimeReached = elapsed >= this.config.minCalibrationTime;
    const maxTimeReached = elapsed >= this.config.maxCalibrationTime;
    const enoughQualitySamples = this.sampleCount >= this.config.targetSamples && 
                                averageQuality >= this.config.qualityThreshold;
    
    if (minTimeReached && (maxTimeReached || enoughQualitySamples)) {
      this.completeCalibration();
    }
  }
  
  /**
   * Complete the calibration process
   */
  private completeCalibration(): void {
    this.state.isCalibrating = false;
    this.state.progress = 100;
    this.state.estimatedTimeRemaining = 0;
    this.calibrationComplete = true;
    this.isFirstCalibration = false;
    
    console.log('Calibration completed', {
      averageQuality: this.calculateAverageQuality(),
      samplesCollected: this.sampleCount,
      timeRequired: (Date.now() - this.startTime) / 1000
    });
    
    this.updateCallback();
  }
  
  /**
   * Set callback for state updates
   */
  public setUpdateCallback(callback: (state: CalibrationState) => void): void {
    this.onUpdateCallback = callback;
  }
  
  /**
   * Call the update callback
   */
  private updateCallback(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback({ ...this.state });
    }
  }
  
  /**
   * Check if calibration is in progress
   */
  public isCalibrating(): boolean {
    return this.state.isCalibrating;
  }
  
  /**
   * Get current calibration state
   */
  public getState(): CalibrationState {
    return { ...this.state };
  }
  
  /**
   * Reset calibration state
   */
  public reset(): void {
    this.state.isCalibrating = false;
    this.sampleCount = 0;
    this.qualityHistory = [];
    this.signalHistory = [];
    this.calibrationComplete = false;
    
    this.updateCallback();
  }
}
