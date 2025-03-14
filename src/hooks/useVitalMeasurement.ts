
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number;
  cholesterol: number;
  triglycerides: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0,
    cholesterol: 0,
    triglycerides: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawGlucoseReadings, setRawGlucoseReadings] = useState<number[]>([]);
  const [rawBPMReadings, setRawBPMReadings] = useState<number[]>([]);
  const [rawSpO2Readings, setRawSpO2Readings] = useState<number[]>([]);
  const [rawLipidReadings, setRawLipidReadings] = useState<{cholesterol: number, triglycerides: number}[]>([]);
  const [measurementErrors, setMeasurementErrors] = useState<string[]>([]);
  
  // Nuevo: contador de intentos de procesamiento para persistencia
  const [processingAttempts, setProcessingAttempts] = useState(0);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      timestamp: new Date().toISOString(),
      session: Math.random().toString(36).substring(2, 9)
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
          cholesterol: 0,
          triglycerides: 0
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      setRawGlucoseReadings([]);
      setRawBPMReadings([]);
      setRawSpO2Readings([]);
      setRawLipidReadings([]);
      setMeasurementErrors([]);
      setProcessingAttempts(0);
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición', {
      startTime: new Date(startTime).toISOString(),
      prevValues: {...measurements}
    });
    
    const MEASUREMENT_DURATION = 30000;

    const updateMeasurements = () => {
      // Incrementar contador de intentos
      setProcessingAttempts(prev => prev + 1);
      
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        addError("No se encontró el procesador de ritmo cardíaco");
        return;
      }

      // Obtener la lectura de BPM del procesador
      const bpm = processor.getFinalBPM() || 0;
      
      // Verificar si existe el procesador de signos vitales
      const vitalSignsProcessor = (window as any).vitalSignsProcessor;
      if (!vitalSignsProcessor) {
        addError("No se encontró el procesador de signos vitales");
        return;
      }

      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        bpm,
        vitalSignsProcessor: !!vitalSignsProcessor,
        timestamp: new Date().toISOString(),
        intentos: processingAttempts
      });

      // Actualizar lecturas de BPM con rango ampliado
      if (bpm > 35 && bpm < 190) { // Ampliado de 40-180 a 35-190
        setRawBPMReadings(prev => [...prev, bpm]);
      }

      // Obtener datos PPG para calcular otros signos vitales
      try {
        // Verificar si el procesador tiene el método getPPGData
        const ppgData = processor.getPPGData ? processor.getPPGData() : [];
        
        if (ppgData && ppgData.length > 0) {
          console.log('useVitalMeasurement - Datos PPG disponibles:', {
            muestras: ppgData.length,
            primerValor: ppgData[0],
            ultimoValor: ppgData[ppgData.length - 1]
          });

          // Amplificar señal para mejor detección
          const amplifiedPPG = ppgData.map((val: number) => val * 1.15);

          // Calcular presión arterial usando el procesador de signos vitales
          if (vitalSignsProcessor.calculateBloodPressure) {
            const bp = vitalSignsProcessor.calculateBloodPressure(amplifiedPPG);
            if (bp && bp.systolic > 0 && bp.diastolic > 0) {
              console.log('useVitalMeasurement - Presión arterial calculada:', bp);
              setMeasurements(prev => ({
                ...prev,
                pressure: `${bp.systolic}/${bp.diastolic}`
              }));
            } else {
              console.log('useVitalMeasurement - No se pudo calcular presión válida');
            }
          }

          // Calcular SpO2 si está disponible el método
          if (vitalSignsProcessor.calculateSpO2) {
            try {
              const spo2Result = vitalSignsProcessor.calculateSpO2(amplifiedPPG);
              const spo2Value = typeof spo2Result === 'object' ? spo2Result.value : spo2Result;
              
              if (spo2Value > 0) {
                console.log('useVitalMeasurement - SpO2 calculado:', spo2Value);
                setRawSpO2Readings(prev => [...prev, spo2Value]);
              } else {
                console.log('useVitalMeasurement - SpO2 inválido o insuficiente calidad de señal');
              }
            } catch (error) {
              console.error('Error calculando SpO2:', error);
              addError("Error al calcular SpO2");
            }
          }

          // Calcular glucosa utilizando glucoseProcessor directamente desde la instancia global
          const glucoseProcessor = (window as any).glucoseProcessor;
          if (glucoseProcessor && glucoseProcessor.calculateGlucose) {
            try {
              // Intentar múltiples veces con diferente amplificación
              let rawGlucoseValue = 0;
              const attempts = [1.0, 1.1, 1.2, 1.3];
              
              for (const amplifier of attempts) {
                rawGlucoseValue = glucoseProcessor.calculateGlucose(
                  amplifiedPPG.map((val: number) => val * amplifier)
                );
                if (rawGlucoseValue > 0) break;
              }
              
              if (rawGlucoseValue && rawGlucoseValue > 0) {
                setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
                
                console.log('useVitalMeasurement - Nuevo valor de glucosa:', {
                  valor: rawGlucoseValue,
                  totalLecturas: rawGlucoseReadings.length + 1,
                  tiempoTranscurrido: elapsedTime,
                  timestamp: new Date().toISOString()
                });
              } else {
                console.log('useVitalMeasurement - Glucosa inválida o insuficiente calidad de señal');
              }
            } catch (error) {
              console.error('Error obteniendo valor de glucosa:', error);
              addError("Error al calcular glucosa");
            }
          }

          // Calcular lípidos utilizando lipidProcessor directamente desde la instancia global
          const lipidProcessor = (window as any).lipidProcessor;
          if (lipidProcessor && lipidProcessor.calculateLipids) {
            try {
              // Intentar múltiples veces con diferente amplificación
              let lipids = null;
              const attempts = [1.0, 1.2, 1.3, 1.4];
              
              for (const amplifier of attempts) {
                lipids = lipidProcessor.calculateLipids(
                  amplifiedPPG.map((val: number) => val * amplifier)
                );
                if (lipids && lipids.totalCholesterol > 0) break;
              }
              
              if (lipids && lipids.totalCholesterol > 0) {
                setRawLipidReadings(prev => [...prev, {
                  cholesterol: lipids.totalCholesterol,
                  triglycerides: lipids.triglycerides
                }]);
                
                console.log('useVitalMeasurement - Nuevos valores de lípidos:', {
                  colesterol: lipids.totalCholesterol,
                  trigliceridos: lipids.triglycerides,
                  totalLecturas: rawLipidReadings.length + 1,
                  tiempoTranscurrido: elapsedTime,
                  timestamp: new Date().toISOString()
                });
              } else {
                console.log('useVitalMeasurement - Lípidos inválidos o insuficiente calidad de señal');
              }
            } catch (error) {
              console.error('Error obteniendo valores de lípidos:', error);
              addError("Error al calcular lípidos");
            }
          }
        } else {
          console.warn('useVitalMeasurement - No hay datos PPG disponibles');
          addError("No hay datos PPG disponibles");
        }
      } catch (error) {
        console.error('Error procesando datos PPG:', error);
        addError("Error procesando datos PPG");
      }

      // Actualizar mediciones con los valores procesados
      setMeasurements(prev => {
        const newValues = { ...prev };

        // Actualizar BPM con mediana de lecturas
        if (rawBPMReadings.length > 2) {
          const sortedBPM = [...rawBPMReadings].sort((a, b) => a - b);
          const medianBPM = sortedBPM[Math.floor(sortedBPM.length / 2)];
          newValues.heartRate = medianBPM;
        } else if (bpm > 0) {
          newValues.heartRate = bpm;
        }

        // Actualizar SpO2 con mediana de lecturas
        if (rawSpO2Readings.length > 2) {
          const sortedSpO2 = [...rawSpO2Readings].sort((a, b) => a - b);
          const medianSpO2 = sortedSpO2[Math.floor(rawSpO2Readings.length / 2)];
          newValues.spo2 = medianSpO2;
        }

        // Actualizar glucosa con mediana de lecturas, eliminando outliers
        if (rawGlucoseReadings.length > 2) {
          const sortedGlucose = [...rawGlucoseReadings].sort((a, b) => a - b);
          
          // Eliminar outliers (10% superior e inferior)
          const cutStart = Math.floor(sortedGlucose.length * 0.1);
          const cutEnd = Math.floor(sortedGlucose.length * 0.9);
          const filteredGlucose = sortedGlucose.slice(cutStart, cutEnd + 1);
          
          if (filteredGlucose.length > 0) {
            const medianGlucose = filteredGlucose[Math.floor(filteredGlucose.length / 2)];
            newValues.glucose = Math.round(medianGlucose);
          } else if (sortedGlucose.length > 0) {
            const medianGlucose = sortedGlucose[Math.floor(sortedGlucose.length / 2)];
            newValues.glucose = Math.round(medianGlucose);
          }
        } else if (rawGlucoseReadings.length > 0) {
          newValues.glucose = Math.round(rawGlucoseReadings[rawGlucoseReadings.length - 1]);
        }

        // Actualizar lípidos con mediana de lecturas
        if (rawLipidReadings.length > 2) {
          const sortedCholesterol = [...rawLipidReadings]
            .map(l => l.cholesterol)
            .sort((a, b) => a - b);
          
          const sortedTriglycerides = [...rawLipidReadings]
            .map(l => l.triglycerides)
            .sort((a, b) => a - b);
          
          const medianCholesterol = sortedCholesterol[Math.floor(sortedCholesterol.length / 2)];
          const medianTriglycerides = sortedTriglycerides[Math.floor(sortedTriglycerides.length / 2)];
          
          newValues.cholesterol = Math.round(medianCholesterol);
          newValues.triglycerides = Math.round(medianTriglycerides);
        } else if (rawLipidReadings.length > 0) {
          const lastReading = rawLipidReadings[rawLipidReadings.length - 1];
          newValues.cholesterol = Math.round(lastReading.cholesterol);
          newValues.triglycerides = Math.round(lastReading.triglycerides);
        }

        console.log('useVitalMeasurement - Valores actualizados:', {
          prevValues: prev,
          newValues,
          lecturas: {
            bpm: rawBPMReadings.length,
            spo2: rawSpO2Readings.length,
            glucose: rawGlucoseReadings.length,
            lipids: rawLipidReadings.length
          },
          timestamp: new Date().toISOString()
        });
        
        return newValues;
      });
    };

    // Helper para agregar errores sin duplicados
    const addError = (error: string) => {
      setMeasurementErrors(prev => {
        if (!prev.includes(error)) {
          return [...prev, error];
        }
        return prev;
      });
    };

    // Realizar medición inicial
    updateMeasurements();

    // Configurar intervalo para actualizar mediciones
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        lecturasGlucosa: rawGlucoseReadings.length,
        lecturasBPM: rawBPMReadings.length,
        lecturasSpO2: rawSpO2Readings.length,
        lecturasLipidos: rawLipidReadings.length,
        errores: measurementErrors.length,
        timestamp: new Date().toISOString(),
        intentos: processingAttempts
      });
      
      setElapsedTime(elapsed / 1000);

      // Actualizar mediciones
      updateMeasurements();

      // Finalizar medición al alcanzar la duración máxima
      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          totalLecturasGlucosa: rawGlucoseReadings.length,
          totalLecturasBPM: rawBPMReadings.length,
          totalLecturasSpO2: rawSpO2Readings.length,
          totalLecturasLipidos: rawLipidReadings.length,
          errores: measurementErrors,
          timestamp: new Date().toISOString(),
          intentos: processingAttempts
        });
        
        clearInterval(interval);
        const event = new CustomEvent('measurementComplete');
        window.dispatchEvent(event);
      }
    }, 200);

    return () => {
      console.log('useVitalMeasurement - Limpiando intervalo', {
        currentElapsed: elapsedTime,
        timestamp: new Date().toISOString()
      });
      clearInterval(interval);
    };
  }, [isMeasuring, measurements, elapsedTime, rawGlucoseReadings, rawBPMReadings, rawSpO2Readings, rawLipidReadings, measurementErrors, processingAttempts]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30,
    errors: measurementErrors
  };
};
