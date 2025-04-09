
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BeatProcessor } from './heart-beat/beat-processor';
import { ArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import { SignalFilter } from './heart-beat/signal-filter';
import { checkSignalQuality } from './heart-beat/signal-quality';

export class HeartBeatProcessor {
  private beatProcessor: BeatProcessor;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private signalFilter: SignalFilter;
  
  private isMonitoring: boolean = false;
  private lastValidHeartRate: number = 0;
  private weakSignalsCount: number = 0;
  private arrhythmiaCounter: number = 0;
  
  // Configuración optimizada para mejor rendimiento
  private readonly LOW_SIGNAL_THRESHOLD = 0.1;
  private readonly MAX_WEAK_SIGNALS = 8;
  private readonly MIN_CONFIDENCE = 0.4;
  
  constructor() {
    this.beatProcessor = new BeatProcessor();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    this.signalFilter = new SignalFilter();
    
    console.log("HeartBeatProcessor: Instancia creada con procesamiento optimizado");
  }
  
  /**
   * Procesa una muestra de señal PPG y devuelve el resultado
   * Incluye detección de arritmias en señales reales
   * NO SE UTILIZAN SIMULACIONES - MEDICIONES DIRECTAS ÚNICAMENTE
   */
  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    arrhythmiaCount: number;
    rrData: {
      intervals: number[];
      lastPeakTime: number | null;
    };
    isArrhythmia?: boolean;
  } {
    if (!this.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    // Verificar señal débil
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Si la señal es demasiado débil, detener procesamiento
    if (isWeakSignal) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: this.arrhythmiaCounter,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    // Filtrar señal para análisis de ritmo cardíaco
    const filteredValue = this.signalFilter.applyBandpassFilter(value);
    
    // Procesar señal para obtener ritmo cardíaco
    const result = this.beatProcessor.processBeat(filteredValue);
    
    // Actualizar último ritmo cardíaco válido
    if (result.bpm > 40 && result.bpm < 200 && result.confidence > this.MIN_CONFIDENCE) {
      this.lastValidHeartRate = result.bpm;
      
      // Analizar arritmias solo con confianza suficiente
      if (result.isPeak && result.confidence > 0.65) {
        // Detectar arritmias en picos de buena calidad
        const isArrhythmia = this.arrhythmiaDetector.detectArrhythmia(
          Date.now(),
          this.beatProcessor.getRRIntervals()
        );
        
        // Incrementar contador si se detecta arritmia
        if (isArrhythmia) {
          this.arrhythmiaCounter++;
          console.log("HeartBeatProcessor: Arritmia detectada", {
            contador: this.arrhythmiaCounter,
            confianza: result.confidence,
            bpm: result.bpm,
            intervalos: this.beatProcessor.getRRIntervals().slice(-3)
          });
          
          // Añadir bandera de arritmia al resultado
          return {
            ...result,
            arrhythmiaCount: this.arrhythmiaCounter,
            rrData: {
              intervals: this.beatProcessor.getRRIntervals(),
              lastPeakTime: this.beatProcessor.getLastPeakTime()
            },
            isArrhythmia: true
          };
        }
      }
    }
    
    // Devolver resultado con datos RR para análisis de arritmias
    return {
      ...result,
      arrhythmiaCount: this.arrhythmiaCounter,
      rrData: {
        intervals: this.beatProcessor.getRRIntervals(),
        lastPeakTime: this.beatProcessor.getLastPeakTime()
      }
    };
  }
  
  /**
   * Inicia el monitoreo del ritmo cardíaco
   */
  public startMonitoring(): void {
    this.isMonitoring = true;
    console.log("HeartBeatProcessor: Monitoreo iniciado");
  }
  
  /**
   * Detiene el monitoreo del ritmo cardíaco
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log("HeartBeatProcessor: Monitoreo detenido");
  }
  
  /**
   * Reinicia el procesador de ritmo cardíaco
   */
  public reset(): void {
    this.beatProcessor.reset();
    this.arrhythmiaDetector.reset();
    this.signalFilter.reset();
    this.lastValidHeartRate = 0;
    this.weakSignalsCount = 0;
    this.arrhythmiaCounter = 0;
    
    console.log("HeartBeatProcessor: Procesador reiniciado");
  }
  
  /**
   * Devuelve el último ritmo cardíaco válido
   */
  public getLastValidHeartRate(): number {
    return this.lastValidHeartRate;
  }
  
  /**
   * Devuelve el contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Resetea los estados de detección de señal
   */
  public resetDetectionStates(): void {
    this.weakSignalsCount = 0;
    console.log("HeartBeatProcessor: Estados de detección reiniciados");
  }
  
  /**
   * Get RR intervals for heart rate analysis
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: this.beatProcessor.getRRIntervals(),
      lastPeakTime: this.beatProcessor.getLastPeakTime()
    };
  }
}
