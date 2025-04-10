
import { ProcessorConfig } from '../config/ProcessorConfig';
import { HeartBeatData } from '../../types/heartbeat';

/**
 * Analizador de presión arterial basado en señal PPG
 */
export class BloodPressureAnalyzer {
  private readonly DEFAULT_MIN_SYSTOLIC = 90;
  private readonly DEFAULT_MAX_SYSTOLIC = 180;
  private readonly DEFAULT_MIN_DIASTOLIC = 50;
  private readonly DEFAULT_MAX_DIASTOLIC = 110;
  private readonly MIN_SIGNAL_POINTS = 60;
  
  private config: ProcessorConfig;
  private signalBuffer: number[] = [];
  private heartRateBuffer: HeartBeatData[] = [];
  
  constructor(config: ProcessorConfig) {
    this.config = config;
  }
  
  /**
   * Actualiza la configuración del analizador
   */
  public updateConfig(config: ProcessorConfig): void {
    this.config = config;
  }
  
  /**
   * Añade un nuevo valor de señal al buffer
   */
  public addSignalValue(value: number): void {
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 600) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Añade datos de frecuencia cardíaca
   */
  public addHeartRateData(heartRate: HeartBeatData): void {
    this.heartRateBuffer.push(heartRate);
    if (this.heartRateBuffer.length > 10) {
      this.heartRateBuffer.shift();
    }
  }
  
  /**
   * Estima la presión arterial basada en los datos acumulados
   * Retorna un string en formato "120/80"
   */
  public estimate(): string {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS || this.heartRateBuffer.length < 3) {
      return "--/--";
    }
    
    try {
      // Obtener datos básicos
      const averageHR = this.calculateAverageHeartRate();
      if (averageHR === 0) return "--/--";
      
      // Aplicar el factor de calibración
      const calibrationFactor = this.config.bpCalibrationFactor;
      
      // Cálculo básico inicial
      let systolic = this.estimateSystolicFromSignal() * calibrationFactor;
      let diastolic = this.estimateDiastolicFromSignal() * calibrationFactor;
      
      // Ajustar según ritmo cardíaco
      const hrAdjustment = this.calculateHeartRateAdjustment(averageHR);
      systolic *= hrAdjustment;
      diastolic *= hrAdjustment;
      
      // Limitar a rango fisiológico
      systolic = Math.max(this.DEFAULT_MIN_SYSTOLIC, Math.min(this.DEFAULT_MAX_SYSTOLIC, systolic));
      diastolic = Math.max(this.DEFAULT_MIN_DIASTOLIC, Math.min(this.DEFAULT_MAX_DIASTOLIC, diastolic));
      
      // Asegurar que sistólica > diastólica
      if (systolic <= diastolic) {
        diastolic = systolic - 40;
      }
      
      return `${Math.round(systolic)}/${Math.round(diastolic)}`;
    } catch (error) {
      console.error('Error estimando presión arterial:', error);
      return "--/--";
    }
  }
  
  /**
   * Calcula la frecuencia cardíaca promedio desde los datos almacenados
   */
  private calculateAverageHeartRate(): number {
    if (this.heartRateBuffer.length === 0) return 0;
    
    const validEntries = this.heartRateBuffer.filter(entry => entry.confidence > 0.5);
    if (validEntries.length === 0) return 0;
    
    const sum = validEntries.reduce((acc, entry) => acc + entry.bpm, 0);
    return sum / validEntries.length;
  }
  
  /**
   * Estima la presión sistólica a partir de la señal PPG
   */
  private estimateSystolicFromSignal(): number {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS) return 120;
    
    // Análisis de la señal para encontrar características de la onda PPG
    const recentSignal = this.signalBuffer.slice(-this.MIN_SIGNAL_POINTS);
    
    // Encuentra las amplitudes mínima y máxima
    const minValue = Math.min(...recentSignal);
    const maxValue = Math.max(...recentSignal);
    const amplitude = maxValue - minValue;
    
    // Calcula la derivada de la señal para encontrar pendiente máxima
    const derivatives = [];
    for (let i = 1; i < recentSignal.length; i++) {
      derivatives.push(recentSignal[i] - recentSignal[i-1]);
    }
    
    const maxDerivative = Math.max(...derivatives);
    const rateOfChange = maxDerivative / amplitude;
    
    // Calcular sistólica basada en la amplitud y la tasa de cambio
    const baseSystolic = 100 + 30 * amplitude + 25 * rateOfChange;
    
    return baseSystolic;
  }
  
  /**
   * Estima la presión diastólica a partir de la señal PPG
   */
  private estimateDiastolicFromSignal(): number {
    if (this.signalBuffer.length < this.MIN_SIGNAL_POINTS) return 80;
    
    // Para una estimación simple, podemos basarnos en la sistólica
    const systolic = this.estimateSystolicFromSignal();
    
    // La relación típica entre sistólica y diastólica
    let diastolic = systolic * 0.65;
    
    // Ajustar según características de la señal
    const recentSignal = this.signalBuffer.slice(-this.MIN_SIGNAL_POINTS);
    
    // Encuentra tiempo entre picos (aproximación de tiempo de dicrótico)
    const peaks = [];
    for (let i = 1; i < recentSignal.length - 1; i++) {
      if (recentSignal[i] > recentSignal[i-1] && recentSignal[i] > recentSignal[i+1]) {
        peaks.push(i);
      }
    }
    
    if (peaks.length > 1) {
      // Calcular intervalos entre picos
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      // Promedio de intervalos
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      
      // Ajustar diastólica según intervalo (proxy para elasticidad arterial)
      diastolic = diastolic * (0.9 + 0.2 * (avgInterval / 30));
    }
    
    return diastolic;
  }
  
  /**
   * Calcula ajuste basado en frecuencia cardíaca
   * La presión tiende a ser mayor con HR elevada y menor con HR baja
   */
  private calculateHeartRateAdjustment(heartRate: number): number {
    const normalHR = 75;
    if (heartRate < normalHR) {
      // HR baja: presión tiende a ser menor
      return 0.95 + (heartRate / normalHR) * 0.05;
    } else if (heartRate > normalHR) {
      // HR alta: presión tiende a ser mayor
      return 1.0 + Math.min(0.15, (heartRate - normalHR) / 100);
    }
    return 1.0;
  }
  
  /**
   * Restablece el estado del analizador
   */
  public reset(): void {
    this.signalBuffer = [];
    this.heartRateBuffer = [];
  }
}
