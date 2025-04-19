
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señal PPG para asegurar mediciones basadas solo en datos reales
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;
  private readonly minSignalStrength: number = 0.03; // Incrementado para evitar pequeños ruidos
  
  // Variables para detección de dedo
  private signalPatternBuffer: number[] = [];
  private readonly EXTENDED_PATTERN_BUFFER_SIZE = 150; // 5 segundos a 30Hz para mayor robustez
  private fingerDetectionWindow: number = 0;
  private readonly FINGER_CONFIRM_WINDOW = 75; // 2.5 segundos
  private fingerDetected: boolean = false;

  constructor(minAmplitude: number = 0.02, minDataPoints: number = 15) {
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
    if (values.length < 8) return false;
    
    const recentValues = values.slice(-30); // Más muestras y tiempo
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.minAmplitude;
  }
  
  /**
   * Trackea la señal para detectar patrón rítmico que confirme dedo humano
   * Usa características fisiológicas muy estrictas para evitar falsos positivos
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

      // Estricta detección de señal aplanada para evitar falsas señales
      const isFlat = stdDev < 0.003; 
      
      // Detectar saturación severa que indica artefactos lumínicos o ruido
      const isSaturated = buf.filter(v => Math.abs(v) > 0.90).length > buf.length * 0.12;

      // Detectar picos fisiológicos (separados al menos 10 muestras, 300ms)
      const peaks: number[] = [];
      for (let i = 3; i < buf.length - 3; i++) {
        if (
          buf[i] > buf[i - 1] && buf[i] > buf[i - 2] && buf[i] > buf[i - 3] &&
          buf[i] > buf[i + 1] && buf[i] > buf[i + 2] && buf[i] > buf[i + 3] &&
          buf[i] - mean > 0.02 // Amplitud mínima fisiológica
        ) {
          if (peaks.length === 0 || i - peaks[peaks.length - 1] > 12) {
            peaks.push(i);
          }
        }
      }

      // Calculo autocorrelacion para periodicidad auténtica
      function autocorr(sig: number[], lag: number) {
        let sum = 0;
        for (let i = 0; i < sig.length - lag; i++) {
          sum += (sig[i] - mean) * (sig[i + lag] - mean);
        }
        return sum / (sig.length - lag);
      }

      let periodicityScore = 0;
      for (let lag = 15; lag <= 40; lag++) { // rango 0.5-1.3s aprox
        const ac = autocorr(buf, lag);
        if (ac > periodicityScore) periodicityScore = ac;
      }
      // Normalizar periodicidad teniendo en cuenta varianza
      periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));

      // Intercvalos estrictos entre picos para fisiologia humana
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      const validIntervals = intervals.filter(iv => iv >= 12 && iv <= 40);

      // Coeficiente de variación estricto
      let cv = 1;
      if (validIntervals.length >= 3) {
        const avgIv = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const varIv = validIntervals.reduce((a, b) => a + Math.pow(b - avgIv, 2), 0) / validIntervals.length;
        cv = Math.sqrt(varIv) / avgIv;
      }

      // Condiciones muy estrictas fisiológicas para detectar dedo humano seguro
      const patternDetected = (
        peaks.length >= 6 &&
        validIntervals.length >= 4 &&
        periodicityScore > 0.55 &&
        cv < 0.13 &&
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

      // Logs de debug para desarrollo
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
        console.log('[SignalValidator] Detected peaks:', peaks.length, 'periodicity:', periodicityScore.toFixed(3), 'CV:', cv.toFixed(3), 'Flat:', isFlat, 'Sat:', isSaturated, 'Finger:', this.fingerDetected);
      }
    }
  }
  
  /**
   * Indica si se ha detectado dedo humano en lente
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Resetea la detección
   */
  public resetFingerDetection(): void {
    this.signalPatternBuffer = [];
    this.fingerDetectionWindow = 0;
    this.fingerDetected = false;
  }
}

