
/**
 * Almacén de calibraciones para diferentes procesadores
 * Cada procesador puede acceder a sus propios datos de calibración
 */

// Tipos de calibración
export interface SpO2Calibration {
  calibrationFactor: number;
  lastUpdated: number;
}

export interface BloodPressureCalibration {
  systolicOffset: number;
  diastolicOffset: number;
  lastUpdated: number;
  manualReference?: {
    systolic: number;
    diastolic: number;
  };
}

export interface GlucoseCalibration {
  offsetFactor: number;
  baselineReference: number;
  lastUpdated: number;
}

export interface LipidCalibration {
  cholesterolFactor: number;
  triglyceridesFactor: number;
  lastUpdated: number;
}

export interface HemoglobinCalibration {
  baseHemoglobin: number;
  offsetFactor: number;
  lastUpdated: number;
}

/**
 * Almacén para las calibraciones de los diferentes procesadores
 * Cada procesador tiene su propia sección de calibración independiente
 */
export class CalibrationStore {
  private static instance: CalibrationStore;
  
  // Datos de calibración para cada procesador (manteniéndolos separados)
  private spo2Calibration: SpO2Calibration = {
    calibrationFactor: 1.02,
    lastUpdated: 0
  };
  
  private bpCalibration: BloodPressureCalibration = {
    systolicOffset: 0,
    diastolicOffset: 0,
    lastUpdated: 0
  };
  
  private glucoseCalibration: GlucoseCalibration = {
    offsetFactor: 0,
    baselineReference: 100, // mg/dL (valor normal en ayunas)
    lastUpdated: 0
  };
  
  private lipidCalibration: LipidCalibration = {
    cholesterolFactor: 1.0,
    triglyceridesFactor: 0.8,
    lastUpdated: 0
  };
  
  private hemoglobinCalibration: HemoglobinCalibration = {
    baseHemoglobin: 14.5,
    offsetFactor: 1.0,
    lastUpdated: 0
  };
  
  // Constructor privado para patrón Singleton
  private constructor() {}
  
  /**
   * Obtiene la instancia del almacén de calibraciones
   */
  public static getInstance(): CalibrationStore {
    if (!CalibrationStore.instance) {
      CalibrationStore.instance = new CalibrationStore();
    }
    return CalibrationStore.instance;
  }
  
  // Métodos para SpO2
  public getSpO2Calibration(): SpO2Calibration {
    return { ...this.spo2Calibration };
  }
  
  public updateSpO2Calibration(calibration: Partial<SpO2Calibration>): void {
    this.spo2Calibration = {
      ...this.spo2Calibration,
      ...calibration,
      lastUpdated: Date.now()
    };
  }
  
  // Métodos para presión arterial
  public getBloodPressureCalibration(): BloodPressureCalibration {
    return { ...this.bpCalibration };
  }
  
  public updateBloodPressureCalibration(calibration: Partial<BloodPressureCalibration>): void {
    this.bpCalibration = {
      ...this.bpCalibration,
      ...calibration,
      lastUpdated: Date.now()
    };
  }
  
  // Métodos para glucosa
  public getGlucoseCalibration(): GlucoseCalibration {
    return { ...this.glucoseCalibration };
  }
  
  public updateGlucoseCalibration(calibration: Partial<GlucoseCalibration>): void {
    this.glucoseCalibration = {
      ...this.glucoseCalibration,
      ...calibration,
      lastUpdated: Date.now()
    };
  }
  
  // Métodos para lípidos
  public getLipidCalibration(): LipidCalibration {
    return { ...this.lipidCalibration };
  }
  
  public updateLipidCalibration(calibration: Partial<LipidCalibration>): void {
    this.lipidCalibration = {
      ...this.lipidCalibration,
      ...calibration,
      lastUpdated: Date.now()
    };
  }
  
  // Métodos para hemoglobina
  public getHemoglobinCalibration(): HemoglobinCalibration {
    return { ...this.hemoglobinCalibration };
  }
  
  public updateHemoglobinCalibration(calibration: Partial<HemoglobinCalibration>): void {
    this.hemoglobinCalibration = {
      ...this.hemoglobinCalibration,
      ...calibration,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reinicia todas las calibraciones a sus valores predeterminados
   */
  public resetAllCalibrations(): void {
    this.spo2Calibration = {
      calibrationFactor: 1.02,
      lastUpdated: 0
    };
    
    this.bpCalibration = {
      systolicOffset: 0,
      diastolicOffset: 0,
      lastUpdated: 0
    };
    
    this.glucoseCalibration = {
      offsetFactor: 0,
      baselineReference: 100,
      lastUpdated: 0
    };
    
    this.lipidCalibration = {
      cholesterolFactor: 1.0,
      triglyceridesFactor: 0.8,
      lastUpdated: 0
    };
    
    this.hemoglobinCalibration = {
      baseHemoglobin: 14.5,
      offsetFactor: 1.0,
      lastUpdated: 0
    };
  }
}
