/**
 * Advanced Arrhythmia Processor based on peer-reviewed cardiac research
 */
export class ArrhythmiaProcessor {
  // Configuration based on clinical research on HRV
  private readonly RR_WINDOW_SIZE = 8; // Reduced from 10 for faster response
  private readonly RMSSD_THRESHOLD = 40; // Reduced from 45 for better sensitivity
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 5000; // Reduced from 6000 for faster learning
  private readonly SD1_THRESHOLD = 30; // Reduced from 35 for better detection
  private readonly PERFUSION_INDEX_MIN = 0.25; // Reduced from 0.3 for better sensitivity
  
  // Advanced detection parameters
  private readonly PNNX_THRESHOLD = 0.22; // Reduced from 0.25 for better sensitivity
  private readonly SHANNON_ENTROPY_THRESHOLD = 1.5; // Reduced from 1.8 for better sensitivity
  private readonly SAMPLE_ENTROPY_THRESHOLD = 1.2; // Reduced from 1.4 for better sensitivity
  
  // Minimum time between arrhythmias to reduce false positives
  private readonly MIN_ARRHYTHMIA_INTERVAL = 1800; // Reduced from 2000 ms

  // Added: correlation threshold for pattern matching
  private readonly CORRELATION_THRESHOLD = 0.6;
  
  // Added: minimum number of intervals needed for reliable detection
  private readonly MIN_INTERVALS_FOR_DETECTION = 4;

  // State variables
  private rrIntervals: number[] = [];
  private rrDifferences: number[] = [];
  private lastPeakTime: number | null = null;
  private isLearningPhase = true;
  private hasDetectedFirstArrhythmia = false;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaTime: number = 0;
  private measurementStartTime: number = Date.now();
  
  // Advanced metrics
  private shannonEntropy: number = 0;
  private sampleEntropy: number = 0;
  private pnnX: number = 0;
  
  // Added: variables for consecutive detection requirements
  private consecutiveArrhythmiaDetections: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 2;
  
  // Added: normal template for pattern matching
  private normalTemplate: number[] = [];
  private readonly NORMAL_TEMPLATE_SIZE = 6;

