
import type { CalibrationProgress } from '../types/AdvancedProcessorTypes';

/**
 * Servicio para gestionar la calibración del procesador avanzado
 */
export class CalibrationService {
  private calibrating: boolean = false;
  private calibrationProgress: CalibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  };

  /**
   * Actualiza el progreso de calibración
   */
  public updateCalibration(): boolean {
    if (!this.calibrating) return false;
    
    const increment = 0.02;
    this.calibrationProgress.heartRate += increment;
    this.calibrationProgress.spo2 += increment;
    this.calibrationProgress.pressure += increment;
    this.calibrationProgress.arrhythmia += increment;
    this.calibrationProgress.glucose += increment;
    this.calibrationProgress.lipids += increment;
    this.calibrationProgress.hemoglobin += increment;
    
    if (this.calibrationProgress.heartRate >= 1) {
      this.calibrating = false;
      
      // Reiniciar progreso de calibración
      Object.keys(this.calibrationProgress).forEach(key => {
        this.calibrationProgress[key as keyof CalibrationProgress] = 0;
      });
      
      console.log('Calibración completada');
      return true;
    }
    
    return false;
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    this.calibrating = true;
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof CalibrationProgress] = 0;
    });
    console.log('Iniciando calibración avanzada');
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
  public getCalibrationState(): { isCalibrating: boolean; progress: CalibrationProgress } {
    return {
      isCalibrating: this.calibrating,
      progress: this.calibrationProgress
    };
  }
  
  /**
   * Restablece el estado de calibración
   */
  public reset(): void {
    this.calibrating = false;
    Object.keys(this.calibrationProgress).forEach(key => {
      this.calibrationProgress[key as keyof CalibrationProgress] = 0;
    });
  }
}
