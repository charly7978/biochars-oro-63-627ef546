
import { supabase } from '@/integrations/supabase/client';
import { MeasurementData } from './IntelligentCalibrationSystem';

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
  private userId: string;
  private readonly MIN_QUALITY_THRESHOLD = 75;

  constructor(userId: string) {
    this.userId = userId;
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
}
