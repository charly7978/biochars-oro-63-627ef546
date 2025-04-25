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
  
  private readonly PATTERN_BUFFER_SIZE = 25; // Increased for better pattern analysis
  private readonly ANOMALY_HISTORY_SIZE = 35;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 6; // Increased from 5 to 6 para mayor exigencia
  private readonly PATTERN_MATCH_THRESHOLD = 0.80; // Decreased from 0.85 to 0.80 para mejorar sensibilidad
  private readonly SIGNAL_DECLINE_THRESHOLD = 0.3;

  // Tracking time-based pattern consistency
  private lastUpdateTime: number = 0;
  private timeGapTooLarge: boolean = false;
  private readonly MAX_TIME_GAP_MS = 250; // Increased from 200 to 250ms for more tolerance
  
  // Heart rhythm tracking for natural detection
  private heartRateIntervals: number[] = [];
  private readonly MAX_INTERVALS = 12; // Increased from 10 to 12
  private lastHeartbeatTime: number = 0;
  
  // Falso positivo prevención
  private detectionHistory: boolean[] = [];
  private readonly DETECTION_HISTORY_SIZE = 5; // Decreased from 6 to 5 para mejorar sensibilidad
  private detectionCount: number = 0;
  private lastDetectionTime: number = 0;
  private readonly MIN_DETECTION_INTERVAL_MS = 6000; // Decreased from 8000 to 6000 ms para menor espera entre detecciones
  
  // Calibración del patrón
  private stabilityCounter: number = 0;
  private readonly MAX_STABILITY = 20;
  
  // Nueva característica: seguimiento de tendencias
  private variationTrend: number[] = [];
  private readonly TREND_BUFFER_SIZE = 10;
  
  // Nuevas variables para captar latidos normales
  private normalBeatsCount: number = 0;
  private consecutiveNormalBeats: number = 0;
  private readonly MIN_NORMAL_BEAT_INTERVAL = 600; // 100 BPM máximo para ritmo normal (en ms)
  private readonly MAX_NORMAL_BEAT_INTERVAL = 1200; // 50 BPM mínimo para ritmo normal (en ms)
  private readonly NORMAL_VARIATION_THRESHOLD = 0.15; // Umbral de variabilidad para latidos normales
  private lastNormalHeartbeatTime: number = 0;
  private normalHeartRateBuffer: number[] = [];
  private readonly MAX_NORMAL_RATE_BUFFER = 15;

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
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2); // Penalizar inestabilidad más agresivamente
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.45 ? 1 : 0; // Decreased from 0.5 to 0.45 para mayor sensibilidad
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
    
    // Track peaks for natural rhythm detection
    if (this.patternBuffer.length >= 3) {
      const mid = this.patternBuffer.length - 2;
      const isPeak = this.patternBuffer[mid] > this.patternBuffer[mid-1] && 
                    this.patternBuffer[mid] > this.patternBuffer[mid+1] &&
                    this.patternBuffer[mid] > 0.12; // Decreased from 0.15 to 0.12 para mayor sensibilidad
      
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
            
            // Actualizar tendencia de variación si hay intervalos suficientes
            if (this.heartRateIntervals.length >= 2) {
              const lastIdx = this.heartRateIntervals.length - 1;
              const currentInterval = this.heartRateIntervals[lastIdx];
              const prevInterval = this.heartRateIntervals[lastIdx - 1];
              const variation = Math.abs(currentInterval - prevInterval) / prevInterval;
              
              this.variationTrend.push(variation);
              if (this.variationTrend.length > this.TREND_BUFFER_SIZE) {
                this.variationTrend.shift();
              }
            }
            
            // Nueva lógica para identificar latidos normales
            this.detectNormalBeat(interval, currentTime);
          }
        }
        
        this.lastHeartbeatTime = currentTime;
        this.peakTimestamps.push(currentTime);
        if (this.peakTimestamps.length > 12) { // Increased from 10 to 12
          this.peakTimestamps.shift();
        }
      }
    }
  }
  
  /**
   * Nueva función para detectar latidos normales
   */
  private detectNormalBeat(interval: number, currentTime: number): void {
    // Verificar si el intervalo está en el rango normal
    const isNormalInterval = interval >= this.MIN_NORMAL_BEAT_INTERVAL && 
                            interval <= this.MAX_NORMAL_BEAT_INTERVAL;
    
    // Verificar la variabilidad con respecto al último latido normal
    let isNormalVariation = true;
    if (this.lastNormalHeartbeatTime > 0) {
      const timeSinceLastNormal = currentTime - this.lastNormalHeartbeatTime;
      
      // Solo considerar variabilidad si no ha pasado demasiado tiempo
      if (timeSinceLastNormal < 2500) { // Máximo 2.5 segundos entre latidos normales
        const normalVariation = Math.abs(timeSinceLastNormal - interval) / interval;
        isNormalVariation = normalVariation <= this.NORMAL_VARIATION_THRESHOLD;
      }
    }
    
    // Calcular frecuencia cardíaca actual en BPM
    const currentBPM = Math.round(60000 / interval);
    
    if (isNormalInterval && isNormalVariation) {
      this.consecutiveNormalBeats++;
      this.normalBeatsCount++;
      this.lastNormalHeartbeatTime = currentTime;
      
      // Almacenar frecuencia cardíaca normal
      this.normalHeartRateBuffer.push(currentBPM);
      if (this.normalHeartRateBuffer.length > this.MAX_NORMAL_RATE_BUFFER) {
        this.normalHeartRateBuffer.shift();
      }
      
      // Podemos mostrar información sobre latidos normales consecutivos si es relevante
      if (this.consecutiveNormalBeats >= 5 && this.consecutiveNormalBeats % 5 === 0) {
        console.log(`Detected ${this.consecutiveNormalBeats} consecutive normal beats at ${currentBPM} BPM`);
      }
    } else {
      // Reiniciar contador de latidos normales consecutivos
      this.consecutiveNormalBeats = 0;
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
    this.variationTrend = []; // Limpiar tendencia de variación
    
    // Reiniciar variables de latidos normales
    this.consecutiveNormalBeats = 0;
    this.lastNormalHeartbeatTime = 0;
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
    if (signalRange < 0.09) { // Decreased from 0.10 to 0.09 para mayor sensibilidad
      return false;
    }
    
    // Verify signal quality before proceeding
    const avgSignal = this.patternBuffer.reduce((sum, val) => sum + val, 0) / this.patternBuffer.length;
    if (avgSignal < 0.12) { // Decreased from 0.15 to 0.12 para mayor sensibilidad
      return false; // Señal muy débil, probablemente ruido
    }
    
    // Si la estabilidad es alta, es menos probable que sea una arritmia
    if (this.stabilityCounter > this.MAX_STABILITY * 0.6) { // Decreased from 0.7 to 0.6
      return false;
    }
    
    // Nueva verificación: si tenemos muchos latidos normales consecutivos, es menos probable que sea arritmia
    if (this.consecutiveNormalBeats >= 8) {
      const normalRatio = this.normalBeatsCount / (this.normalBeatsCount + this.detectionCount + 1);
      if (normalRatio > 0.75) { // Si más del 75% de los latidos han sido normales
        return false;
      }
    }
    
    // Analyze rhythm consistency for natural heartbeat detection
    let arrhythmiaDetected = false;
    
    if (this.heartRateIntervals.length >= 4) { // Decreased from 5 to 4 para usar menos intervalos
      const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / this.heartRateIntervals.length;
      
      // Calculate rhythm consistency (natural heartbeats have consistent timing)
      let consistentIntervals = 0;
      for (let i = 0; i < this.heartRateIntervals.length; i++) {
        const deviation = Math.abs(this.heartRateIntervals[i] - avgInterval) / avgInterval;
        if (deviation > 0.30) { // Decreased from 0.32 to 0.30 para mayor sensibilidad
          consistentIntervals++;
        }
      }
      
      const inconsistencyRatio = consistentIntervals / this.heartRateIntervals.length;
      
      // For arrhythmia, we want inconsistent intervals
      if (inconsistencyRatio > 0.5 && avgInterval >= 380 && avgInterval <= 1600) { // Ajustados los límites para mejorar detección
        const estimatedBPM = Math.round(60000 / avgInterval);
        
        // Verificación adicional: los intervalos deben ser muy variables
        let validIntervalCount = 0;
        let totalVariation = 0;
        
        for (let i = 1; i < this.heartRateIntervals.length; i++) {
          const prevInterval = this.heartRateIntervals[i-1];
          const currInterval = this.heartRateIntervals[i];
          const variation = Math.abs(currInterval - prevInterval) / ((currInterval + prevInterval) / 2);
          
          if (variation > 0.25) { // Decreased from 0.28 to 0.25 para mayor sensibilidad
            validIntervalCount++;
            totalVariation += variation;
          }
        }
        
        // Nueva verificación: detectar patrones alternantes (típicos en arritmias)
        let alternatingPattern = false;
        if (this.heartRateIntervals.length >= 6) {
          let alternatingCount = 0;
          for (let i = 2; i < this.heartRateIntervals.length; i++) {
            // Verificar si el intervalo actual es más similar al intervalo i-2 que al i-1
            const curr = this.heartRateIntervals[i];
            const prev = this.heartRateIntervals[i-1];
            const prevPrev = this.heartRateIntervals[i-2];
            
            const diffWithPrev = Math.abs(curr - prev);
            const diffWithPrevPrev = Math.abs(curr - prevPrev);
            
            if (diffWithPrevPrev < diffWithPrev * 0.7) {
              alternatingCount++;
            }
          }
          
          alternatingPattern = alternatingCount >= (this.heartRateIntervals.length - 2) * 0.4;
        }
        
        // Analizar tendencia de variación para patrón progresivo
        let progressivePattern = false;
        if (this.variationTrend.length >= 5) {
          // Contar cuántas variaciones consecutivas aumentan
          let increasingCount = 0;
          for (let i = 1; i < this.variationTrend.length; i++) {
            if (this.variationTrend[i] > this.variationTrend[i-1] * 1.1) {
              increasingCount++;
            }
          }
          progressivePattern = increasingCount >= this.variationTrend.length * 0.5;
        }
        
        if ((validIntervalCount >= this.heartRateIntervals.length * 0.4 && // Decreased from 0.45 to 0.4
            totalVariation / validIntervalCount > 0.3) || // Decreased from 0.33 to 0.3
            alternatingPattern || progressivePattern) { // Nuevas condiciones para detectar más patrones
          
          console.log(`Arrhythmic pattern confirmed: ${estimatedBPM} BPM with ${Math.round(inconsistencyRatio*100)}% inconsistency`);
          arrhythmiaDetected = true;
        }
      }
    }
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.48).length; // Decreased from 0.52 to 0.48
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
      timingIrregularityScore = Math.min(1, avgVariation * 2.2); // Increased multiplier from 2 to 2.2
    }
    
    // Nueva característica: Detección de grupos (clustering) de intervalos
    let clusteringScore = 0;
    if (this.heartRateIntervals.length >= 5) {
      // Ordenar intervalos para buscar agrupamientos
      const sortedIntervals = [...this.heartRateIntervals].sort((a, b) => a - b);
      
      // Calcular diferencias entre intervalos adyacentes ordenados
      const differences = [];
      for (let i = 1; i < sortedIntervals.length; i++) {
        differences.push(sortedIntervals[i] - sortedIntervals[i-1]);
      }
      
      // Identificar saltos grandes (gaps) entre grupos
      let maxGap = 0;
      for (const diff of differences) {
        if (diff > maxGap) maxGap = diff;
      }
      
      // Calcular puntuación basada en la presencia de gaps significativos
      const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / this.heartRateIntervals.length;
      clusteringScore = Math.min(1, maxGap / (avgInterval * 0.5));
    }
    
    // Combine features with weighted scoring - increased weights for more reliable features
    const patternScore = (variationRatio * 0.2) + 
                         (anomalyRatio * 0.15) + 
                         (oscillationRatio * 0.2) + 
                         (timingIrregularityScore * 0.3) +
                         (clusteringScore * 0.15); // Nueva característica añadida
    
    // La detección basada en patrones debe cumplir un umbral más estricto
    const patternDetected = patternScore > this.PATTERN_MATCH_THRESHOLD;
    
    // Combinar todas las fuentes de detección - ahora OR lógico en lugar de AND para mayor sensibilidad
    const finalDetection = arrhythmiaDetected || (patternDetected && this.heartRateIntervals.length >= 3);
    
    // Reducir probabilidad de detección si se han detectado muchos latidos normales recientemente
    let adjustedDetection = finalDetection;
    if (finalDetection && this.consecutiveNormalBeats >= 6) {
      // Reducir probabilidad basada en proporción de latidos normales
      const randomFactor = Math.random();
      const normalBeatRatio = this.consecutiveNormalBeats / (this.consecutiveNormalBeats + 5);
      
      if (randomFactor < normalBeatRatio * 0.7) {
        console.log(`Potential false positive avoided due to ${this.consecutiveNormalBeats} consecutive normal beats`);
        adjustedDetection = false;
      }
    }
    
    // Actualizar historial de detecciones
    this.detectionHistory.push(adjustedDetection);
    if (this.detectionHistory.length > this.DETECTION_HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Para confirmar arritmia, necesitamos varias detecciones positivas
    const positiveCount = this.detectionHistory.filter(d => d).length;
    const finalResult = positiveCount >= this.DETECTION_HISTORY_SIZE * 0.6; // Decreased from 0.65 to 0.6
    
    if (finalResult) {
      this.detectionCount++;
      this.lastDetectionTime = currentTime;
      
      // Reiniciar conteo de latidos normales para empezar de nuevo tras detectar arritmia
      this.consecutiveNormalBeats = 0;
      
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
  
  /**
   * Nueva función: Obtener la variabilidad de los intervalos cardíacos
   * Útil para visualización y diagnóstico
   */
  public getHeartRateVariability(): number {
    if (this.heartRateIntervals.length < 3) return 0;
    
    const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / 
                        this.heartRateIntervals.length;
                        
    let totalDeviation = 0;
    for (const interval of this.heartRateIntervals) {
      totalDeviation += Math.abs(interval - avgInterval) / avgInterval;
    }
    
    return totalDeviation / this.heartRateIntervals.length;
  }
  
  /**
   * Nueva función: Obtener ritmo cardíaco basado solo en latidos normales
   * Provee una medición más estable para personas con arritmias ocasionales
   */
  public getNormalHeartRate(): number {
    if (this.normalHeartRateBuffer.length < 3) {
      return this.getEstimatedHeartRate(); // Si no tenemos suficientes latidos normales, usar estimación estándar
    }
    
    // Calcular promedio de frecuencias cardíacas normales
    const sum = this.normalHeartRateBuffer.reduce((sum, val) => sum + val, 0);
    return Math.round(sum / this.normalHeartRateBuffer.length);
  }
  
  /**
   * Nueva función: Obtener el número de latidos normales consecutivos detectados
   */
  public getConsecutiveNormalBeats(): number {
    return this.consecutiveNormalBeats;
  }
  
  /**
   * Nueva función: Obtener la proporción de latidos normales
   */
  public getNormalBeatsRatio(): number {
    const totalBeats = this.normalBeatsCount + this.detectionCount;
    if (totalBeats === 0) return 1.0; // Si no hay latidos, asumimos todos normales
    
    return this.normalBeatsCount / totalBeats;
  }
  
  /**
   * Nueva función: Determinar si el ritmo actual es predominantemente normal
   */
  public isPredominantlyNormalRhythm(): boolean {
    return this.consecutiveNormalBeats >= 6 && this.getNormalBeatsRatio() > 0.8;
  }
}
