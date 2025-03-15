
import { FingerDetector } from './finger-detection/FingerDetector';
import { SignalProcessor } from './vital-signs/signal-processor';
import { HeartBeatProcessor } from './HeartBeatProcessor';
import { BloodPressureProcessor } from './vital-signs/blood-pressure-processor';

export interface VitalSigns {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation: number;
  respirationRate: number;
  perfusionIndex: number;
  fingerDetected: boolean;
  signalQuality: number;
  signalQualityLevel: string;
}

/**
 * Procesador centralizado de signos vitales que coordina todos los subsistemas
 * de procesamiento de señal PPG para extraer múltiples parámetros vitales.
 */
export class VitalSignsProcessor {
  private fingerDetector: FingerDetector;
  private signalProcessor: SignalProcessor;
  private heartBeatProcessor: HeartBeatProcessor;
  private bloodPressureProcessor: BloodPressureProcessor;
  
  private ppgBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 300;
  
  // Historial para estabilización de lecturas
  private heartRateHistory: number[] = [];
  private oxygenSaturationHistory: number[] = [];
  private readonly HISTORY_SIZE = 5;
  
  // Estado actual de los signos vitales
  private currentVitals: VitalSigns = {
    heartRate: 0,
    bloodPressure: {
      systolic: 0,
      diastolic: 0
    },
    oxygenSaturation: 0,
    respirationRate: 0,
    perfusionIndex: 0,
    fingerDetected: false,
    signalQuality: 0,
    signalQualityLevel: ''
  };
  
  constructor() {
    this.fingerDetector = new FingerDetector();
    this.signalProcessor = new SignalProcessor();
    this.heartBeatProcessor = new HeartBeatProcessor();
    this.bloodPressureProcessor = new BloodPressureProcessor();
    console.log("VitalSignsProcessor: Inicializado correctamente");
  }
  
