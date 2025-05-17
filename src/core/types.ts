
/**
 * Resultado del procesamiento de latidos cardíacos
 */
export interface HeartBeatResult {
  /** Latidos por minuto */
  bpm: number;
  /** Confianza en la medición (0-1) */
  confidence: number;
  /** Indica si se detectó una arritmia */
  isArrhythmia: boolean;
  /** Contador de arritmias detectadas */
  arrhythmiaCount: number;
  /** Tiempo de la medición */
  time: number;
}

export interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex: number;
}

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Perfil del usuario para calibración personalizada de algoritmos
 */
export interface UserProfile {
  id: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: 'male' | 'female' | 'other';
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
  hasHeartCondition?: boolean;
  bloodPressureCalibration?: {
    systolic: number;
    diastolic: number;
    timestamp: number;
  };
}

