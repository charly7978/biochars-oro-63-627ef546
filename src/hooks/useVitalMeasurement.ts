
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
  // Nuevo: verificación de procesadores
  const [processorsVerified, setProcessorsVerified] = useState(false);

  useEffect(() => {
    // Nuevo: verificar procesadores al inicio para detectar duplicaciones
    if (!processorsVerified) {
      console.log('useVitalMeasurement - Verificando procesadores globales:', {
        vitalSignsProcessor: !!(window as any).vitalSignsProcessor,
        glucoseProcessor: !!(window as any).glucoseProcessor,
        lipidProcessor: !!(window as any).lipidProcessor,
        timestamp: new Date().toISOString()
      });
      setProcessorsVerified(true);
    }
    
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
      
      // Verificar procesador de ritmo cardíaco
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
      
      // NUEVO: Verificar explícitamente procesadores específicos
      const glucoseProcessor = (window as any).glucoseProcessor;
      const lipidProcessor = (window as any).lipidProcessor;
      
      if (!glucoseProcessor) {
        addError("No se encontró el procesador de glucosa");
        console.error("Procesador de glucosa no encontrado en window.glucoseProcessor");
      }
      
      if (!lipidProcessor) {
        addError("No se encontró el procesador de lípidos");
        console.error("Procesador de lípidos no encontrado en window.lipidProcessor");
      }

      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        bpm,
        vitalSignsProcessor: !!vitalSignsProcessor,
        glucoseProcessor: !!glucoseProcessor,
        lipidProcessor: !!lipidProcessor,
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

          // Usar amplificaciones múltiples para aumentar probabilidad de detección
          const amplificationFactors = [1.2, 1.4, 1.6, 1.8, 2.0]; // Ampliado con más factores
          let bpCalculated = false;
          let spo2Calculated = false;
          let glucoseCalculated = false;
          let lipidsCalculated = false;

          for (const factor of amplificationFactors) {
            // Amplificar señal con cada factor
            const amplifiedPPG = ppgData.map((val: number) => val * factor);

            // Calcular presión arterial si no se ha calculado aún
            if (!bpCalculated && vitalSignsProcessor.calculateBloodPressure) {
              const bp = vitalSignsProcessor.calculateBloodPressure(amplifiedPPG);
              if (bp && bp.systolic > 0 && bp.diastolic > 0) {
                console.log(`useVitalMeasurement - Presión arterial calculada con factor ${factor}:`, bp);
                setMeasurements(prev => ({
                  ...prev,
                  pressure: `${bp.systolic}/${bp.diastolic}`
                }));
                bpCalculated = true;
              }
            }

            // Calcular SpO2 si no se ha calculado aún
            if (!spo2Calculated && vitalSignsProcessor.calculateSpO2) {
              try {
                const spo2Result = vitalSignsProcessor.calculateSpO2(amplifiedPPG);
                const spo2Value = typeof spo2Result === 'object' ? spo2Result.value : spo2Result;
                
                if (spo2Value > 0) {
                  console.log(`useVitalMeasurement - SpO2 calculado con factor ${factor}:`, spo2Value);
                  setRawSpO2Readings(prev => [...prev, spo2Value]);
                  spo2Calculated = true;
                }
              } catch (error) {
                console.error(`Error calculando SpO2 con factor ${factor}:`, error);
              }
            }

            // Calcular glucosa si no se ha calculado aún
            if (!glucoseCalculated && glucoseProcessor && glucoseProcessor.calculateGlucose) {
              try {
                const rawGlucoseValue = glucoseProcessor.calculateGlucose(amplifiedPPG);
                
                if (rawGlucoseValue && rawGlucoseValue > 0) {
                  setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
                  
                  console.log(`useVitalMeasurement - Glucosa calculada con factor ${factor}:`, {
                    valor: rawGlucoseValue,
                    totalLecturas: rawGlucoseReadings.length + 1,
                    tiempoTranscurrido: elapsedTime,
                    timestamp: new Date().toISOString()
                  });
                  
                  glucoseCalculated = true;
                }
              } catch (error) {
                console.error(`Error obteniendo valor de glucosa con factor ${factor}:`, error);
              }
            }

            // Calcular lípidos si no se han calculado aún
            if (!lipidsCalculated && lipidProcessor && lipidProcessor.calculateLipids) {
              try {
                const lipids = lipidProcessor.calculateLipids(amplifiedPPG);
                
                if (lipids && lipids.totalCholesterol > 0) {
                  setRawLipidReadings(prev => [...prev, {
                    cholesterol: lipids.totalCholesterol,
                    triglycerides: lipids.triglycerides
                  }]);
                  
                  console.log(`useVitalMeasurement - Lípidos calculados con factor ${factor}:`, {
                    colesterol: lipids.totalCholesterol,
                    trigliceridos: lipids.triglycerides,
                    totalLecturas: rawLipidReadings.length + 1,
                    tiempoTranscurrido: elapsedTime,
                    timestamp: new Date().toISOString()
                  });
                  
                  lipidsCalculated = true;
                }
              } catch (error) {
                console.error(`Error obteniendo valores de lípidos con factor ${factor}:`, error);
              }
            }

            // Si ya se calcularon todos los valores, salir del bucle
            if (bpCalculated && spo2Calculated && glucoseCalculated && lipidsCalculated) {
              console.log('useVitalMeasurement - Todos los valores calculados exitosamente');
              break;
            }
          }

          // Si no pudimos calcular algunos valores, intentar con un último enfoque
          if (!bpCalculated || !glucoseCalculated || !lipidsCalculated) {
            console.log('useVitalMeasurement - Intentando método de último recurso para valores faltantes');
            
            // Usar el último método de amplificación extrema para los valores faltantes
            const superAmplifiedPPG = ppgData.map((val: number) => val * 2.5); // Aumentado considerablemente
            
            // Presión arterial último intento
            if (!bpCalculated && vitalSignsProcessor.calculateBloodPressure) {
              const bp = vitalSignsProcessor.calculateBloodPressure(superAmplifiedPPG);
              if (bp && bp.systolic > 0 && bp.diastolic > 0) {
                console.log('useVitalMeasurement - Presión arterial calculada con amplificación extrema:', bp);
                setMeasurements(prev => ({
                  ...prev,
                  pressure: `${bp.systolic}/${bp.diastolic}`
                }));
              }
            }
            
            // Glucosa último intento
            if (!glucoseCalculated && glucoseProcessor) {
              try {
                const rawGlucoseValue = glucoseProcessor.calculateGlucose(superAmplifiedPPG);
                if (rawGlucoseValue && rawGlucoseValue > 0) {
                  setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
                  console.log('useVitalMeasurement - Glucosa calculada con amplificación extrema:', rawGlucoseValue);
                }
              } catch (error) {
                console.error('Error en intento final de glucosa:', error);
              }
            }
            
            // Lípidos último intento
            if (!lipidsCalculated && lipidProcessor) {
              try {
                const lipids = lipidProcessor.calculateLipids(superAmplifiedPPG);
                if (lipids && lipids.totalCholesterol > 0) {
                  setRawLipidReadings(prev => [...prev, {
                    cholesterol: lipids.totalCholesterol,
                    triglycerides: lipids.triglycerides
                  }]);
                  console.log('useVitalMeasurement - Lípidos calculados con amplificación extrema:', lipids);
                }
              } catch (error) {
                console.error('Error en intento final de lípidos:', error);
              }
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
        if (rawGlucoseReadings.length > 0) { // Cambiado para aceptar incluso con pocas lecturas
          // Si hay pocas lecturas, usar la última directamente
          if (rawGlucoseReadings.length < 3) {
            newValues.glucose = Math.round(rawGlucoseReadings[rawGlucoseReadings.length - 1]);
          } else {
            // Con más lecturas, usar filtrado de outliers
            const sortedGlucose = [...rawGlucoseReadings].sort((a, b) => a - b);
            
            // Eliminar outliers solo si hay suficientes lecturas
            if (sortedGlucose.length >= 5) {
              const cutStart = Math.floor(sortedGlucose.length * 0.1);
              const cutEnd = Math.floor(sortedGlucose.length * 0.9);
              const filteredGlucose = sortedGlucose.slice(cutStart, cutEnd + 1);
              
              if (filteredGlucose.length > 0) {
                const medianGlucose = filteredGlucose[Math.floor(filteredGlucose.length / 2)];
                newValues.glucose = Math.round(medianGlucose);
              }
            } else {
              // Con pocas lecturas, usar la mediana directa
              const medianGlucose = sortedGlucose[Math.floor(sortedGlucose.length / 2)];
              newValues.glucose = Math.round(medianGlucose);
            }
          }
        }

        // Actualizar lípidos con mediana de lecturas
        if (rawLipidReadings.length > 0) { // Cambiado para aceptar incluso con pocas lecturas
          // Si hay pocas lecturas, usar la última directamente
          if (rawLipidReadings.length < 3) {
            const lastReading = rawLipidReadings[rawLipidReadings.length - 1];
            newValues.cholesterol = Math.round(lastReading.cholesterol);
            newValues.triglycerides = Math.round(lastReading.triglycerides);
          } else {
            // Con más lecturas, usar medianas
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
          }
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
  }, [isMeasuring, measurements, elapsedTime, rawGlucoseReadings, rawBPMReadings, rawSpO2Readings, rawLipidReadings, measurementErrors, processingAttempts, processorsVerified]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30,
    errors: measurementErrors
  };
};
