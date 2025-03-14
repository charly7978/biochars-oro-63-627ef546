
import { useState, useEffect } from 'react';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
  glucose: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0,
    glucose: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawGlucoseReadings, setRawGlucoseReadings] = useState<number[]>([]);
  const [rawBPMReadings, setRawBPMReadings] = useState<number[]>([]);
  const [rawSpO2Readings, setRawSpO2Readings] = useState<number[]>([]);

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
          glucose: 0
        };
        
        console.log('useVitalMeasurement - Nuevos valores tras reinicio', newValues);
        return newValues;
      });
      
      setElapsedTime(0);
      setRawGlucoseReadings([]);
      setRawBPMReadings([]);
      setRawSpO2Readings([]);
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
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Obtener la lectura de BPM del procesador
      const bpm = processor.getFinalBPM() || 0;
      
      // Verificar si existe el procesador de signos vitales
      const vitalSignsProcessor = (window as any).vitalSignsProcessor;
      if (!vitalSignsProcessor) {
        console.warn('VitalMeasurement: No se encontró el procesador de signos vitales');
        return;
      }

      console.log('useVitalMeasurement - Actualización detallada:', {
        processor: !!processor,
        bpm,
        vitalSignsProcessor: !!vitalSignsProcessor,
        timestamp: new Date().toISOString()
      });

      // Actualizar lecturas de BPM si está dentro del rango fisiológico
      if (bpm > 40 && bpm < 180) {
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

          // Calcular presión arterial usando el procesador de signos vitales
          if (vitalSignsProcessor.calculateBloodPressure) {
            const bp = vitalSignsProcessor.calculateBloodPressure(ppgData);
            if (bp && bp.systolic > 0 && bp.diastolic > 0) {
              console.log('useVitalMeasurement - Presión arterial calculada:', bp);
              setMeasurements(prev => ({
                ...prev,
                pressure: `${bp.systolic}/${bp.diastolic}`
              }));
            }
          }

          // Calcular SpO2 si está disponible el método
          if (vitalSignsProcessor.calculateSpO2) {
            try {
              const spo2 = vitalSignsProcessor.calculateSpO2(ppgData);
              if (spo2 > 0) {
                console.log('useVitalMeasurement - SpO2 calculado:', spo2);
                setRawSpO2Readings(prev => [...prev, spo2]);
              }
            } catch (error) {
              console.error('Error calculando SpO2:', error);
            }
          }

          // Calcular glucosa si existe el procesador de glucosa
          const glucoseProcessor = (window as any).glucoseProcessor;
          if (glucoseProcessor && glucoseProcessor.calculateGlucose) {
            try {
              const rawGlucoseValue = glucoseProcessor.calculateGlucose(ppgData);
              
              if (rawGlucoseValue && rawGlucoseValue > 0) {
                setRawGlucoseReadings(prev => [...prev, rawGlucoseValue]);
                
                console.log('useVitalMeasurement - Nuevo valor de glucosa:', {
                  valor: rawGlucoseValue,
                  totalLecturas: rawGlucoseReadings.length + 1,
                  tiempoTranscurrido: elapsedTime,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (error) {
              console.error('Error obteniendo valor de glucosa:', error);
            }
          }
        } else {
          console.warn('useVitalMeasurement - No hay datos PPG disponibles');
        }
      } catch (error) {
        console.error('Error procesando datos PPG:', error);
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
          const medianSpO2 = sortedSpO2[Math.floor(sortedSpO2Readings.length / 2)];
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

        console.log('useVitalMeasurement - Valores actualizados:', {
          prevValues: prev,
          newValues,
          lecturas: {
            bpm: rawBPMReadings.length,
            spo2: rawSpO2Readings.length,
            glucose: rawGlucoseReadings.length
          },
          timestamp: new Date().toISOString()
        });
        
        return newValues;
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
        timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
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
  }, [isMeasuring, measurements, elapsedTime, rawGlucoseReadings, rawBPMReadings, rawSpO2Readings]);

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 30),
    isComplete: elapsedTime >= 30
  };
};
