
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';
import { SignalFilter } from './signal-filter';
import { SignalQuality } from './signal-quality';
import { HeartRateDetector } from './heart-rate-detector';
import { SignalValidator } from '../validators/signal-validator';

/**
 * Signal processor for real PPG signals - versión mejorada
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  private readonly MIN_QUALITY_FOR_FINGER = 40; // Reducido para mejor sensibilidad
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 2500; // Reducido para respuesta más rápida
  private readonly MIN_SIGNAL_AMPLITUDE = 0.015; // Optimizado para sensibilidad
  
  // Nuevos parámetros para detección mejorada
  private readonly CONFIRMATION_DECAY_TIME = 5000; // ms antes de desconfirmar después de pérdida
  private readonly MIN_CONSISTENCY_PERIOD = 1500; // ms mínimo de consistencia para detectar dedo
  private lastLossOfSignal: number | null = null;

  private dcBaseline: number = 0;
  private rawSignalBuffer: number[] = []; 
  private readonly RAW_BUFFER_SIZE = 60; // Ampliado para mejor análisis

  private readonly DC_BASELINE_ALPHA_SLOW = 0.005;
  private readonly DC_BASELINE_ALPHA_FAST = 0.12;  

  private acSignalRawBuffer: number[] = [];
  private medianFilteredAcSignalBuffer: number[] = [];
  private emaFilteredAcSignalBuffer: number[] = []; 

  private readonly FILTER_BUFFER_SIZE = 20; // Ampliado para mejor filtrado
  
  // Nuevo: análisis de energía de señal
  private signalEnergyBuffer: number[] = [];
  private readonly ENERGY_BUFFER_SIZE = 15;
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.filter.initialize(); // Inicializar filtros
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.015, 12); // Parámetros optimizados
    this.dcBaseline = 0; 
    this.rawSignalBuffer = [];
  }
  
  private updateDcBaseline(rawValue: number): void {
    this.rawSignalBuffer.push(rawValue);
    if (this.rawSignalBuffer.length > this.RAW_BUFFER_SIZE) {
      this.rawSignalBuffer.shift();
    }

    if (this.dcBaseline === 0) { 
      this.dcBaseline = rawValue;
    } else {
      const diff = Math.abs(rawValue - this.dcBaseline);
      // Adaptación mejorada con umbrales más sensibles
      const adaptFastThreshold = Math.max(5, this.dcBaseline * 0.1);
      if (diff > adaptFastThreshold && this.dcBaseline > 0) { 
           this.dcBaseline = this.dcBaseline * (1 - this.DC_BASELINE_ALPHA_FAST) + rawValue * this.DC_BASELINE_ALPHA_FAST;
      } else {
           this.dcBaseline = this.dcBaseline * (1 - this.DC_BASELINE_ALPHA_SLOW) + rawValue * this.DC_BASELINE_ALPHA_SLOW;
      }
    }
  }

  private addToBuffer(buffer: number[], value: number, maxSize: number): void {
    buffer.push(value);
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }

  public applyFilters(value: number): { 
    filteredValue: number, 
    quality: number, 
    fingerDetected: boolean, 
    acSignalValue: number, 
    dcBaseline: number 
  } {
    this.signalValidator.trackSignalForPatternDetection(value); 
    
    this.updateDcBaseline(value);    
    const acSignal = value - this.dcBaseline;
    this.addToBuffer(this.acSignalRawBuffer, acSignal, this.FILTER_BUFFER_SIZE);

    // Mejorado: Aplicar filtro mediana primero para eliminar outliers
    const medianFiltered = this.filter.applyMedianFilter(acSignal, this.acSignalRawBuffer);
    this.addToBuffer(this.medianFilteredAcSignalBuffer, medianFiltered, this.FILTER_BUFFER_SIZE);
    
    // Mejorado: Aplicar EMA adaptativo para suavizado
    const emaFiltered = this.filter.applyEMAFilter(medianFiltered, this.medianFilteredAcSignalBuffer); 
    this.addToBuffer(this.emaFilteredAcSignalBuffer, emaFiltered, this.FILTER_BUFFER_SIZE);
    
    // Aplicar filtro SMA para suavizado final
    const smaFiltered = this.filter.applySMAFilter(emaFiltered, this.emaFilteredAcSignalBuffer);
    
    // Nuevo: Calcular energía de la señal para análisis de actividad
    const signalEnergy = Math.pow(smaFiltered, 2);
    this.addToBuffer(this.signalEnergyBuffer, signalEnergy, this.ENERGY_BUFFER_SIZE);
        
    this.ppgValues.push(smaFiltered); 
    if (this.ppgValues.length > 120) { // Aumentado para mejor análisis histórico
      this.ppgValues.shift();
    }

    this.quality.updateNoiseLevel(acSignal, smaFiltered);
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Detección mejorada utilizando múltiples criterios
    const patternFingerDetected = this.signalValidator.isFingerDetected(); 
    const fingerDetectedByQuality = qualityValue >= this.MIN_QUALITY_FOR_FINGER;

    // Análisis de amplitud mejorado
    let amplitudeAC = 0;
    if (this.ppgValues.length > 15) { 
      const recentAcValues = this.ppgValues.slice(-15);
      amplitudeAC = Math.max(...recentAcValues) - Math.min(...recentAcValues);
    }
    const hasValidAmplitude = amplitudeAC >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Nuevo: Análisis de energía de señal
    let hasValidEnergy = false;
    if (this.signalEnergyBuffer.length >= 10) {
      const avgEnergy = this.signalEnergyBuffer.reduce((sum, e) => sum + e, 0) / this.signalEnergyBuffer.length;
      hasValidEnergy = avgEnergy > 0.0002; // Umbral de energía mínima
    }

    // Lógica mejorada para estabilidad en la detección
    const signalDetectionCriteria = (patternFingerDetected && hasValidAmplitude && fingerDetectedByQuality) || 
                                    (hasValidEnergy && fingerDetectedByQuality);
    
    const now = Date.now();
    
    // Gestión mejorada de la detección/pérdida del dedo
    if (signalDetectionCriteria) {
      // Señal detectada
      if (!this.fingerDetectionConfirmed) {
        if (!this.fingerDetectionStartTime) {
          this.fingerDetectionStartTime = now;
          console.log("SignalProcessor: Finger detection started", { 
            timestamp: now, 
            quality: qualityValue 
          });
        }
        
        // Confirmar después del período de estabilidad
        if (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME) {
          this.fingerDetectionConfirmed = true;
          this.rhythmBasedFingerDetection = true;
          this.lastLossOfSignal = null;
          console.log("SignalProcessor: Finger detection CONFIRMED", {
            timestamp: now,
            startTime: this.fingerDetectionStartTime,
            confirmationTime: now - this.fingerDetectionStartTime,
            quality: qualityValue
          });
        }
      }
      
      // Resetear tiempo de pérdida si estamos detectando señal
      this.lastLossOfSignal = null;
    } 
    else if (this.fingerDetectionConfirmed) {
      // Señal perdida mientras estábamos confirmados
      if (!this.lastLossOfSignal) {
        this.lastLossOfSignal = now;
        console.log("SignalProcessor: Signal loss detected while confirmed", {
          timestamp: now,
          quality: qualityValue
        });
      }
      
      // Desconfirmar solo después de un período significativo sin señal
      // Esto previene falsos negativos por pérdidas momentáneas
      if (now - this.lastLossOfSignal >= this.CONFIRMATION_DECAY_TIME) {
        this.fingerDetectionConfirmed = false;
        this.fingerDetectionStartTime = null;
        this.rhythmBasedFingerDetection = false;
        console.log("SignalProcessor: Finger detection lost after decay period", {
          timestamp: now,
          lossTime: this.lastLossOfSignal,
          decayTime: now - this.lastLossOfSignal
        });
      }
    } else {
      // No hay señal y no estamos confirmados
      this.fingerDetectionStartTime = null;
      this.lastLossOfSignal = null;
    }

    return { 
      filteredValue: smaFiltered, 
      quality: qualityValue,
      fingerDetected: this.fingerDetectionConfirmed,
      acSignalValue: acSignal, 
      dcBaseline: this.dcBaseline
    };
  }
  
  public calculateHeartRate(sampleRate: number = 30): number {
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate); 
  }
  
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return this.heartRateDetector.getRRIntervals();
  }

  public hasValidAmplitude(values: number[]): boolean { 
    if (values.length < 10) return false;
    const amplitude = Math.max(...values) - Math.min(...values);
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE; 
  }

  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalProcessor logValidationResults:", { isValid, amplitude, valueCount: values.length });
  }

  public getRawSignalBuffer(): number[] {
    return [...this.rawSignalBuffer];
  }

  public reset(): void {
    super.reset(); 
    this.filter.reset();
    this.quality.reset();
    this.heartRateDetector.reset(); 
    this.signalValidator.resetFingerDetection(); 
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    this.lastLossOfSignal = null;
    this.dcBaseline = 0; 
    this.rawSignalBuffer = []; 
    this.acSignalRawBuffer = [];
    this.medianFilteredAcSignalBuffer = [];
    this.emaFilteredAcSignalBuffer = [];
    this.signalEnergyBuffer = [];
    console.log("SignalProcessor: Reset complete");
  }
} 