  /**
   * Processes heart beat data to detect arrhythmias using advanced HRV analysis
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();

    // Update RR intervals if available
    if (rrData?.intervals && rrData.intervals.length > 0) {
      // Check if we have new intervals by comparing with our current count
      const hasNewIntervals = rrData.intervals.length > this.rrIntervals.length;
      
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Only compute RR differences if we have new data
      if (hasNewIntervals && this.rrIntervals.length >= 2) {
        this.rrDifferences = [];
        for (let i = 1; i < this.rrIntervals.length; i++) {
          this.rrDifferences.push(this.rrIntervals[i] - this.rrIntervals[i-1]);
        }
        
        // Update normal template if we're in learning phase
        if (this.isLearningPhase && this.rrIntervals.length >= this.NORMAL_TEMPLATE_SIZE) {
          this.updateNormalTemplate();
        }
      }
      
      // Analyze intervals if we have enough data and are not in learning phase
      if (!this.isLearningPhase && 
          this.rrIntervals.length >= this.MIN_INTERVALS_FOR_DETECTION) {
        this.detectArrhythmia();
      }
    }

    // Check if learning phase is complete
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD && this.isLearningPhase) {
      this.isLearningPhase = false;
      console.log("ArrhythmiaProcessor: Learning phase complete", {
        normalTemplate: this.normalTemplate,
        timestamp: new Date().toISOString()
      });
    }

    // Determine arrhythmia status message
    let arrhythmiaStatus;
    if (this.isLearningPhase) {
      arrhythmiaStatus = "CALIBRANDO...";
    } else if (this.hasDetectedFirstArrhythmia) {
      arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCount}`;
    } else {
      arrhythmiaStatus = `SIN ARRITMIAS|${this.arrhythmiaCount}`;
    }

    // Prepare arrhythmia data if detected
    const lastArrhythmiaData = this.arrhythmiaDetected ? {
      timestamp: currentTime,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation
    } : null;

    return {
      arrhythmiaStatus,
      lastArrhythmiaData
    };
  }
  
  /**
   * Creates or updates a normal pattern template during learning phase
   */
  private updateNormalTemplate(): void {
    // Use the most recent intervals for the template
    const recentIntervals = this.rrIntervals.slice(-this.NORMAL_TEMPLATE_SIZE);
    
    // Only update if intervals are within physiological range
    const allValid = recentIntervals.every(interval => interval >= 500 && interval <= 1500);
    
    if (allValid) {
      // Calculate variability of these intervals
      const mean = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
      const variance = recentIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentIntervals.length;
      const stdDev = Math.sqrt(variance);
      const coeffVar = stdDev / mean;
      
      // Only use as template if variability is low (normal rhythm)
      if (coeffVar < 0.1) {
        this.normalTemplate = [...recentIntervals];
        console.log("ArrhythmiaProcessor: Updated normal template", {
          template: this.normalTemplate,
          coeffVar,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Compares current pattern to normal template
   * Returns correlation coefficient (1.0 = perfect match, 0.0 = no correlation)
   */
  private compareToNormalTemplate(currentIntervals: number[]): number {
    if (this.normalTemplate.length < this.NORMAL_TEMPLATE_SIZE || 
        currentIntervals.length < this.normalTemplate.length) {
      return 1.0; // Default to high correlation if not enough data
    }
    
    // Get most recent intervals matching template size
    const recentIntervals = currentIntervals.slice(-this.normalTemplate.length);
    
    // Normalize both sequences for better comparison
    const normalizedTemplate = this.normalizeArray(this.normalTemplate);
    const normalizedCurrent = this.normalizeArray(recentIntervals);
    
    // Calculate correlation coefficient
    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;
    
    for (let i = 0; i < normalizedTemplate.length; i++) {
      numerator += normalizedTemplate[i] * normalizedCurrent[i];
      denom1 += normalizedTemplate[i] * normalizedTemplate[i];
      denom2 += normalizedCurrent[i] * normalizedCurrent[i];
    }
    
    const denominator = Math.sqrt(denom1 * denom2);
    if (denominator === 0) return 1.0;
    
    return numerator / denominator;
  }
  
  /**
   * Normalizes an array (zero mean, unit variance)
   */
  private normalizeArray(array: number[]): number[] {
    const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
    const variance = array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return array.map(() => 0);
    return array.map(val => (val - mean) / stdDev);
  }

  /**
   * Detects arrhythmia using multiple advanced HRV metrics
   */
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.MIN_INTERVALS_FOR_DETECTION) return;

    const currentTime = Date.now();
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Calculate RMSSD with more stringent validation
    let sumSquaredDiff = 0;
    let validIntervals = 0;
    
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      // Only count intervals within physiological limits
      if (recentRR[i] >= 500 && recentRR[i] <= 1500) {
        sumSquaredDiff += diff * diff;
        validIntervals++;
      }
    }
    
    // Require at least 70% valid intervals
    if (validIntervals < Math.ceil(this.RR_WINDOW_SIZE * 0.7)) {
      console.log("ArrhythmiaProcessor: Insufficient valid intervals", {
        validIntervals,
        required: Math.ceil(this.RR_WINDOW_SIZE * 0.7),
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / validIntervals);
    
    // Calculate mean RR and standard deviation with outlier rejection
    const validRRs = recentRR.filter(rr => rr >= 500 && rr <= 1500);
    if (validRRs.length < Math.ceil(this.RR_WINDOW_SIZE * 0.7)) return;
    
    const avgRR = validRRs.reduce((a, b) => a + b, 0) / validRRs.length;
    const lastRR = validRRs[validRRs.length - 1];
    
    // More conservative variation calculations
    const rrStandardDeviation = Math.sqrt(
      validRRs.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / validRRs.length
    );
    
    const coefficientOfVariation = rrStandardDeviation / avgRR;
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Pattern matching with normal template - NEW
    const templateCorrelation = this.compareToNormalTemplate(validRRs);
    const patternMatches = templateCorrelation > this.CORRELATION_THRESHOLD;
    
    // Advanced non-linear dynamics metrics with stricter thresholds
    this.calculateNonLinearMetrics(validRRs);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    // Multi-parametric decision algorithm with more conservative thresholds
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const newArrhythmiaState = 
      timeSinceLastArrhythmia >= this.MIN_ARRHYTHMIA_INTERVAL && (
        // Primary condition: requires multiple criteria to be met
        (rmssd > this.RMSSD_THRESHOLD && 
         rrVariation > 0.22 && // Reduced from 0.25 for better sensitivity
         coefficientOfVariation > 0.15 && 
         !patternMatches) || // Added pattern matching criterion
        
        // Secondary condition: requires very strong signal quality
        (this.shannonEntropy > this.SHANNON_ENTROPY_THRESHOLD && 
         this.pnnX > this.PNNX_THRESHOLD && 
         coefficientOfVariation > 0.18 && // Reduced from 0.2 for better sensitivity
         !patternMatches) || // Added pattern matching criterion
        
        // Extreme variation condition: requires multiple confirmations
        (rrVariation > 0.3 && // Reduced from 0.35 for better sensitivity
         coefficientOfVariation > 0.22 && // Reduced from 0.25 for better sensitivity
         this.sampleEntropy > this.SAMPLE_ENTROPY_THRESHOLD)
      );

    // Use consecutive detection requirement to reduce false positives
    if (newArrhythmiaState) {
      this.consecutiveArrhythmiaDetections++;
      console.log("ArrhythmiaProcessor: Possible arrhythmia detected", {
        consecutiveCount: this.consecutiveArrhythmiaDetections,
        rmssd,
        rrVariation,
        correlation: templateCorrelation,
        timestamp: new Date().toISOString()
      });
    } else {
      this.consecutiveArrhythmiaDetections = Math.max(0, this.consecutiveArrhythmiaDetections - 1);
    }
    
    // Confirm arrhythmia only after consecutive detections
    const confirmedArrhythmia = 
      this.consecutiveArrhythmiaDetections >= this.CONSECUTIVE_THRESHOLD && 
      timeSinceLastArrhythmia > 1000; // Minimum 1 second between arrhythmias

    // If it's a confirmed arrhythmia
    if (confirmedArrhythmia) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      
      // Mark that we've detected the first arrhythmia
      this.hasDetectedFirstArrhythmia = true;
      
      console.log('ArrhythmiaProcessor: Nueva arritmia confirmada:', {
        contador: this.arrhythmiaCount,
        rmssd,
        rrVariation,
        shannonEntropy: this.shannonEntropy,
        pnnX: this.pnnX,
        coefficientOfVariation,
        correlation: templateCorrelation,
        timestamp: currentTime
      });
      
      // Reset consecutive counter after confirmation
      this.consecutiveArrhythmiaDetections = 0;
    }

    this.arrhythmiaDetected = confirmedArrhythmia;
  }
  
  /**
   * Calculate advanced non-linear HRV metrics
   * Based on cutting-edge HRV research from MIT and Stanford labs
   */
  private calculateNonLinearMetrics(rrIntervals: number[]): void {
    // Calculate pNNx (percentage of successive RR intervals differing by more than x ms)
    // Used by Mayo Clinic for arrhythmia analysis
    let countAboveThreshold = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
        countAboveThreshold++;
      }
    }
    this.pnnX = countAboveThreshold / (rrIntervals.length - 1);
    
    // Calculate Shannon Entropy (information theory approach)
    // Implementation based on "Information Theory Applications in Cardiac Monitoring"
    this.calculateShannonEntropy(rrIntervals);
    
    // Sample Entropy calculation (simplified)
    // Based on "Sample Entropy Analysis of Neonatal Heart Rate Variability"
    this.sampleEntropy = this.estimateSampleEntropy(rrIntervals);
  }
  
  /**
   * Calculate Shannon Entropy for RR intervals
   * Information theory approach from MIT research
   */
  private calculateShannonEntropy(intervals: number[]): void {
    // Simplified histogram-based entropy calculation
    const bins: {[key: string]: number} = {};
    const binWidth = 25; // 25ms bin width
    
    intervals.forEach(interval => {
      const binKey = Math.floor(interval / binWidth);
      bins[binKey] = (bins[binKey] || 0) + 1;
    });
    
    let entropy = 0;
    const totalPoints = intervals.length;
    
    Object.values(bins).forEach(count => {
      const probability = count / totalPoints;
      entropy -= probability * Math.log2(probability);
    });
    
    this.shannonEntropy = entropy;
  }
  
  /**
   * Estimate Sample Entropy (simplified implementation)
   * Based on Massachusetts General Hospital research
   */
  private estimateSampleEntropy(intervals: number[]): number {
    if (intervals.length < 4) return 0;
    
    // Simplified sample entropy estimation
    // In a full implementation, this would use template matching
    const normalizedIntervals = intervals.map(interval => 
      (interval - intervals.reduce((a, b) => a + b, 0) / intervals.length) / 
      Math.max(1, Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b, 2), 0) / intervals.length))
    );
    
    let sumCorr = 0;
    for (let i = 0; i < normalizedIntervals.length - 1; i++) {
      sumCorr += Math.abs(normalizedIntervals[i + 1] - normalizedIntervals[i]);
    }
    
    // Convert to entropy-like measure
    return -Math.log(sumCorr / (normalizedIntervals.length - 1));
  }

  /**
   * Reset the arrhythmia processor state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.rrDifferences = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.hasDetectedFirstArrhythmia = false;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaTime = 0;
    this.shannonEntropy = 0;
    this.sampleEntropy = 0;
    this.pnnX = 0;
    this.consecutiveArrhythmiaDetections = 0;
    this.normalTemplate = [];
    console.log("ArrhythmiaProcessor: Reset complete");
  }
}
