/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Tipos centrales utilizados en toda la aplicación.
 * Definiciones canónicas para evitar duplicidad.
 */

// --- Tipos Relacionados con Frecuencia Cardíaca y RR ---

/**
 * Datos de intervalos RR extraídos de la detección de picos.
 */
export interface RRIntervalData {
  intervals: number[]; // Array de duraciones de intervalos RR en milisegundos.
  lastPeakTime: number | null; // Timestamp del último pico detectado.
}

/**
 * Resultado del procesamiento de la señal de latido cardíaco.
 */
export interface HeartBeatResult {
  bpm: number; // Latidos por minuto calculados.
  confidence: number; // Nivel de confianza de la medición de BPM (0-1).
  isPeak: boolean; // Indica si el punto de datos actual corresponde a un pico detectado.
  filteredValue?: number; // Valor de la señal filtrada en este punto (opcional, para gráficos).
  arrhythmiaCount: number; // Contador de eventos de arritmia detectados.
  isArrhythmia?: boolean; // Indica si se detectó una arritmia en el análisis más reciente (opcional).
  rrData?: RRIntervalData; // Datos de intervalos RR asociados (opcional).
  lowSignal?: boolean; // Indica si la señal es débil (opcional)
}

/**
 * Resultado del análisis de variabilidad RR.
 */
export interface RRAnalysisResult {
  rmssd: number; // Raíz cuadrada media de las diferencias sucesivas (ms).
  rrVariation: number; // Variación relativa del intervalo RR (%).
  timestamp: number; // Timestamp del análisis.
  isArrhythmia: boolean; // Si se detectó arritmia basada en esta análisis.
}

/**
 * Resultado del procesamiento específico de arritmias.
 */
export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string; // Estado descriptivo ('normal', 'possible-arrhythmia', etc.).
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null; // Datos detallados del último evento de arritmia.
}


// --- Tipos Relacionados con Señal PPG ---

/**
 * Representa un punto de datos de la señal PPG procesada.
 */
export interface ProcessedSignal {
  timestamp: number;        // Marca de tiempo de la señal
  rawValue: number;         // Valor crudo del sensor
  filteredValue: number;    // Valor filtrado para análisis
  quality: number;          // Calidad de la señal (0-100)
  fingerDetected: boolean;  // Si se detecta un dedo sobre el sensor
  roi?: {                    // Región de interés en la imagen (opcional)
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perfusionIndex?: number;  // Índice de perfusión opcional (%)
  spectrumData?: {          // Datos del espectro de frecuencia (opcional)
    frequencies: number[];
    amplitudes: number[];
    dominantFrequency: number;
  };
  value?: number;           // Compatibilidad con código existente (opcional)
  hydrationIndex?: number;  // Índice de hidratación (opcional)
}

/**
 * Representa un error durante el procesamiento de la señal.
 */
export interface ProcessingError {
  code: string;       // Código de error
  message: string;    // Mensaje descriptivo
  timestamp: number;  // Marca de tiempo del error
}

// --- Tipos Relacionados con Signos Vitales Múltiples ---

/**
 * Estructura del resultado completo de la medición de signos vitales.
 */
export interface VitalSignsResult {
  spo2: number; // Saturación de oxígeno en sangre (%)
  pressure: string; // Presión arterial en formato "sistólica/diastólica" (mmHg)
  arrhythmiaStatus: string; // Estado de detección de arritmia
  glucose: number; // Nivel de glucosa en sangre (mg/dL)
  lipids: {
    totalCholesterol: number; // Colesterol total (mg/dL)
    triglycerides: number; // Triglicéridos (mg/dL)
  };
  hemoglobin: number; // Nivel de hemoglobina (g/dL)
  hydration: number; // Nivel de hidratación (%)

  // Confianzas individuales y generales (opcionales)
  glucoseConfidence?: number;
  lipidsConfidence?: number;
  // Añadir más confianzas si otros estimadores las proporcionan (ej. spo2Confidence, bpConfidence)
  overallConfidence?: number;

  // Información del último evento de arritmia detectado (opcional)
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

// --- Tipos de Perfil y Configuración ---

/**
 * Perfil del usuario con información relevante para el análisis.
 */
export interface UserProfile {
  age: number; // Edad en años.
  gender?: 'male' | 'female' | 'unknown'; // Género (opcional).
  height?: number; // Altura en cm (opcional).
  weight?: number; // Peso en kg (opcional).
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'; // Nivel de actividad (opcional).
  medicalConditions?: string[]; // Condiciones médicas preexistentes (opcional).
  smokingStatus?: 'non_smoker' | 'former_smoker' | 'smoker'; // Estado de tabaquismo (opcional).
  ethnicity?: string; // Etnia (opcional).
}

// --- Otros Tipos ---

/**
 * Representa un punto de datos genérico con tiempo y valor.
 * Útil para buffers circulares u otros almacenamientos de series temporales.
 */
export interface DataPoint {
  time: number;
  value: number;
}
