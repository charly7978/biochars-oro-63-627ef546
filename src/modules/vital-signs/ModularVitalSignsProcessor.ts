/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Modular Vital Signs Processor implementation
 */

import { CardiacChannel } from '../signal-processing/channels/CardiacChannel';
import { SpO2Channel } from '../signal-processing/channels/SpO2Channel';
import { BloodPressureChannel } from '../signal-processing/channels/BloodPressureChannel';
import { OptimizedSignalDistributor } from '../signal-processing/OptimizedSignalDistributor';
import { VitalSignType } from '../signal-processing/channels/SpecializedChannel';
import { SignalDistributorConfig } from '../signal-processing/interfaces';

// Define tipos para resultados de signos vitales
export interface ModularVitalSignsResult {
  timestamp: number;
  signalQuality: number;
  
  heartRate: number;
  heartRateConfidence: number;
  spo2Value: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  
  arrhythmiaStatus: string;
  lastArrhythmiaData?: any;
}

// Process signal result
export interface ProcessedSignal {
  timestamp: number;
  value: number;
  quality: number;
  fingerDetected: boolean;
}

// Define tipos para opciones de configuración
interface ModularProcessorOptions {
  enableArrhythmiaDetection: boolean;
  sensibility: 'low' | 'medium' | 'high';
  enableBloodPressure: boolean;
  calibrationMode: boolean;
}

/**
 * Procesador modular de signos vitales
 */
export class ModularVitalSignsProcessor {
  private signalDistributor: OptimizedSignalDistributor;
  private options: ModularProcessorOptions;
  private isProcessing: boolean = false;
  private lastArrhythmiaStatus: string = "Normal|0";
  private arrhythmiaCounter: number = 0;
  private lastResultCache: ModularVitalSignsResult | null = null;
  
  /**
   * Constructor del procesador
   */
  constructor() {
    // Inicializar opciones por defecto
    this.options = {
      enableArrhythmiaDetection: true,
      sensibility: 'medium',
      enableBloodPressure: true,
      calibrationMode: false
    };
    
    // Crear distribuidor de señales con canales especializados
    this.signalDistributor = new OptimizedSignalDistributor();
    
    // Add the default channels
    this.signalDistributor.registerChannel(new CardiacChannel(VitalSignType.CARDIAC));
    this.signalDistributor.registerChannel(new SpO2Channel(VitalSignType.SPO2));
    this.signalDistributor.registerChannel(new BloodPressureChannel(VitalSignType.BLOOD_PRESSURE));
    
    // Configurar el distribuidor
    this.configureDistributor();
  }
  
  /**
   * Configura el distribuidor de señales según opciones
   */
  private configureDistributor(): void {
    const config: SignalDistributorConfig = {
      channels: {
        [VitalSignType.CARDIAC]: {
          enabled: true,
          adaptationRate: this.options.sensibility === 'high' ? 0.5 : 
                          this.options.sensibility === 'medium' ? 0.3 : 0.2
        },
        [VitalSignType.SPO2]: {
          enabled: true
        },
        [VitalSignType.BLOOD_PRESSURE]: {
          enabled: this.options.enableBloodPressure
        }
      },
      calibrationMode: this.options.calibrationMode
    };
    
    // Apply the configuration directly to the distributor
    this.signalDistributor.processSignal(0, config); // Pass the config as additional parameter
  }
  
  /**
   * Start processing signals
   */
  start(): void {
    this.isProcessing = true;
    this.signalDistributor.start();
  }
  
  /**
   * Stop processing signals
   */
  stop(): void {
    this.isProcessing = false;
    this.signalDistributor.stop();
  }
  
