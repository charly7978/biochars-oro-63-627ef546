
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señal PPG para asegurar mediciones basadas solo en datos reales
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;
  private readonly minSignalStrength: number = 0.01; // Incrementado para mayor seguridad
  
  // Finger detection variables
  private signalPatternBuffer: number[] = [];
  private readonly EXTENDED_PATTERN_BUFFER_SIZE = 120; // 4 segundos a 30Hz para mayor robustez
  private fingerDetectionWindow: number = 0;
  private readonly FINGER_CONFIRM_WINDOW = 60; // 2 segundos
  private fingerDetected: boolean = false;

  constructor(minAmplitude: number = 0.01, minDataPoints: number = 10) {
    this.minAmplitude = minAmplitude;
    this.minDataPoints = minDataPoints;
  }
  
  /**
   * Verifica si un valor individual es una señal válida
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) > this.minSignalStrength;
  }
  
  /**
   * Verifica si tenemos suficientes datos para análisis
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente para análisis confiable
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    const recentValues = values.slice(-20); // Análisis extendido para más precisión
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.minAmplitude;
  }
  
  /**
   * Track signal for rhythmic pattern detection to identify finger presence
   * Uses physiological characteristics to recognize true finger signals
   */
  public trackSignalForPatternDetection(value: number): void {
    this.signalPatternBuffer.push(value);
    if (this.signalPatternBuffer.length > this.EXTENDED_PATTERN_BUFFER_SIZE) {
      this.signalPatternBuffer.shift();
    }

    if (this.signalPatternBuffer.length >= this.EXTENDED_PATTERN_BUFFER_SIZE) {
      const buf = this.signalPatternBuffer;
      const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
      const variance = buf.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buf.length;
      const stdDev = Math.sqrt(variance);

      const isFlat = stdDev < 0.0015; // Estricto para aplanamiento
      const isSaturated = buf.filter(v => Math.abs(v) > 0.92).length > buf.length * 0.15;

      const peaks: number[] = [];
      for (let i = 2; i < buf.length - 2; i++) {
        if (
          buf[i] > buf[i - 1] && buf[i] > buf[i - 2] &&
          buf[i] > buf[i + 1] && buf[i] > buf[i + 2] &&
          buf[i] - mean > 0.015 // Amplitud fisiológica mínima
        ) {
          if (peaks.length === 0 || i - peaks[peaks.length - 1] > 8) {
            peaks.push(i);
          }
        }
      }

      // Calcula periodicidad con autocorrelación
      function autocorr(sig: number[], lag: number) {
        let sum = 0;
        for (let i = 0; i < sig.length - lag; i++) {
          sum += (sig[i] - mean) * (sig[i + lag] - mean);
        }
        return sum / (sig.length - lag);
      }

      let periodicityScore = 0;
      for (let lag = 10; lag <= 40; lag++) {
        const ac = autocorr(buf, lag);
        if (ac > periodicityScore) periodicityScore = ac;
      }
      periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));

      // Intervalos entre picos con filtro fisiológico
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      const validIntervals = intervals.filter(iv => iv >= 8 && iv <= 45);

      // Coeficiente de variación para estabilidad
      let cv = 1;
      if (validIntervals.length >= 2) {
        const avgIv = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const varIv = validIntervals.reduce((a, b) => a + Math.pow(b - avgIv, 2), 0) / validIntervals.length;
        cv = Math.sqrt(varIv) / avgIv;
      }

      // Criterios fisiológicos estrictos
      const patternDetected = (
        peaks.length >= 5 &&
        validIntervals.length >= 4 &&
        periodicityScore > 0.45 &&
        cv < 0.16 &&
        !isFlat &&
        !isSaturated
      );

      if (patternDetected) {
        this.fingerDetectionWindow++;
        if (this.fingerDetectionWindow > this.FINGER_CONFIRM_WINDOW) {
          this.fingerDetected = true;
        }
      } else {
        this.fingerDetectionWindow = 0;
        this.fingerDetected = false;
      }

      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
        console.log('[SignalValidator] Detected peaks:', peaks.length, 'periodicity:', periodicityScore.toFixed(3), 'CV:', cv.toFixed(3), 'Flat:', isFlat, 'Sat:', isSaturated, 'Finger:', this.fingerDetected);
      }
    }
  }
  
  /**
   * Check if finger is detected based on physiological signal patterns
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalPatternBuffer = [];
    this.fingerDetectionWindow = 0;
    this.fingerDetected = false;
  }
}
