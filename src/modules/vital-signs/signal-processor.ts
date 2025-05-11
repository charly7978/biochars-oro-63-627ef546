/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
// import { SignalValidator } from './validators/signal-validator'; // SignalValidator ya no maneja detección de dedo
import { KalmanFilter } from '@/core/signal/filters/KalmanFilter';
import { BandpassFilter } from '@/core/signal/filters/BandpassFilter';
// import cv from '@techstark/opencv-js'; // ELIMINADO OPENCV

// Tipos para claridad, ajusta según tu definición exacta
import { ProcessedSignal, ProcessingError } from '@/types/signal';


interface ExtendedProcessedSignal extends ProcessedSignal {
  preBandpassValue: number;
}

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private qualityModule: SignalQuality; // Renombrado para evitar conflicto con la propiedad quality del resultado
  private heartRateDetector: HeartRateDetector;
  // private signalValidator: SignalValidator; // Ya no se necesita para detección de dedo aquí
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  // Finger detection state - ELIMINADO
  // private rhythmBasedFingerDetection: boolean = false;
  // private fingerDetectionConfirmed: boolean = false;
  // private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - ELIMINADO (la configuración ahora está en FingerDetectionService)
  // private readonly MIN_QUALITY_FOR_FINGER = 35;
  // private readonly MIN_PATTERN_CONFIRMATION_TIME = 3000;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.01; // Se mantiene para validación básica si es necesario
  
  // Parámetros de OpenCV ELIMINADOS
  // private readonly SKIN_LOWER = [0, 40, 30];
  // private readonly SKIN_UPPER = [40, 255, 255];
  // private readonly MIN_CONTOUR_AREA = 500;

  // Estado de OpenCV ELIMINADO
  // private cvReady: boolean = false;
  // private cvInitializing: boolean = false;
  
  constructor(
    public onSignalReady?: (signal: ExtendedProcessedSignal) => void,
    // public onError?: (error: ProcessingError | { code: string; message: string; timestamp: number; }) => void // onError ya no se usa aquí directamente para OpenCV
  ) {
    super();
    this.filter = new SignalFilter();
    this.qualityModule = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    // this.signalValidator = new SignalValidator(this.MIN_SIGNAL_AMPLITUDE); // Ya no se instancia o se instancia sin params de dedo
    this.kalmanFilter = new KalmanFilter();
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30); // Asumiendo SAMPLING_RATE ~30Hz
    // this.initializeOpenCV(); // ELIMINADO OPENCV
  }
  
  // MÉTODO initializeOpenCV ELIMINADO
  
  /**
   * Apply Moving Average filter to real values
   */
  public applySMAFilter(value: number): number {
    return this.filter.applySMAFilter(value, this.ppgValues);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, alpha?: number): number {
    return this.filter.applyEMAFilter(value, this.ppgValues, alpha);
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number): number {
    return this.filter.applyMedianFilter(value, this.ppgValues);
  }
  
  // MÉTODO isFingerDetected ELIMINADO
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * La detección de dedos ahora es externa a este método.
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, rawValue: number, preBandpassValue: number } {
    this.ppgValues.push(value);
    if (this.ppgValues.length > 100) { // Mantener un buffer para cálculos de calidad si es necesario
      this.ppgValues.shift();
    }
    // this.signalValidator.trackSignalForPatternDetection(value); // ELIMINADO

    const kalmanFiltered = this.kalmanFilter.filter(value);
    const preBandpassValue = kalmanFiltered; // Guardar valor antes de pasabanda
    const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

    const finalFilteredValue = bandpassFiltered;

    this.qualityModule.updateNoiseLevel(value, finalFilteredValue);
    // Calcular la calidad basada en el buffer de ppgValues filtrados como lo hacía FingerDetectionManager
    const qualityPpgValues = this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v)));
    const currentQuality = this.qualityModule.calculateSignalQuality(qualityPpgValues);

    // const fingerDetected = this.isFingerDetected(); // ELIMINADO

    return {
      rawValue: value,
      preBandpassValue: preBandpassValue,
      filteredValue: finalFilteredValue,
      quality: currentQuality,
      // fingerDetected: fingerDetected // ELIMINADO
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Asegurarse de que el buffer usado para HR sea consistente con el de calidad
    const filteredBuffer = this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v)));
    return this.heartRateDetector.calculateHeartRate(filteredBuffer, sampleRate);
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset(); // Resetea this.ppgValues
    this.filter = new SignalFilter(); // Opcional, si SignalFilter tiene estado
    this.qualityModule.reset();
    this.heartRateDetector.reset();
    // this.signalValidator.resetFingerDetection(); // ELIMINADO
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    // ELIMINADOS ESTADOS DE DETECCIÓN DE DEDO
    // this.fingerDetectionConfirmed = false;
    // this.fingerDetectionStartTime = null;
    // this.rhythmBasedFingerDetection = false;
  }

  // MÉTODO processFrame ELIMINADO

}
