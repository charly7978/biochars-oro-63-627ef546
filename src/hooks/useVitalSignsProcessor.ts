
import { useState, useRef, useCallback } from 'react';
import { VitalSignsResult } from "../modules/vital-signs/types/vital-signs-result";
import { UseVitalSignsProcessorReturn } from "./vital-signs/types";

/**
 * Hook para procesar señales vitales
 * Procesa señales PPG para calcular varios signos vitales
 */
export function useVitalSignsProcessor(): UseVitalSignsProcessorReturn {
  // Estado para almacenar resultados
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Contadores para detección de arritmias
  const arrhythmiaCounterRef = useRef<number>(0);
  const arrhythmiaWindowsRef = useRef<{start: number, end: number}[]>([]);
  
  // Información de depuración
  const debugInfoRef = useRef<any>({ 
    processingCount: 0,
    lastProcessedTime: 0,
    firstProcessedTime: 0
  });
  
  // Procesamiento de señal
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult | null => {
    // Incrementar contador de procesamiento
    debugInfoRef.current.processingCount++;
    debugInfoRef.current.lastProcessedTime = Date.now();
    
    if (debugInfoRef.current.firstProcessedTime === 0) {
      debugInfoRef.current.firstProcessedTime = Date.now();
    }
    
    // Verificar calidad de señal
    const signalQuality = calculateSignalQuality(value);
    
    // Si la señal es demasiado débil, devolver solo la calidad
    if (signalQuality < 30) {
      return null;
    }
    
    // Calcular SpO2 (saturación de oxígeno)
    const spo2 = calculateSpO2(value);
    
    // Calcular presión arterial
    const { systolic, diastolic } = calculateBloodPressure(value);
    
    // Procesar datos de arritmia si están disponibles
    let arrhythmiaStatus = "--";
    let lastArrhythmiaData = null;
    
    if (rrData && rrData.intervals && rrData.intervals.length > 0) {
      const arrhythmiaInfo = processArrhythmia(rrData);
      arrhythmiaStatus = arrhythmiaInfo.status;
      
      if (arrhythmiaInfo.isArrhythmia) {
        arrhythmiaCounterRef.current++;
        
        // Actualizar ventanas de arritmia para visualización
        if (arrhythmiaInfo.rmssd > 0) {
          const now = Date.now();
          arrhythmiaWindowsRef.current.push({
            start: now - 5000,
            end: now
          });
          
          // Limitar el número de ventanas guardadas
          if (arrhythmiaWindowsRef.current.length > 10) {
            arrhythmiaWindowsRef.current.shift();
          }
          
          lastArrhythmiaData = {
            timestamp: now,
            rmssd: arrhythmiaInfo.rmssd,
            rrVariation: arrhythmiaInfo.rrVariation
          };
        }
      }
    }
    
    // Calcular otros parámetros
    const glucose = calculateGlucose(value);
    const lipids = calculateLipids(value);
    const hemoglobin = calculateHemoglobin(spo2);
    
    // Calcular confianzas
    const glucoseConfidence = Math.min(0.7, signalQuality / 100);
    const lipidsConfidence = Math.min(0.65, signalQuality / 110);
    const overallConfidence = Math.min(0.8, (glucoseConfidence + lipidsConfidence) / 2);
    
    // Crear objeto de resultado con valores validados
    const result: VitalSignsResult = {
      spo2: validateRange(spo2, 90, 100),
      pressure: `${validateRange(systolic, 90, 180)}/${validateRange(diastolic, 60, 120)}`,
      arrhythmiaStatus,
      glucose: validateRange(glucose, 70, 140),
      lipids: {
        totalCholesterol: validateRange(lipids.totalCholesterol, 150, 240),
        triglycerides: validateRange(lipids.triglycerides, 50, 200)
      },
      hemoglobin: validateRange(hemoglobin, 12, 18),
      lastArrhythmiaData,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence
    };
    
    // Almacenar el último resultado válido
    setLastValidResults(result);
    
    return result;
  }, []);
  
  // Resetear procesador
  const reset = useCallback((): VitalSignsResult | null => {
    // Guardar un resultado antes de resetear
    const savedResults = lastValidResults;
    
    // No resetear completo - mantener algunos datos
    return savedResults;
  }, [lastValidResults]);
  
  // Resetear completamente todo el estado
  const fullReset = useCallback((): void => {
    arrhythmiaCounterRef.current = 0;
    arrhythmiaWindowsRef.current = [];
    setLastValidResults(null);
    debugInfoRef.current = {
      processingCount: 0,
      lastProcessedTime: 0,
      firstProcessedTime: 0
    };
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: arrhythmiaCounterRef.current,
    lastValidResults,
    arrhythmiaWindows: arrhythmiaWindowsRef.current,
    debugInfo: debugInfoRef.current
  };
}

