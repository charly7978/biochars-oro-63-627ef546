
import { supabase } from '@/integrations/supabase/client';
import { MeasurementData } from './IntelligentCalibrationSystem';
import { TensorFlowModelRegistry } from '../neural/tensorflow/TensorFlowModelRegistry';
import { TensorUtils } from '../neural/tensorflow/TensorAdapter';

interface CalibrationState {
  systolic: number;
  diastolic: number;
  heartRate: number;
  spo2: number;
  glucose: number;
  timestamp: number;
  quality: number;
}

export class CalibrationManager {
  private static instance: CalibrationManager;
  private userId: string;
  private lastCalibrationData: CalibrationState | null = null;
  private modelRegistry: TensorFlowModelRegistry;
  private readonly MIN_QUALITY_THRESHOLD = 75;

  constructor(userId: string) {
    this.userId = userId;
    this.modelRegistry = TensorFlowModelRegistry.getInstance();
    this.initializeCalibration();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(userId: string): CalibrationManager {
    if (!CalibrationManager.instance) {
      CalibrationManager.instance = new CalibrationManager(userId);
    }
    return CalibrationManager.instance;
  }

  /**
   * Initialize calibration system
   */
  private initializeCalibration(): void {
    console.log('Initializing calibration system for user', this.userId);
    // Load previous calibration data
    this.loadLatestCalibration().then(data => {
      if (data) {
        this.lastCalibrationData = data;
        this.updateModelsFromCalibration(data);
      }
    });
  }

  public async saveCalibration(data: MeasurementData): Promise<boolean> {
    if (data.quality < this.MIN_QUALITY_THRESHOLD) {
      console.warn('Calibración rechazada: calidad de señal baja');
      return false;
    }

    const record: CalibrationState = {
      systolic: data.systolic,
      diastolic: data.diastolic,
      heartRate: data.heartRate,
      spo2: data.spo2,
      glucose: data.glucose,
      quality: data.quality,
      timestamp: Date.now()
    };

    const { error } = await supabase
      .from('calibration_records')
      .insert([{ 
        user_id: this.userId,
        systolic: record.systolic, 
        diastolic: record.diastolic, 
        heart_rate: record.heartRate, 
        spo2: record.spo2, 
        glucose: record.glucose, 
        quality: record.quality, 
        timestamp: record.timestamp 
      }]);

    if (error) {
      console.error('Error al guardar calibración:', error);
      return false;
    }

    // Update models with new calibration data
    this.lastCalibrationData = record;
    this.updateModelsFromCalibration(record);

    return true;
  }

  public async loadLatestCalibration(): Promise<CalibrationState | null> {
    const { data, error } = await supabase
      .from('calibration_records')
      .select('*')
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      console.warn('No se encontraron datos de calibración previos');
      return null;
    }

    return {
      systolic: data[0].systolic,
      diastolic: data[0].diastolic,
      heartRate: data[0].heart_rate,
      spo2: data[0].spo2,
      glucose: data[0].glucose,
      quality: data[0].quality,
      timestamp: data[0].timestamp
    };
  }

  public async getCalibrationHistory(limit = 5): Promise<CalibrationState[]> {
    const { data, error } = await supabase
      .from('calibration_records')
      .select('*')
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(record => ({
      systolic: record.systolic,
      diastolic: record.diastolic,
      heartRate: record.heart_rate,
      spo2: record.spo2,
      glucose: record.glucose,
      quality: record.quality,
      timestamp: record.timestamp
    }));
  }

  /**
   * Updates models with calibration data
   */
  private updateModelsFromCalibration(calibrationData: CalibrationState): void {
    console.log('Updating models with calibration data', calibrationData);
    
    // Get all models
    const models = this.modelRegistry.getAllModels();
    
    // Apply calibration to each model that supports it
    for (const [id, model] of models.entries()) {
      if (model && typeof model.setCalibrationFactor === 'function') {
        // Apply model-specific calibration
        if (id === 'heartRate' && calibrationData.heartRate > 0) {
          model.setCalibrationFactor({ heartRate: calibrationData.heartRate });
        } else if (id === 'spo2' && calibrationData.spo2 > 0) {
          model.setCalibrationFactor({ spo2: calibrationData.spo2 });
        } else if (id === 'bloodPressure' && calibrationData.systolic > 0) {
          model.setCalibrationFactor({ 
            systolic: calibrationData.systolic,
            diastolic: calibrationData.diastolic
          });
        } else if (id === 'glucose' && calibrationData.glucose > 0) {
          model.setCalibrationFactor({ glucose: calibrationData.glucose });
        }
      }
    }
  }

  /**
   * Process a measurement with calibration applied
   */
  public processMeasurement(data: any): any {
    // Copy input data
    const result = { ...data };
    
    // Apply calibration factors if available
    if (this.lastCalibrationData) {
      // Apply normalized calibration factors based on the last calibration
      // Simple example - in production this would use more sophisticated methods
      if (data.heartRate && this.lastCalibrationData.heartRate) {
        const correctionFactor = this.lastCalibrationData.quality / 100;
        result.heartRate = this.applyCalibration(data.heartRate, this.lastCalibrationData.heartRate, correctionFactor);
      }
      
      if (data.spo2 && this.lastCalibrationData.spo2) {
        const correctionFactor = this.lastCalibrationData.quality / 100;
        result.spo2 = this.applyCalibration(data.spo2, this.lastCalibrationData.spo2, correctionFactor);
      }
      
      // Apply other calibrations for blood pressure, glucose, etc.
    }
    
    return result;
  }
  
  /**
   * Apply calibration to a value using a reference and correction factor
   */
  private applyCalibration(value: number, reference: number, factor: number): number {
    // Simple weighted average between measurement and reference
    // In production, this would use more sophisticated methods
    return value * (1 - factor * 0.3) + reference * (factor * 0.3);
  }
}
