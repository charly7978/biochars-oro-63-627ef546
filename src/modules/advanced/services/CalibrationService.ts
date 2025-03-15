
import type { CalibrationProgress } from '../types/AdvancedProcessorTypes';

/**
 * Servicio para gestionar la calibración del procesador avanzado
 * Versión mejorada con validación estricta
 */
export class CalibrationService {
  private calibrating: boolean = false;
  private fingerDetected: boolean = false;
  private consecutiveFingerDetections: number = 0;
  private readonly MIN_CONSECUTIVE_DETECTIONS = 5;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT_MS = 2000;
  
  private calibrationProgress: CalibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0,
    atrialFibrillation: 0
  };

  /**
   * Actualiza el progreso de calibración
   * La calibración solo avanza con detección de dedo consistente
   */
  public updateCalibration(): boolean {
    if (!this.calibrating) return false;
    
    // Validación estricta: verificar si el dedo sigue detectado
    const now = Date.now();
    if (!this.fingerDetected || now - this.lastDetectionTime > this.DETECTION_TIMEOUT_MS) {
      console.log('Calibración: Dedo no detectado o timeout, pausando calibración');
      return false;
    }
    
    const increment = 0.02;
    this.calibrationProgress.heartRate += increment;
    this.calibrationProgress.spo2 += increment;
    this.calibrationProgress.pressure += increment;
    this.calibrationProgress.arrhythmia += increment;
    this.calibrationProgress.glucose += increment;
    this.calibrationProgress.lipids += increment;
    this.calibrationProgress.hemoglobin += increment;
    this.calibrationProgress.atrialFibrillation += increment;
    
    if (this.calibrationProgress.heartRate >= 1) {
      this.calibrating = false;
      
      // Reiniciar progreso de calibración
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key as keyof CalibrationProgress] = 0;
      });
      
      console.log('Calibración completada exitosamente');
      return true;
    }
    
    return false;
  }
  
  /**
   * Actualiza el estado de detección de dedo con validación robusta
   */
  public updateFingerDetection(isFingerDetected: boolean): void {
    const now = Date.now();
    
    // Si cambia el estado de detección de dedo, registrar en consola
    if (this.fingerDetected !== isFingerDetected) {
      console.log(`Calibración: ${isFingerDetected ? 'Dedo detectado' : 'Dedo removido'}`);
    }
    
    // Implementación robusta contra falsos positivos
    if (isFingerDetected) {
      this.lastDetectionTime = now;
      this.consecutiveFingerDetections++;
      
      // Solo confirmar detección después de suficientes frames consecutivos
      if (this.consecutiveFingerDetections >= this.MIN_CONSECUTIVE_DETECTIONS) {
        this.fingerDetected = true;
      }
    } else {
      // Resetear rápidamente cuando no hay detección
      this.consecutiveFingerDetections = 0;
      this.fingerDetected = false;
      
      // Si se quita el dedo durante la calibración, pausarla
      if (this.calibrating) {
        console.log('Calibración pausada - No hay dedo detectado');
      }
    }
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    this.calibrating = true;
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof CalibrationProgress] = 0;
    });
    console.log('Iniciando calibración avanzada con validación estricta');
  }
  
  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    if (this.calibrating) {
      this.calibrating = false;
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key as keyof CalibrationProgress] = 0;
      });
      
      console.log('Calibración forzada a finalizar');
    }
  }
  
  /**
   * Obtiene el estado actual de calibración
   */
  public getCalibrationState(): { isCalibrating: boolean; progress: CalibrationProgress; fingerDetected: boolean } {
    return {
      isCalibrating: this.calibrating,
      progress: this.calibrationProgress,
      fingerDetected: this.fingerDetected
    };
  }
  
  /**
   * Verifica si hay un dedo detectado bajo criterios estrictos
   */
  public isFingerDetected(): boolean {
    const now = Date.now();
    
    // Implementar timeout de detección para mayor robustez
    if (now - this.lastDetectionTime > this.DETECTION_TIMEOUT_MS) {
      if (this.fingerDetected) {
        console.log('Calibración: Timeout de detección de dedo');
        this.fingerDetected = false;
      }
      return false;
    }
    
    return this.fingerDetected;
  }
  
  /**
   * Restablece el estado de calibración
   */
  public reset(): void {
    this.calibrating = false;
    this.fingerDetected = false;
    this.consecutiveFingerDetections = 0;
    this.lastDetectionTime = 0;
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof CalibrationProgress] = 0;
    });
  }
}
