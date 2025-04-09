/**
 * CrossValidator class - Implements cross-validation techniques
 * for physiologically-plausible vital signs measurements
 */
export class CrossValidator {
  private lastResults: any[] = [];
  private readonly MAX_RESULTS = 5;
  private confidenceScores: Map<string, number> = new Map();
  private validationTimestamp: number = 0;
  private validationThresholds: Map<string, { min: number, max: number }> = new Map();
  private baselineValues: Map<string, number> = new Map();
  
  constructor() {
    this.initializeThresholds();
  }
  
  /**
   * Initialize physiologically plausible thresholds for each vital sign
   */
  private initializeThresholds(): void {
    // Heart rate thresholds (40-200 BPM)
    this.validationThresholds.set('heartRate', { min: 40, max: 200 });
    
    // SpO2 thresholds (70-100%)
    this.validationThresholds.set('spo2', { min: 70, max: 100 });
    
    // Blood pressure thresholds
    this.validationThresholds.set('systolic', { min: 80, max: 200 });
    this.validationThresholds.set('diastolic', { min: 40, max: 120 });
    
    // Respiratory rate thresholds (8-40 breaths per minute)
    this.validationThresholds.set('respiratoryRate', { min: 8, max: 40 });
  }
  
  /**
   * Reset cross-validator state
   */
  public reset(): void {
    this.lastResults = [];
    this.confidenceScores.clear();
    this.baselineValues.clear();
    this.validationTimestamp = 0;
  }
  
  /**
   * Add a new result for cross-validation
   */
  public addResult(result: any): void {
    // Add to results history
    this.lastResults.unshift(result);
    
    // Trim to keep only recent results
    if (this.lastResults.length > this.MAX_RESULTS) {
      this.lastResults.pop();
    }
    
    // Update validation timestamp
    this.validationTimestamp = Date.now();
    
    // Update baseline values when we have enough data
    if (this.lastResults.length >= 3) {
      this.updateBaselines();
    }
  }
  
  /**
   * Calculate confidence score for a vital sign
   */
  public calculateConfidence(vitalSign: string): number {
    if (this.lastResults.length < 2) {
      return 0.5; // Default medium confidence with insufficient data
    }
    
    // Calculate agreement score based on recent measurements
    const values = this.lastResults
      .filter(r => r && r[vitalSign] !== undefined)
      .map(r => r[vitalSign]);
    
    if (values.length < 2) {
      return 0.5;
    }
    
    // Calculate variation coefficient
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / mean : 1;
    
    // Convert to confidence score (lower variation = higher confidence)
    let confidence = Math.max(0, Math.min(1, 1 - cv * 2));
    
    // Check if values are in physiological range
    const thresholds = this.validationThresholds.get(vitalSign);
    if (thresholds) {
      const inRange = values.every(v => v >= thresholds.min && v <= thresholds.max);
      if (!inRange) {
        confidence *= 0.5; // Reduce confidence for non-physiological values
      }
    }
    
    // Store and return
    this.confidenceScores.set(vitalSign, confidence);
    return confidence;
  }
  
  /**
   * Validate a single value against expected physiological ranges and trends
   */
  public validateMeasurement(vitalSign: string, value: number): {
    isValid: boolean,
    confidence: number,
    adjustedValue?: number
  } {
    // Get validation thresholds
    const thresholds = this.validationThresholds.get(vitalSign) || { min: 0, max: 999 };
    
    // Check if value is within physiological range
    const inRange = value >= thresholds.min && value <= thresholds.max;
    
    // Special handling for heart rate (may be reported as BPM or heartRate)
    if (vitalSign === 'heartRate' && !inRange) {
      // Try to check if 'bpm' field exists and use that instead
      for (const result of this.lastResults) {
        if (result && result.hasOwnProperty('bpm') && typeof result.bpm === 'number') {
          const bpm = result.bpm;
          if (bpm >= thresholds.min && bpm <= thresholds.max) {
            return {
              isValid: true,
              confidence: 0.7,
              adjustedValue: bpm
            };
          }
        }
      }
    }
    
    // Calculate confidence
    let confidence = this.calculateConfidence(vitalSign);
    
    // Check against baseline if we have one
    const baseline = this.baselineValues.get(vitalSign);
    let adjustedValue = value;
    
    if (baseline !== undefined) {
      // If value deviates too much from baseline without physiological reason
      const maxChange = this.getMaxPhysiologicalChange(vitalSign);
      const deviation = Math.abs(value - baseline);
      
      if (deviation > maxChange && this.lastResults.length >= 3) {
        // Reduce confidence if deviation is too large
        confidence *= Math.max(0.5, 1 - (deviation - maxChange) / maxChange);
        
        // Suggest adjusted value by limiting the change rate
        const direction = value > baseline ? 1 : -1;
        adjustedValue = baseline + (direction * maxChange);
      }
    }
    
    return {
      isValid: inRange,
      confidence,
      adjustedValue: adjustedValue !== value ? adjustedValue : undefined
    };
  }
  
