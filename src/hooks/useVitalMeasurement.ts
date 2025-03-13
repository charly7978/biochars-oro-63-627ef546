
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number;
  hemoglobin: number;
  lipids: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0,
    hemoglobin: 0,
    lipids: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9) // Identificador único para esta sesión
    });

    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones por detención', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements(prev => {
        const newValues = {
          ...prev,
          heartRate: 0,
          spo2: 0,
          pressure: "--/--",
          arrhythmiaCount: "--",
          glucose: 0,
          hemoglobin: 0,
          lipids: 0
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000;

    const updateMeasurements = () => {
      const processor = (window as any).heartBeatProcessor;
      const vitalSignsProcessor = (window as any).vitalSignsProcessor;
      
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Optimización: Aumentar la frecuencia de muestreo para captura ultra-precisa
      // Obtener datos del procesador heartBeat con máxima prioridad para el BPM
      let bpm = processor.getFinalBPM() || 0;
      
      // Optimización avanzada para estabilidad de BPM
      // Si el BPM es bajo, inestable o tiene variaciones abruptas, usar análisis multimodo
      if ((bpm < 45 || bpm > 180) && processor.getRRIntervals) {
        const rrData = processor.getRRIntervals();
        if (rrData && rrData.intervals && rrData.intervals.length > 0) {
          // Método 1: Análisis de intervalos recientes con peso adaptativo
          const recentIntervals = rrData.intervals.slice(-5); // Aumentado a 5 intervalos para mejor promedio
          if (recentIntervals.length > 0) {
            // Filtrar valores atípicos usando desviación media absoluta
            const medianInterval = recentIntervals.sort((a, b) => a - b)[Math.floor(recentIntervals.length / 2)];
            const validIntervals = recentIntervals.filter(interval => {
              const deviation = Math.abs(interval - medianInterval);
              return deviation < medianInterval * 0.3; // Tolerancia del 30%
            });
            
            if (validIntervals.length > 0) {
              const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
              if (avgInterval > 0) {
                const instantBpm = Math.round(60000 / avgInterval);
                if (instantBpm >= 40 && instantBpm <= 200) {
                  // Transición suave para BPM
                  bpm = bpm > 0 ? Math.round((instantBpm * 0.7) + (bpm * 0.3)) : instantBpm;
                  console.log('useVitalMeasurement - Usando BPM multimodo estabilizado:', {
                    instantBpm,
                    finalBpm: bpm,
                    intervalsFiltrados: validIntervals,
                    intervalsTotales: recentIntervals.length,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            }
          }
        }
      }
      
      // Verificación avanzada de confianza con histéresis
      let confidence = 0;
      if (processor.getConfidence) {
        confidence = processor.getConfidence();
        
        // Sistema de histéresis para evitar fluctuaciones rápidas en baja confianza
        if (confidence < 0.4 && bpm > 0) {
          // Preservar BPM anterior en caso de baja confianza momentánea
          const prevBPM = measurements.heartRate;
          if (prevBPM > 40 && prevBPM < 180) {
            // Combinar con valor actual usando peso proporcional a la confianza
            const blendFactor = Math.max(0.2, confidence); // Mínimo 20% del valor actual
            bpm = Math.round((prevBPM * (1 - blendFactor)) + (bpm * blendFactor));
            
            console.log('useVitalMeasurement - Aplicando estabilización por histéresis:', {
              prevBPM,
              rawBPM: processor.getFinalBPM(),
              confidence,
              blendFactor,
              resultBPM: bpm,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // Obtener valores reales de los procesadores biométricos solo si están disponibles
      let spo2Value = 0;
      let systolic = 0;
      let diastolic = 0;
      let glucose = 0;
      let hemoglobin = 0;
      let lipids = 0;
      
      // Usar datos reales del procesador de signos vitales si está disponible
      if (vitalSignsProcessor) {
        const vitalSigns = vitalSignsProcessor.getLastValidResults();
        if (vitalSigns) {
          spo2Value = vitalSigns.spo2 || 0;
          
          // Obtener presión arterial
          if (vitalSigns.pressure && vitalSigns.pressure !== "--/--") {
            const pressureParts = vitalSigns.pressure.split('/');
            if (pressureParts.length === 2) {
              systolic = parseInt(pressureParts[0], 10);
              diastolic = parseInt(pressureParts[1], 10);
            }
          }
          
          // Obtener valores metabólicos
          glucose = vitalSigns.glucose || 0;
          hemoglobin = vitalSigns.hemoglobin || 0;
          
          // Obtener lípidos
          if (vitalSigns.lipids) {
            lipids = vitalSigns.lipids.totalCholesterol || 0;
          }
        }
      }
      
      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        vitalSignsProcessor: !!vitalSignsProcessor,
        processorType: processor ? typeof processor : 'undefined',
        processorMethods: processor ? Object.getOwnPropertyNames(processor.__proto__) : [],
        bpm,
        rawBPM: processor.getFinalBPM(),
        confidence: confidence,
        spo2: spo2Value,
        pressure: systolic && diastolic ? `${systolic}/${diastolic}` : "--/--",
        glucose,
        hemoglobin,
        lipids,
        timestamp: new Date().toISOString()
      });

      setMeasurements(prev => {
        // Algoritmo mejorado de actualización para mayor estabilidad
        // Permitir pequeñas variaciones en BPM sin actualización completa
        const bpmDelta = Math.abs(prev.heartRate - bpm);
        const smallBpmChange = bpm > 0 && prev.heartRate > 0 && bpmDelta <= 2;
        
        if (smallBpmChange && 
            prev.spo2 === spo2Value && spo2Value !== 0 &&
            prev.glucose === glucose && glucose !== 0 &&
            prev.hemoglobin === hemoglobin && hemoglobin !== 0 &&
            prev.lipids === lipids && lipids !== 0) {
          
          console.log('useVitalMeasurement - Valores estables, manteniendo medición actual', {
            currentValues: prev,
            smallBpmDelta: bpmDelta,
            timestamp: new Date().toISOString()
          });
          return prev;
        }
        
        // Obtener el recuento de arritmias del procesador específico si existe
        let arrhythmiaCount = 0;
        if (vitalSignsProcessor && vitalSignsProcessor.getArrhythmiaCount) {
          arrhythmiaCount = vitalSignsProcessor.getArrhythmiaCount();
        }
        
        const newValues = {
          ...prev,
          heartRate: bpm,
          spo2: spo2Value,
          pressure: systolic && diastolic ? `${systolic}/${diastolic}` : "--/--",
          arrhythmiaCount: arrhythmiaCount,
          glucose: glucose,
          hemoglobin: hemoglobin,
          lipids: lipids
        };
        
        console.log('useVitalMeasurement - Actualizando valores vitales', {
          prevValues: prev,
          newValues,
          timestamp: new Date().toISOString()
        });
        
        return newValues;
      });
    };

    updateMeasurements();

    // Frecuencia de muestreo maximizada para captura ultra-precisa de latidos
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString()
      });
      
      setElapsedTime(elapsed / 1000);

      updateMeasurements();

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          timestamp: new Date().toISOString()
        });
        
        clearInterval(interval);
        const event = new CustomEvent('measurementComplete');
        window.dispatchEvent(event);
      }
    }, 100); // Reducido a 100ms para máxima frecuencia de muestreo posible

    return () => {
      console.log('useVitalMeasurement - Limpiando intervalo', {
        currentElapsed: elapsedTime,
        timestamp: new Date().toISOString()
      });
      clearInterval(interval);
    };
  }, [isMeasuring]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
