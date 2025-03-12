
/**
 * Balanced Arrhythmia Processor based on cardiac research
 */
export class ArrhythmiaProcessor {
  // Configuration with balanced parameters
  private readonly RR_WINDOW_SIZE = 8; // Standard window size
  private readonly RMSSD_THRESHOLD = 40; // Balanced threshold
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 5000; // Standard learning period
  private readonly SD1_THRESHOLD = 30; // Balanced Poincaré plot threshold
  private readonly PERFUSION_INDEX_MIN = 0.2; // Standard minimum PI
  
  // Standard detection parameters
  private readonly PNNX_THRESHOLD = 0.2; // Standard pNN50 threshold
  private readonly SHANNON_ENTROPY_THRESHOLD = 1.5; // Standard entropy threshold
  private readonly SAMPLE_ENTROPY_THRESHOLD = 1.2; // Standard sample entropy
  
  // Standard timing between arrhythmias
  private readonly MIN_ARRHYTHMIA_INTERVAL = 1500; // 1.5 seconds minimum

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

  /**
   * Processes heart beat data to detect arrhythmias with balanced parameters
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();

    // Update RR intervals if available
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Compute RR differences for variability analysis
      if (this.rrIntervals.length >= 2) {
        this.rrDifferences = [];
        for (let i = 1; i < this.rrIntervals.length; i++) {
          this.rrDifferences.push(this.rrIntervals[i] - this.rrIntervals[i-1]);
        }
      }
      
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }

    // Check if learning phase is complete
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
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
   * Detects arrhythmia using balanced HRV metrics
   */
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) return;

    const currentTime = Date.now();
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Calculate RMSSD with standard validation
    let sumSquaredDiff = 0;
    let validIntervals = 0;
    
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      // Count intervals within physiological limits
      if (recentRR[i] >= 550 && recentRR[i] <= 1300) {
        sumSquaredDiff += diff * diff;
        validIntervals++;
      }
    }
    
    // Require sufficient valid intervals
    if (validIntervals < this.RR_WINDOW_SIZE * 0.6) {
      return;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / validIntervals);
    
    // Calculate mean RR and standard deviation
    const validRRs = recentRR.filter(rr => rr >= 550 && rr <= 1300);
    if (validRRs.length < this.RR_WINDOW_SIZE * 0.6) return;
    
    const avgRR = validRRs.reduce((a, b) => a + b, 0) / validRRs.length;
    const lastRR = validRRs[validRRs.length - 1];
    
    // Standard variation calculations
    const rrStandardDeviation = Math.sqrt(
      validRRs.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / validRRs.length
    );
    
    const coefficientOfVariation = rrStandardDeviation / avgRR;
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Calculate non-linear metrics with standard thresholds
    this.calculateNonLinearMetrics(validRRs);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    // Balanced multi-parameter decision algorithm
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const newArrhythmiaState = 
      timeSinceLastArrhythmia >= this.MIN_ARRHYTHMIA_INTERVAL && (
        // Primary condition: balanced criteria
        (rmssd > this.RMSSD_THRESHOLD && 
         rrVariation > 0.2 && 
         coefficientOfVariation > 0.12) ||
        
        // Secondary condition: standard quality requirements
        (this.shannonEntropy > this.SHANNON_ENTROPY_THRESHOLD && 
         this.pnnX > this.PNNX_THRESHOLD && 
         coefficientOfVariation > 0.15) ||
        
        // Extreme variation condition: balanced multiple criteria
        (rrVariation > 0.3 && 
         coefficientOfVariation > 0.2 && 
         this.sampleEntropy > this.SAMPLE_ENTROPY_THRESHOLD)
      );

    // If it's a new arrhythmia and enough time has passed
    if (newArrhythmiaState && 
        currentTime - this.lastArrhythmiaTime > this.MIN_ARRHYTHMIA_INTERVAL) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      
      // Mark first arrhythmia
      this.hasDetectedFirstArrhythmia = true;
      
      console.log('VitalSignsProcessor - Nueva arritmia detectada:', {
        contador: this.arrhythmiaCount,
        rmssd,
        rrVariation,
        shannonEntropy: this.shannonEntropy,
        pnnX: this.pnnX,
        coefficientOfVariation,
        timestamp: currentTime
      });
    }

    this.arrhythmiaDetected = newArrhythmiaState;
  }
  
  /**
   * Calculate non-linear HRV metrics with standard parameters
   */
  private calculateNonLinearMetrics(rrIntervals: number[]): void {
    // Calculate pNNx
    let countAboveThreshold = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
        countAboveThreshold++;
      }
    }
    this.pnnX = countAboveThreshold / (rrIntervals.length - 1);
    
    // Calculate Shannon Entropy
    this.calculateShannonEntropy(rrIntervals);
    
    // Sample Entropy calculation
    this.sampleEntropy = this.estimateSampleEntropy(rrIntervals);
  }
  
  /**
   * Calculate Shannon Entropy with standard parameters
   */
  private calculateShannonEntropy(intervals: number[]): void {
    // Standard histogram-based entropy calculation
    const bins: {[key: string]: number} = {};
    const binWidth = 30; // 30ms bin width - standard
    
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
   * Estimate Sample Entropy with standard implementation
   */
  private estimateSampleEntropy(intervals: number[]): number {
    if (intervals.length < 4) return 0;
    
    // Standard sample entropy estimation
    const normalizedIntervals = intervals.map(interval => 
      (interval - intervals.reduce((a, b) => a + b, 0) / intervals.length) / 
      Math.max(1, Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b, 2), 0) / intervals.length))
    );
    
    let sumCorr = 0;
    for (let i = 0; i < normalizedIntervals.length - 1; i++) {
      sumCorr += Math.abs(normalizedIntervals[i + 1] - normalizedIntervals[i]);
    }
    
    // Convert to entropy measure
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
  }
}