  /**
   * Procesa una nueva muestra de señal
   */
  processSignal(signal: ProcessedSignal, rrData?: any): ModularVitalSignsResult | null {
    if (!this.isProcessing) {
      return null;
    }
    
    try {
      // Distribuir señal a todos los canales activos
      const distributionResult = this.signalDistributor.processSignal(signal.value);
      
      // Obtener resultados de canales específicos
      const cardiacChannel = this.signalDistributor.getChannel(VitalSignType.CARDIAC);
      const spo2Channel = this.signalDistributor.getChannel(VitalSignType.SPO2);
      const bpChannel = this.signalDistributor.getChannel(VitalSignType.BLOOD_PRESSURE);
      
      // Verificar si tenemos suficiente calidad para resultados
      const hasQualitySignal = signal.quality > 30 && signal.fingerDetected;
      
      // Manejar detección de arritmias si está habilitado
      let arrhythmiaStatus = "Normal|0";
      let lastArrhythmiaData = null;
      
      if (this.options.enableArrhythmiaDetection && rrData && rrData.intervals && rrData.intervals.length > 3) {
        const { detected, counter, data } = this.detectArrhythmia(rrData.intervals);
        
        if (detected) {
          arrhythmiaStatus = `Detectada|${counter}`;
          this.arrhythmiaCounter = counter;
          lastArrhythmiaData = data;
        } else {
          arrhythmiaStatus = `Normal|${this.arrhythmiaCounter}`;
        }
        
        this.lastArrhythmiaStatus = arrhythmiaStatus;
      }
      
      // Generar resultado combinando datos de todos los canales
      const result: ModularVitalSignsResult = {
        timestamp: signal.timestamp,
        signalQuality: signal.quality,
        
        // Datos cardíacos
        heartRate: cardiacChannel ? (cardiacChannel as CardiacChannel).getBPM() : 0,
        heartRateConfidence: hasQualitySignal ? 0.8 : 0.2,
        
        // SpO2
        spo2Value: spo2Channel ? (spo2Channel as SpO2Channel).getLatestValue() || 0 : 0,
        
        // Presión arterial
        bloodPressureSystolic: bpChannel ? (bpChannel as BloodPressureChannel).getSystolic() : 0,
        bloodPressureDiastolic: bpChannel ? (bpChannel as BloodPressureChannel).getDiastolic() : 0,
        
        // Estado de arritmia
        arrhythmiaStatus,
        lastArrhythmiaData
      };
      
      // Actualizar caché del último resultado
      this.lastResultCache = result;
      
      return result;
    } catch (error) {
      console.error("Error procesando señal en ModularVitalSignsProcessor:", error);
      return this.lastResultCache;
    }
  }
  
  /**
   * Detecta posibles arritmias basadas en intervalos RR
   */
  private detectArrhythmia(rrIntervals: number[]): {
    detected: boolean;
    counter: number;
    data: any;
  } {
    if (rrIntervals.length < 3) {
      return {
        detected: false,
        counter: this.arrhythmiaCounter,
        data: null
      };
    }
    
    // Calcular variabilidad de intervalos RR
    const avgRR = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    const variances = rrIntervals.map(rr => Math.abs(rr - avgRR) / avgRR);
    const maxVariance = Math.max(...variances);
    
    // Detectar arritmia si la variabilidad es alta
    const threshold = this.options.sensibility === 'high' ? 0.2 :
                      this.options.sensibility === 'medium' ? 0.3 : 0.4;
    
    const hasArrhythmia = maxVariance > threshold;
    
    // Incrementar contador si detectamos arritmia
    if (hasArrhythmia) {
      this.arrhythmiaCounter++;
    }
    
    return {
      detected: hasArrhythmia,
      counter: this.arrhythmiaCounter,
      data: {
        maxVariance,
        threshold,
        intervals: rrIntervals
      }
    };
  }
  
  /**
   * Reinicia el procesador
   */
  reset(): void {
    this.isProcessing = false;
    this.signalDistributor.reset();
    this.arrhythmiaCounter = 0;
    this.lastArrhythmiaStatus = "Normal|0";
    this.lastResultCache = null;
  }
  
  /**
   * Configura el procesador
   */
  configure(options: Partial<ModularProcessorOptions>): void {
    this.options = { ...this.options, ...options };
    this.configureDistributor();
  }
  
  /**
   * Obtiene las opciones actuales
   */
  getOptions(): ModularProcessorOptions {
    return { ...this.options };
  }

  /**
   * Get diagnostics information
   */
  getDiagnostics(): any {
    return {
      isProcessing: this.isProcessing,
      arrhythmiaCounter: this.arrhythmiaCounter,
      lastArrhythmiaStatus: this.lastArrhythmiaStatus,
      options: { ...this.options }
    };
  }
}