  /**
   * Procesa un valor PPG y extrae múltiples signos vitales
   */
  public processValue(ppgValue: number, redValue: number, greenValue: number): VitalSigns {
    // Actualizar buffer de PPG
    this.ppgBuffer.push(ppgValue);
    if (this.ppgBuffer.length > this.MAX_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Procesar la señal para obtener una versión filtrada
    const filteredValue = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Proporcionar valores RGB al procesador para análisis fisiológico
    this.signalProcessor.setRGBValues(redValue, greenValue);
    
    // Obtener calidad de señal
    const signalQuality = this.signalProcessor.getSignalQuality();
    
    // Determinar presencia de dedo con validación fisiológica
    const fingerDetectionResult = this.fingerDetector.processQuality(
      signalQuality,
      redValue,
      greenValue
    );
    
    this.currentVitals.fingerDetected = fingerDetectionResult.isFingerDetected;
    this.currentVitals.signalQuality = fingerDetectionResult.quality;
    this.currentVitals.signalQualityLevel = fingerDetectionResult.qualityLevel;
    
    // Si no hay dedo presente, devolver valores en cero
    if (!fingerDetectionResult.isFingerDetected) {
      this.currentVitals.heartRate = 0;
      this.currentVitals.bloodPressure = { systolic: 0, diastolic: 0 };
      this.currentVitals.oxygenSaturation = 0;
      this.currentVitals.respirationRate = 0;
      this.currentVitals.perfusionIndex = 0;
      return { ...this.currentVitals };
    }
    
    // Procesar ritmo cardíaco
    const heartBeatResult = this.heartBeatProcessor.processSignal(filteredValue);
    
    // Calcular índice de perfusión (PI) basado en datos del procesador
    const perfusionIndex = this.calculatePerfusionIndex(
      this.fingerDetector.getConfig().thresholds.perfusion,
      fingerDetectionResult.quality
    );
    
    // Actualizar historial de ritmo cardíaco para estabilidad
    if (heartBeatResult.bpm > 0) {
      this.heartRateHistory.push(heartBeatResult.bpm);
      if (this.heartRateHistory.length > this.HISTORY_SIZE) {
        this.heartRateHistory.shift();
      }
    }
    
    // Calcular presión arterial si tenemos suficientes datos
    if (this.ppgBuffer.length > 60 && heartBeatResult.bpm > 40) {
      const bpResult = this.bloodPressureProcessor.calculateBloodPressure(this.ppgBuffer.slice(-200));
      if (bpResult.systolic > 0 && bpResult.diastolic > 0) {
        this.currentVitals.bloodPressure = bpResult;
      }
    }
    
    // Calcular saturación de oxígeno basado en relación R/IR (simulado)
    const simulatedOxygen = this.calculateOxygenSaturation(redValue, greenValue);
    this.oxygenSaturationHistory.push(simulatedOxygen);
    if (this.oxygenSaturationHistory.length > this.HISTORY_SIZE) {
      this.oxygenSaturationHistory.shift();
    }
    
    // Actualizar valores vitales con promedios estabilizados
    this.currentVitals.heartRate = this.getStableHeartRate();
    this.currentVitals.oxygenSaturation = this.getStableOxygenSaturation();
    this.currentVitals.respirationRate = this.estimateRespirationRate();
    this.currentVitals.perfusionIndex = perfusionIndex;
    
    return { ...this.currentVitals };
  }
  
  /**
   * Calcula el índice de perfusión basado en la calidad de la señal
   */
  private calculatePerfusionIndex(thresholdBase: number, quality: number): number {
    // Normalizar calidad a un rango de índice de perfusión (0-10%)
    // El índice de perfusión normal está en el rango de 0.5% a 15%
    if (quality < thresholdBase * 0.5) return 0;
    
    // Mapeo no linear para mejores resultados visuales
    const normalizedPI = (quality / 100) * (quality / 100) * 10;
    return Math.min(10, Math.max(0, normalizedPI));
  }
  
  /**
   * Calcula la saturación de oxígeno basada en la relación R/G
   * Este es un modelo simplificado para demostración
   */
  private calculateOxygenSaturation(redValue: number, greenValue: number): number {
    if (redValue < 100 || greenValue < 20) return 0;
    
    const ratio = redValue / Math.max(1, greenValue);
    
    // Modelo simplificado - en un dispositivo real usaría proporción rojo/infrarrojo
    let calculatedSpO2 = 110 - (ratio * 25);
    
    // Saturación normal está en el rango de 95-100%
    calculatedSpO2 = Math.min(100, Math.max(70, calculatedSpO2));
    
    return Math.round(calculatedSpO2);
  }
  
  /**
   * Estima la frecuencia respiratoria basada en variaciones de la amplitud PPG
   * Basado en la modulación respiratoria de la señal PPG
   */
  private estimateRespirationRate(): number {
    if (this.ppgBuffer.length < 150 || this.currentVitals.heartRate < 40) return 0;
    
    // En una implementación real, esto utilizaría análisis de modulación de amplitud
    // Para simplicidad, usamos un valor derivado del ritmo cardíaco
    // La relación respiración/pulso típica es ~1:4
    const estimatedRate = Math.round(this.currentVitals.heartRate / 4);
    
    // Frecuencia respiratoria normal en reposo: 12-20 respiraciones por minuto
    return Math.min(30, Math.max(8, estimatedRate));
  }
  
  /**
   * Obtiene un valor estable de ritmo cardíaco filtrando valores atípicos
   */
  private getStableHeartRate(): number {
    if (this.heartRateHistory.length === 0) return 0;
    if (this.heartRateHistory.length === 1) return this.heartRateHistory[0];
    
    // Ordenar para obtener la mediana
    const sortedHR = [...this.heartRateHistory].sort((a, b) => a - b);
    
    // Usar mediana para estabilidad
    return sortedHR[Math.floor(sortedHR.length / 2)];
  }
  
  /**
   * Obtiene un valor estable de saturación de oxígeno
   */
  private getStableOxygenSaturation(): number {
    if (this.oxygenSaturationHistory.length === 0) return 0;
    
    // Calcular promedio
    const sum = this.oxygenSaturationHistory.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / this.oxygenSaturationHistory.length);
  }
  
  /**
   * Reinicia todos los procesadores
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.heartRateHistory = [];
    this.oxygenSaturationHistory = [];
    this.fingerDetector.reset();
    this.signalProcessor.reset();
    this.heartBeatProcessor.reset();
    
    this.currentVitals = {
      heartRate: 0,
      bloodPressure: {
        systolic: 0,
        diastolic: 0
      },
      oxygenSaturation: 0,
      respirationRate: 0,
      perfusionIndex: 0,
      fingerDetected: false,
      signalQuality: 0,
      signalQualityLevel: ''
    };
    
    console.log("VitalSignsProcessor: Reset completo");
  }
}
