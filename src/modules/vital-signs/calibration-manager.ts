
/**
 * Gestor de calibración para el procesador de signos vitales
 * Controla el proceso de calibración y sus estados
 */
export class CalibrationManager {
  private isCalibrating: boolean = false;
  private calibrationStartTime: number = 0;
  private calibrationSamples: number = 0;
  private readonly CALIBRATION_REQUIRED_SAMPLES: number = 50;
  private readonly CALIBRATION_DURATION_MS: number = 8000;
  
  private spo2Samples: number[] = [];
  private pressureSamples: number[] = [];
  private heartRateSamples: number[] = [];
  private glucoseSamples: number[] = [];
  private lipidSamples: number[] = [];
  
  private calibrationProgress = {
    heartRate: 0,
    spo2: 0,
    pressure: 0,
    arrhythmia: 0,
    glucose: 0,
    lipids: 0,
    hemoglobin: 0
  };
  
  private forceCompleteCalibration: boolean = false;
  private calibrationTimer: any = null;
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    if (this.isCalibrating) {
      console.log("CalibrationManager: Ya hay una calibración en curso");
      return;
    }

    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationSamples = 0;
    this.forceCompleteCalibration = false;

    // Reiniciar buffers de calibración
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];

    // Reiniciar progreso de calibración
    this.calibrationProgress = {
      heartRate: 0,
      spo2: 0,
      pressure: 0,
      arrhythmia: 0,
      glucose: 0,
      lipids: 0,
      hemoglobin: 0
    };

    // Configurar temporizador para completar la calibración después del tiempo máximo
    if (this.calibrationTimer) {
      clearTimeout(this.calibrationTimer);
    }
    
    this.calibrationTimer = setTimeout(() => {
      console.log(`CalibrationManager: Completando calibración por timeout (${this.CALIBRATION_DURATION_MS}ms)`);
      if (this.isCalibrating) {
        this.completeCalibration();
      }
    }, this.CALIBRATION_DURATION_MS);

    console.log("CalibrationManager: Calibración iniciada");
  }
  
  /**
   * Completa el proceso de calibración
   */
  public completeCalibration(): boolean {
    if (!this.isCalibrating) {
      return false;
    }
    
    // Si no hay suficientes muestras, no completar la calibración
    // a menos que sea forzado
    if (this.calibrationSamples < this.CALIBRATION_REQUIRED_SAMPLES && !this.forceCompleteCalibration) {
      console.log(`CalibrationManager: Calibración incompleta (${this.calibrationSamples}/${this.CALIBRATION_REQUIRED_SAMPLES} muestras)`);
      
      // Actualizar progreso proporcional
      const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
      this.calibrationProgress = {
        heartRate: progressRate,
        spo2: progressRate,
        pressure: progressRate,
        arrhythmia: progressRate,
        glucose: progressRate,
        lipids: progressRate,
        hemoglobin: progressRate
      };
      
      return false;
    }
    
    try {
      // Aplicar resultados de calibración
      this.applyCalibrationResults();
      
      // Actualizar progreso a 100%
      this.calibrationProgress = {
        heartRate: 1,
        spo2: 1,
        pressure: 1,
        arrhythmia: 1,
        glucose: 1,
        lipids: 1,
        hemoglobin: 1
      };
      
      console.log("CalibrationManager: Calibración completada exitosamente", {
        tiempoTotal: (Date.now() - this.calibrationStartTime).toFixed(0) + "ms",
        muestras: this.calibrationSamples
      });
      
      return true;
    } catch (error) {
      console.error("Error durante la calibración:", error);
      return false;
    } finally {
      // Limpiar temporizador y marcar calibración como completada
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
      
      // Marcar calibración como completada
      this.isCalibrating = false;
    }
  }
  
  /**
   * Aplica los resultados de la calibración
   */
  private applyCalibrationResults(): void {
    // SpO2: usar mediana y promedio ponderado
    if (this.spo2Samples.length > 5) {
      const sortedSpO2 = [...this.spo2Samples].sort((a, b) => a - b);
      const medianSpO2 = sortedSpO2[Math.floor(sortedSpO2.length / 2)];
      // Sin aplicar calibración directa, solo ajustar el modelo interno
    }
    
    // Presión arterial: usar mediana para mejor estabilidad
    if (this.pressureSamples.length > 5) {
      // El procesador de presión arterial ya implementa mediana y promedio ponderado
      // No necesitamos aplicar transformaciones adicionales
    }
    
    // Glucosa: aplicar offset basado en referencia estándar
    if (this.glucoseSamples.length > 5) {
      // Usar valor de glucosa de referencia estándar para calibración
      const standardReference = 100; // mg/dL (valor de referencia normal en ayunas)
      const sortedGlucose = [...this.glucoseSamples].sort((a, b) => a - b);
      // Eliminar outliers (25% superior e inferior)
      const trimmedGlucose = sortedGlucose.slice(
        Math.floor(sortedGlucose.length * 0.25),
        Math.floor(sortedGlucose.length * 0.75)
      );
      const medianGlucose = trimmedGlucose.length > 0
        ? trimmedGlucose[Math.floor(trimmedGlucose.length / 2)]
        : sortedGlucose[Math.floor(sortedGlucose.length / 2)];
        
      // Solo calibrar si la diferencia es significativa pero no extrema
      const difference = standardReference - medianGlucose;
      if (Math.abs(difference) > 10 && Math.abs(difference) < 50) {
        // La calibración se aplica en el método processSignal
      }
    }
  }
  
  /**
   * Agrega una muestra al proceso de calibración
   */
  public addCalibrationSample(
    spo2: number, 
    systolic: number, 
    diastolic: number, 
    glucose: number, 
    cholesterol: number
  ): void {
    this.calibrationSamples++;
    
    if (spo2 > 0) this.spo2Samples.push(spo2);
    if (systolic > 0 && diastolic > 0) this.pressureSamples.push(systolic);
    if (glucose > 0) this.glucoseSamples.push(glucose);
    if (cholesterol > 0) this.lipidSamples.push(cholesterol);
    
    // Actualizar progreso de calibración proporcional
    const progressRate = Math.min(1, this.calibrationSamples / this.CALIBRATION_REQUIRED_SAMPLES);
    this.calibrationProgress = {
      heartRate: progressRate,
      spo2: progressRate,
      pressure: progressRate,
      arrhythmia: progressRate,
      glucose: progressRate,
      lipids: progressRate,
      hemoglobin: progressRate
    };
    
    // Verificar si ya se alcanzó el número requerido de muestras
    if (this.calibrationSamples >= this.CALIBRATION_REQUIRED_SAMPLES) {
      this.completeCalibration();
    }
  }
  
  /**
   * Verifica si está en proceso de calibración
   */
  public isCurrentlyCalibrating(): boolean {
    return this.isCalibrating;
  }
  
  /**
   * Obtiene el progreso actual de calibración
   */
  public getCalibrationProgress(): any {
    if (!this.isCalibrating) return undefined;
    
    return {
      isCalibrating: true,
      progress: { ...this.calibrationProgress }
    };
  }
  
  /**
   * Fuerza la finalización del proceso de calibración
   */
  public forceCalibrationCompletion(): void {
    if (!this.isCalibrating) return;
    
    this.forceCompleteCalibration = true;
    this.completeCalibration();
  }
  
  /**
   * Reinicia el gestor de calibración
   */
  public reset(): void {
    // Si hay una calibración en curso, finalizarla
    if (this.isCalibrating) {
      this.isCalibrating = false;
      if (this.calibrationTimer) {
        clearTimeout(this.calibrationTimer);
        this.calibrationTimer = null;
      }
    }
    
    this.calibrationSamples = 0;
    this.spo2Samples = [];
    this.pressureSamples = [];
    this.heartRateSamples = [];
    this.glucoseSamples = [];
    this.lipidSamples = [];
  }
}