  /**
   * Get the maximum physiologically plausible change for a vital sign
   * in a short time period (typically between measurements)
   */
  private getMaxPhysiologicalChange(vitalSign: string): number {
    switch (vitalSign) {
      case 'heartRate':
        return 15; // 15 BPM change between measurements
      case 'bpm':
        return 15; // 15 BPM change
      case 'spo2':
        return 5; // 5% SpO2 change
      case 'systolic':
        return 15; // 15 mmHg
      case 'diastolic':
        return 10; // 10 mmHg
      case 'respiratoryRate':
        return 5; // 5 breaths per minute
      default:
        return 999; // No limit for unknown vital signs
    }
  }
  
  /**
   * Update baseline values for all tracked vital signs
   */
  private updateBaselines(): void {
    // Get a list of all vital signs being tracked
    const vitalSigns = new Set<string>();
    
    this.lastResults.forEach(result => {
      if (result) {
        Object.keys(result).forEach(key => {
          if (typeof result[key] === 'number') {
            vitalSigns.add(key);
          }
        });
      }
    });
    
    // Update baseline for each vital sign
    vitalSigns.forEach(sign => {
      const values = this.lastResults
        .filter(r => r && r[sign] !== undefined)
        .map(r => r[sign]);
      
      if (values.length >= 3) {
        // Calculate median as baseline (more robust than mean)
        const sortedValues = [...values].sort((a, b) => a - b);
        const median = sortedValues[Math.floor(sortedValues.length / 2)];
        this.baselineValues.set(sign, median);
      }
    });
  }
  
  /**
   * Reconcile results from multiple sources or measurement methods
   */
  public reconcileResults(...results: any[]): any {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    
    const reconciled: any = {};
    const vitalSigns = new Set<string>();
    
    // Collect all vital sign keys
    results.forEach(result => {
      if (result) {
        Object.keys(result).forEach(key => {
          if (typeof result[key] === 'number') {
            vitalSigns.add(key);
          }
        });
      }
    });
    
    // Reconcile each vital sign
    vitalSigns.forEach(sign => {
      const values = results
        .filter(r => r && r[sign] !== undefined)
        .map(r => r[sign]);
      
      if (values.length === 0) return;
      
      // Handle special case for heart rate which might be in bpm field
      if (sign === 'heartRate') {
        const bpmValues = results
          .filter(r => r && r.bpm !== undefined)
          .map(r => r.bpm);
        
        if (bpmValues.length > values.length) {
          // Use bpm values if we have more of them
          const median = [...bpmValues].sort((a, b) => a - b)[Math.floor(bpmValues.length / 2)];
          reconciled[sign] = median;
          return;
        }
      }
      
      // Calculate median (more robust than mean)
      if (values.length > 0) {
        const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        reconciled[sign] = median;
      }
    });
    
    return reconciled;
  }
  
  /**
   * Check if the current results are consistent with previous ones
   */
  public checkConsistency(): boolean {
    if (this.lastResults.length < 3) {
      return true; // Not enough data to detect inconsistency
    }
    
    for (const [sign, threshold] of this.validationThresholds.entries()) {
      // Check each vital sign for consistency
      const values = this.lastResults
        .filter(r => r && (r[sign] !== undefined || (sign === 'heartRate' && r.bpm !== undefined)))
        .map(r => r[sign] !== undefined ? r[sign] : r.bpm);
      
      if (values.length < 3) continue;
      
      // Calculate mean and standard deviation
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Check if standard deviation is too high (inconsistent measurements)
      const maxAllowedStdDev = (threshold.max - threshold.min) * 0.15; // 15% of range
      if (stdDev > maxAllowedStdDev) {
        return false;
      }
    }
    
    return true;
  }
}