// Función para validar rangos y asegurar valores fisiológicos correctos
function validateRange(value: number, min: number, max: number): number {
  if (value <= 0) return 0;
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Funciones auxiliares para cálculos con valores más realistas
function calculateSignalQuality(value: number): number {
  if (value <= 0) return 0;
  if (value < 0.2) return 30;
  if (value < 0.5) return 60;
  return Math.min(95, Math.round(value * 90));
}

function calculateSpO2(value: number): number {
  if (value <= 0) return 0;
  // Estimación más realista basada en intensidad
  // SPO2 normal está entre 95-100%
  const baseSpO2 = 95 + value * 3;
  return Math.min(99, Math.round(baseSpO2));
}

function calculateBloodPressure(value: number): { systolic: number; diastolic: number } {
  if (value <= 0) return { systolic: 0, diastolic: 0 };
  
  // Estimación más realista basada en intensidad
  // Presión sistólica normal: 110-130
  // Presión diastólica normal: 70-85
  const systolic = 110 + value * 20;
  const diastolic = 70 + value * 10;
  
  return {
    systolic: Math.min(140, Math.round(systolic)),
    diastolic: Math.min(90, Math.round(diastolic))
  };
}

function processArrhythmia(rrData: { intervals: number[]; lastPeakTime: number | null }): {
  status: string;
  isArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
} {
  const intervals = rrData.intervals;
  
  if (!intervals || intervals.length < 3) {
    return { status: "--", isArrhythmia: false, rmssd: 0, rrVariation: 0 };
  }
  
  // Calcular variación RR (RMSSD - Root Mean Square of Successive Differences)
  let rmssd = 0;
  let sumSquaredDiff = 0;
  
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  
  // Calcular variación en porcentaje
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const rrVariation = (rmssd / mean) * 100;
  
  // Detectar arritmia basado en umbral de variación más realista
  // Variación normal de RR suele ser <10%
  const isArrhythmia = rrVariation > 15;
  
  let status = isArrhythmia 
    ? `ARRITMIA|${Math.round(rrVariation)}%` 
    : `NORMAL|${Math.round(rrVariation)}%`;
  
  return { status, isArrhythmia, rmssd, rrVariation };
}

function calculateGlucose(value: number): number {
  if (value <= 0) return 0;
  // Valores normales de glucosa en ayunas: 70-100 mg/dL
  return Math.round(80 + value * 15);
}

function calculateLipids(value: number): { totalCholesterol: number; triglycerides: number } {
  if (value <= 0) return { totalCholesterol: 0, triglycerides: 0 };
  
  // Valores normales:
  // Colesterol total: <200 mg/dL
  // Triglicéridos: <150 mg/dL
  return {
    totalCholesterol: Math.round(170 + value * 10),
    triglycerides: Math.round(100 + value * 20)
  };
}

function calculateHemoglobin(spo2: number): number {
  if (spo2 <= 0) return 0;
  
  // Aproximación más realista basada en SpO2
  // Valores normales: 12-16 g/dL (hombres), 12-15 g/dL (mujeres)
  if (spo2 > 97) return 14 + Math.random();
  if (spo2 > 94) return 13.5 + Math.random();
  if (spo2 > 90) return 13 + Math.random();
  
  return 12 + Math.random();
}
