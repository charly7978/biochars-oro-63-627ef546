
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Pattern detector for arrhythmia detection - enhanced for natural rhythm detection
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private anomalyScores: number[] = [];
  private peakTimestamps: number[] = [];
  
  private readonly PATTERN_BUFFER_SIZE = 20; // Increased for better pattern analysis
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 6; // Increased from 5 to 6 para mayor exigencia
  private readonly PATTERN_MATCH_THRESHOLD = 0.85; // Increased from 0.82 to 0.85 para reducir falsos positivos
  private readonly SIGNAL_DECLINE_THRESHOLD = 0.3;

  // Tracking time-based pattern consistency
  private lastUpdateTime: number = 0;
  private timeGapTooLarge: boolean = false;
  private readonly MAX_TIME_GAP_MS = 200;
  
  // Heart rhythm tracking for natural detection
  private heartRateIntervals: number[] = [];
  private readonly MAX_INTERVALS = 10;
  private lastHeartbeatTime: number = 0;
  
  // Falso positivo prevención
  private detectionHistory: boolean[] = [];
  private readonly DETECTION_HISTORY_SIZE = 6; // Increased from 5 to 6 para reducir falsos positivos
  private detectionCount: number = 0;
  private lastDetectionTime: number = 0;
  private readonly MIN_DETECTION_INTERVAL_MS = 8000; // Increased from 5000 to 8000 ms
  
  // Calibración del patrón
  private stabilityCounter: number = 0;
  private readonly MAX_STABILITY = 20;

  /**
   * Update pattern buffer with real data
   */
  public updatePatternBuffer(value: number): void {
    const currentTime = Date.now();
    
    // Check for time gaps that would indicate finger removal
    if (this.lastUpdateTime > 0) {
      const timeDiff = currentTime - this.lastUpdateTime;
      this.timeGapTooLarge = timeDiff > this.MAX_TIME_GAP_MS;
      
      if (this.timeGapTooLarge) {
        console.log(`Large time gap detected: ${timeDiff}ms - likely indicates finger removal`);
      }
    }
    this.lastUpdateTime = currentTime;
    
    // Detect sudden drops in signal that indicate finger removal
    const suddenDrop = this.patternBuffer.length > 0 && 
                      this.patternBuffer[this.patternBuffer.length - 1] > this.SIGNAL_DECLINE_THRESHOLD &&
                      value < this.SIGNAL_DECLINE_THRESHOLD * 0.3;
    
    if (suddenDrop) {
      console.log(`Sudden signal drop detected: ${this.patternBuffer[this.patternBuffer.length - 1]} -> ${value}`);
      // Reset buffer on sudden drops to prevent false patterns
      this.resetPatternBuffer();
      return;
    }
    
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Actualizar contador de estabilidad
    if (Math.abs(value) < 0.3) {
      this.stabilityCounter = Math.min(this.MAX_STABILITY, this.stabilityCounter + 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.5 ? 1 : 0; // Increased threshold from 0.4 to 0.5
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
    
    // Track peaks for natural rhythm detection
    if (this.patternBuffer.length >= 3) {
      const mid = this.patternBuffer.length - 2;
      const isPeak = this.patternBuffer[mid] > this.patternBuffer[mid-1] && 
                    this.patternBuffer[mid] > this.patternBuffer[mid+1] &&
                    this.patternBuffer[mid] > 0.15;
      
      if (isPeak) {
        // Found a potential heartbeat
        if (this.lastHeartbeatTime > 0) {
          const interval = currentTime - this.lastHeartbeatTime;
          
          // Only track physiologically plausible intervals (30-200 BPM)
          if (interval >= 300 && interval <= 2000) {
            this.heartRateIntervals.push(interval);
            if (this.heartRateIntervals.length > this.MAX_INTERVALS) {
              this.heartRateIntervals.shift();
            }
          }
        }
        
        this.lastHeartbeatTime = currentTime;
        this.peakTimestamps.push(currentTime);
        if (this.peakTimestamps.length > 10) {
          this.peakTimestamps.shift();
        }
      }
    }
  }
  
  /**
   * Reset pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
    this.timeGapTooLarge = false;
    this.lastUpdateTime = 0;
    this.heartRateIntervals = [];
    this.lastHeartbeatTime = 0;
    this.peakTimestamps = [];
    this.detectionHistory = [];
    this.detectionCount = 0;
    this.stabilityCounter = 0;
  }
  
  /**
   * Detect arrhythmia patterns in real data with natural rhythm analysis
   */
  public detectArrhythmiaPattern(): boolean {
    const currentTime = Date.now();
    
    // Verificar tiempo mínimo entre detecciones para evitar falsas alarmas
    if (currentTime - this.lastDetectionTime < this.MIN_DETECTION_INTERVAL_MS) {
      return false;
    }
    
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH || this.timeGapTooLarge) {
      return false;
    }
    
    // Check if there's enough variation in the signal to be a real finger
    const minVal = Math.min(...this.patternBuffer);
    const maxVal = Math.max(...this.patternBuffer);
    const signalRange = maxVal - minVal;
    
    // If the signal range is too small, it's likely not a real finger
    if (signalRange < 0.10) { // Increased from 0.08 to 0.10
      return false;
    }
    
    // Verify signal quality before proceeding
    const avgSignal = this.patternBuffer.reduce((sum, val) => sum + val, 0) / this.patternBuffer.length;
    if (avgSignal < 0.15) { // Increased from 0.1 to 0.15
      return false; // Señal muy débil, probablemente ruido
    }
    
    // Si la estabilidad es alta, es menos probable que sea una arritmia
    if (this.stabilityCounter > this.MAX_STABILITY * 0.7) {
      return false;
    }
    
    // Analyze rhythm consistency for natural heartbeat detection
    let arrhythmiaDetected = false;
    
    if (this.heartRateIntervals.length >= 5) { // Increased from 4 to 5
      const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / this.heartRateIntervals.length;
      
      // Calculate rhythm consistency (natural heartbeats have consistent timing)
      let consistentIntervals = 0;
      for (let i = 0; i < this.heartRateIntervals.length; i++) {
        const deviation = Math.abs(this.heartRateIntervals[i] - avgInterval) / avgInterval;
        if (deviation > 0.32) { // Increased from 0.30 to 0.32
          consistentIntervals++;
        }
      }
      
      const inconsistencyRatio = consistentIntervals / this.heartRateIntervals.length;
      
      // For arrhythmia, we want inconsistent intervals
      if (inconsistencyRatio > 0.55 && avgInterval >= 400 && avgInterval <= 1500) { // Increased from 0.5 to 0.55
        const estimatedBPM = Math.round(60000 / avgInterval);
        
        // Verificación adicional: los intervalos deben ser muy variables
        let validIntervalCount = 0;
        let totalVariation = 0;
        
        for (let i = 1; i < this.heartRateIntervals.length; i++) {
          const prevInterval = this.heartRateIntervals[i-1];
          const currInterval = this.heartRateIntervals[i];
          const variation = Math.abs(currInterval - prevInterval) / ((currInterval + prevInterval) / 2);
          
          if (variation > 0.28) { // Increased from 0.25 to 0.28
            validIntervalCount++;
            totalVariation += variation;
          }
        }
        
        if (validIntervalCount >= this.heartRateIntervals.length * 0.45 && // Increased from 0.4 to 0.45
            totalVariation / validIntervalCount > 0.33) { // Increased from 0.3 to 0.33
          
          console.log(`Arrhythmic pattern confirmed: ${estimatedBPM} BPM with ${Math.round(inconsistencyRatio*100)}% inconsistency`);
          arrhythmiaDetected = true;
        }
      }
    }
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.52).length; // Increased from 0.5 to 0.52
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Feature 3: Check for irregular oscillation pattern
    let oscillationCount = 0;
    for (let i = 1; i < recentPattern.length - 1; i++) {
      if ((recentPattern[i] > recentPattern[i-1] && recentPattern[i] > recentPattern[i+1]) ||
          (recentPattern[i] < recentPattern[i-1] && recentPattern[i] < recentPattern[i+1])) {
        oscillationCount++;
      }
    }
    const oscillationRatio = oscillationCount / (recentPattern.length - 2);
    
    // Feature 4: Peak timing irregularity (arrhythmic beats have inconsistent timing)
    let timingIrregularityScore = 0;
    if (this.peakTimestamps.length >= 3) {
      const intervals = [];
      for (let i = 1; i < this.peakTimestamps.length; i++) {
        intervals.push(this.peakTimestamps[i] - this.peakTimestamps[i-1]);
      }
      
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const intervalVariations = intervals.map(i => Math.abs(i - avgInterval) / avgInterval);
      const avgVariation = intervalVariations.reduce((sum, val) => sum + val, 0) / intervalVariations.length;
      
      // Higher variation is better for arrhythmia detection
      timingIrregularityScore = Math.min(1, avgVariation * 2);
    }
    
    // Combine features with weighted scoring - increased weights for more reliable features
    const patternScore = (variationRatio * 0.25) + (anomalyRatio * 0.15) + 
                        (oscillationRatio * 0.25) + (timingIrregularityScore * 0.35);
    
    // La detección basada en patrones debe cumplir un umbral más estricto
    const patternDetected = patternScore > this.PATTERN_MATCH_THRESHOLD;
    
    // Combinar todas las fuentes de detección
    const finalDetection = (arrhythmiaDetected && patternDetected);
    
    // Actualizar historial de detecciones
    this.detectionHistory.push(finalDetection);
    if (this.detectionHistory.length > this.DETECTION_HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Para confirmar arritmia, necesitamos varias detecciones positivas
    const positiveCount = this.detectionHistory.filter(d => d).length;
    const finalResult = positiveCount >= this.DETECTION_HISTORY_SIZE * 0.65; // Increased from 0.6 to 0.65
    
    if (finalResult) {
      this.detectionCount++;
      this.lastDetectionTime = currentTime;
      
      console.log(`Arrhythmia detection #${this.detectionCount} confirmed with pattern score ${patternScore.toFixed(2)}`);
    }
    
    return finalResult;
  }

  /**
   * Get the current pattern buffer
   */
  public getPatternBuffer(): number[] {
    return [...this.patternBuffer];
  }

  /**
   * Get the current anomaly scores
   */
  public getAnomalyScores(): number[] {
    return [...this.anomalyScores];
  }
  
  /**
   * Get if time gap is too large (indicator of finger removal)
   */
  public isTimeGapTooLarge(): boolean {
    return this.timeGapTooLarge;
  }
  
  /**
   * Get estimated heart rate from natural rhythm detection
   */
  public getEstimatedHeartRate(): number {
    if (this.heartRateIntervals.length < 3) return 0;
    
    // Calculate average interval
    const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / 
                        this.heartRateIntervals.length;
    
    // Convert to BPM
    return Math.round(60000 / avgInterval);
  }
}
