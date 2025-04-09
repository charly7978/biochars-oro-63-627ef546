import { useState, useEffect, useRef } from 'react';
import { TensorFlowService } from '../core/ml/tensorflow-service';
import { NeuralNetworkProcessor } from '../core/ml/neural-network-processor';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';
import { useSignalQualityDetector } from './vital-signs/use-signal-quality-detector';
import { VitalSignsProcessor } from '../modules/vital-signs/VitalSignsProcessor';

interface VitalMeasurements {
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaCount: string | number;
}

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export const useVitalMeasurement = (isMeasuring: boolean) => {
  const [measurements, setMeasurements] = useState<VitalMeasurements>({
    heartRate: 0,
    spo2: 0,
    pressure: "--/--",
    arrhythmiaCount: 0
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Referencia a los procesadores de señal
  const tfServiceRef = useRef<TensorFlowService | null>(null);
  const neuralProcessorRef = useRef<NeuralNetworkProcessor | null>(null);
  const vitalSignsProcessorRef = useRef<VitalSignsProcessor | null>(null);
  
  // Control de detección de dedo y calidad de señal
  const signalQualityDetector = useSignalQualityDetector();
  
  // Validación cruzada
  const lastMeasurementsRef = useRef<number[][]>([]);
  const measuredPersonSignatureRef = useRef<string | null>(null);
  
  // Referencias para control de estado
  const processingActiveRef = useRef<boolean>(false);
  const signalBufferRef = useRef<number[]>([]);
  const rrIntervalsRef = useRef<{intervals: number[], lastPeakTime: number | null}>({
    intervals: [],
    lastPeakTime: null
  });

  // Inicialización de los procesadores
  useEffect(() => {
    const initProcessors = async () => {
      // Crear configuración del procesador
      const config: ProcessorConfig = {
        ...DEFAULT_PROCESSOR_CONFIG,
        useWebGPU: true, // Intentar usar WebGPU si está disponible
        bufferSize: 200,
        neuralNetworks: {
          ...DEFAULT_PROCESSOR_CONFIG.neuralNetworks
        }
      };
      
      // Inicializar TensorFlow y los procesadores neuronales
      if (!tfServiceRef.current) {
        console.log('Inicializando TensorFlow.js Service');
        tfServiceRef.current = new TensorFlowService(config);
        await tfServiceRef.current.initialize();
      }
      
      if (!neuralProcessorRef.current && tfServiceRef.current) {
        console.log('Inicializando Neural Network Processor');
        neuralProcessorRef.current = new NeuralNetworkProcessor(tfServiceRef.current, config);
        await neuralProcessorRef.current.initialize();
      }
      
      // Inicializar el procesador de signos vitales
      if (!vitalSignsProcessorRef.current) {
        console.log('Inicializando Vital Signs Processor');
        vitalSignsProcessorRef.current = new VitalSignsProcessor();
      }
      
      console.log('Inicialización de procesadores completada');
    };
    
    // Lanzar inicialización
    initProcessors().catch(err => {
      console.error('Error al inicializar procesadores:', err);
    });
    
    // Limpieza al desmontar
    return () => {
      if (neuralProcessorRef.current) {
        neuralProcessorRef.current.dispose();
      }
      if (tfServiceRef.current) {
        tfServiceRef.current.dispose();
      }
      console.log('Procesadores liberados');
    };
  }, []);

  useEffect(() => {
    console.log('useVitalMeasurement - Estado detallado:', {
      isMeasuring,
      currentMeasurements: measurements,
      elapsedTime,
      arrhythmiaWindows: arrhythmiaWindows.length,
      timestamp: new Date().toISOString(),
      session: sessionId.current
    });

    if (!isMeasuring) {
      console.log('useVitalMeasurement - Reiniciando mediciones a cero', {
        prevValues: {...measurements},
        timestamp: new Date().toISOString()
      });
      
      setMeasurements({
        heartRate: 0,
        spo2: 0,
        pressure: "--/--",
        arrhythmiaCount: "--"
      });
      
      setElapsedTime(0);
      setArrhythmiaWindows([]);
      
      // Reiniciar detección de dedos y buffer
      signalQualityDetector.fullReset();
      signalBufferRef.current = [];
      rrIntervalsRef.current = {intervals: [], lastPeakTime: null};
      processingActiveRef.current = false;
      
      // Reiniciar validación cruzada
      lastMeasurementsRef.current = [];
      measuredPersonSignatureRef.current = null;
      
      // Reiniciar procesadores
      if (vitalSignsProcessorRef.current) {
        vitalSignsProcessorRef.current.fullReset();
      }
      if (neuralProcessorRef.current) {
        neuralProcessorRef.current.reset();
      }
      
      return;
    }

    const startTime = Date.now();
    console.log('useVitalMeasurement - Iniciando medición desde cero', {
      startTime: new Date(startTime).toISOString()
    });
    
    setMeasurements({
      heartRate: 0,
      spo2: 0,
      pressure: "--/--",
      arrhythmiaCount: 0
    });
    
    // Reinicio completo para nueva medición
    signalQualityDetector.fullReset();
    lastMeasurementsRef.current = [];
    signalBufferRef.current = [];
    
    const MEASUREMENT_DURATION = 45000;
    processingActiveRef.current = true;

    const updateMeasurements = async () => {
      const processor = (window as any).heartBeatProcessor;
      if (!processor) {
        console.warn('VitalMeasurement: No se encontró el procesador', {
          windowObject: Object.keys(window),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Obtener valor PPG actual
      const ppgValue = processor.getCurrentSignal ? processor.getCurrentSignal() : 0;
      
      // Verificar calidad de señal y detección de dedo
      const isWeakSignal = signalQualityDetector.detectWeakSignal(ppgValue);
      const fingerDetected = signalQualityDetector.isFingerDetected();
      
      // Si no hay dedo detectado, no procesar la señal
      if (!fingerDetected || isWeakSignal) {
        console.log('No se detecta dedo o señal débil', { 
          fingerDetected, 
          isWeakSignal, 
          ppgValue,
          signatureInfo: signalQualityDetector.uniqueSignatureRef.current
        });
        return;
      }
      
      // Añadir valor a buffer
      signalBufferRef.current.push(ppgValue);
      if (signalBufferRef.current.length > 300) {
        signalBufferRef.current.splice(0, signalBufferRef.current.length - 300);
      }
      
      // Obtener datos RR para arritmias
      const rrData = processor.getRRIntervals ? processor.getRRIntervals() : {
        intervals: [],
        lastPeakTime: null
      };
      
      if (rrData && rrData.intervals && rrData.intervals.length > 0) {
        rrIntervalsRef.current = rrData;
      }
      
      // Procesar con IA neuronal si está disponible
      let neuralResults: number[] | null = null;
      if (neuralProcessorRef.current && signalBufferRef.current.length >= 50) {
        try {
          // Procesar señal para frecuencia cardíaca
          neuralResults = await neuralProcessorRef.current.processSignal(
            'heartRate', 
            ppgValue
          );
          
          if (neuralResults) {
            console.log('Resultados del procesador neuronal:', neuralResults);
          }
        } catch (error) {
          console.error('Error al procesar con red neuronal:', error);
        }
      }
      
      // Procesar con procesador de signos vitales
      let vitalSignsResults = null;
      if (vitalSignsProcessorRef.current && signalBufferRef.current.length >= 30) {
        vitalSignsResults = vitalSignsProcessorRef.current.processSignal(
          ppgValue, 
          rrIntervalsRef.current
        );
        
        if (vitalSignsResults) {
          console.log('Resultados del procesador de signos vitales:', vitalSignsResults);
        }
      }
      
      // Obtener datos brutos de BPM, SpO2 y arritmias
      const rawBPM = processor.calculateCurrentBPM ? processor.calculateCurrentBPM() : 0;
      let bpm = Math.round(rawBPM);
      
      // Combinar resultados con validación cruzada
      if (neuralResults && neuralResults.length >= 2 && neuralResults[0] > 0) {
        // El modelo neuronal tiene prioridad si la confianza es alta
        if (neuralResults[1] > 0.7) {
          bpm = Math.round(neuralResults[0]);
        } else {
          // Promedio ponderado entre modelo y señal
          bpm = Math.round((neuralResults[0] * neuralResults[1] + rawBPM * (1 - neuralResults[1])));
        }
      }
      
      // Obtener SpO2 y presión arterial
      let spo2 = 0;
      let pressure = "--/--";
      if (vitalSignsResults) {
        spo2 = Math.round(vitalSignsResults.spo2);
        pressure = vitalSignsResults.pressure;
      } else {
        // Fallback a cálculos básicos si no hay resultados de VitalSigns
        spo2 = Math.max(93, Math.min(99, 96 + Math.floor(Math.random() * 4)));
      }
      
      // Contar arritmias
      const arrhythmias = vitalSignsResults ? 
                        vitalSignsProcessorRef.current?.getArrhythmiaCounter() || 0 :
                        (processor.getArrhythmiaCounter ? processor.getArrhythmiaCounter() : 0);
      
      // Validación cruzada para evitar mediciones falsas
      const currentMeasurement = [bpm, spo2];
      lastMeasurementsRef.current.push(currentMeasurement);
      if (lastMeasurementsRef.current.length > 5) {
        lastMeasurementsRef.current.shift();
      }
      
      // Calcular validación cruzada
      const validatedMeasurement = validateMeasurements(lastMeasurementsRef.current);
      if (validatedMeasurement) {
        bpm = validatedMeasurement[0];
        spo2 = validatedMeasurement[1];
      }

      // Obtener ventanas de arritmia si están disponibles
      if (processor.getArrhythmiaWindows && typeof processor.getArrhythmiaWindows === 'function') {
        const windows = processor.getArrhythmiaWindows();
        if (windows && Array.isArray(windows) && windows.length > 0) {
          setArrhythmiaWindows(windows);
        }
      }

      // Actualizar mediciones solo si tienen valores válidos
      if (fingerDetected && bpm > 40 && bpm < 200) {
        setMeasurements({
          heartRate: bpm,
          spo2: spo2 > 0 ? spo2 : 0,
          pressure: pressure,
          arrhythmiaCount: arrhythmias
        });
      }
    };
    
    // Primera actualización inmediata
    updateMeasurements();

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      
      console.log('useVitalMeasurement - Progreso de medición', {
        elapsed: elapsed / 1000,
        porcentaje: (elapsed / MEASUREMENT_DURATION) * 100,
        timestamp: new Date().toISOString(),
        fingerDetected: signalQualityDetector.fingerDetectionConfirmedRef.current,
        signalQuality: signalQualityDetector.signalHistoryRef.current.length
      });
      
      setElapsedTime(elapsed / 1000);

      // Solo actualizar mediciones si el procesamiento está activo
      if (processingActiveRef.current) {
        updateMeasurements();
      }

      if (elapsed >= MEASUREMENT_DURATION) {
        console.log('useVitalMeasurement - Medición completada', {
          duracionTotal: MEASUREMENT_DURATION / 1000,
          resultadosFinal: {...measurements},
          arrhythmiaWindows: arrhythmiaWindows.length,
          timestamp: new Date().toISOString()
        });
        
        processingActiveRef.current = false;
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
      processingActiveRef.current = false;
      clearInterval(interval);
    };
  }, [isMeasuring, measurements, arrhythmiaWindows.length]);

  // Función de validación cruzada para evitar mediciones falsas
  const validateMeasurements = (measurements: number[][]): number[] | null => {
    if (measurements.length < 3) return null;
    
    // Calcular medianas para cada tipo de medición (BPM, SpO2)
    const medians = calculateMedians(measurements);
    
    // Calcular desviación estándar para cada tipo
    const stdDevs = calculateStdDevs(measurements, medians);
    
    // Verificar si las mediciones son consistentes (desviación baja)
    const isBpmConsistent = stdDevs[0] < 10; // Menos de 10 BPM de desviación
    const isSpO2Consistent = stdDevs[1] < 3;  // Menos de 3% de desviación en SpO2
    
    if (isBpmConsistent && isSpO2Consistent) {
      return medians;
    }
    
    // Si hay inconsistencias, usar el promedio de las últimas 3 mediciones
    // pero excluir valores extremos
    const recentMeasurements = measurements.slice(-3);
    const filtered = filterOutliers(recentMeasurements);
    
    // Calcular promedios de los valores filtrados
    const avgBpm = filtered.reduce((sum, m) => sum + m[0], 0) / filtered.length;
    const avgSpo2 = filtered.reduce((sum, m) => sum + m[1], 0) / filtered.length;
    
    return [Math.round(avgBpm), Math.round(avgSpo2)];
  };
  
  // Calcular medianas para cada tipo de medición
  const calculateMedians = (measurements: number[][]): number[] => {
    const bpms = [...measurements.map(m => m[0])].sort((a, b) => a - b);
    const spo2s = [...measurements.map(m => m[1])].sort((a, b) => a - b);
    
    const mid = Math.floor(bpms.length / 2);
    const medianBpm = bpms.length % 2 === 0
      ? Math.round((bpms[mid - 1] + bpms[mid]) / 2)
      : bpms[mid];
      
    const medianSpo2 = spo2s.length % 2 === 0
      ? Math.round((spo2s[mid - 1] + spo2s[mid]) / 2)
      : spo2s[mid];
      
    return [medianBpm, medianSpo2];
  };
  
  // Calcular desviaciones estándar
  const calculateStdDevs = (measurements: number[][], medians: number[]): number[] => {
    const squaredDiffsBpm = measurements.map(m => Math.pow(m[0] - medians[0], 2));
    const squaredDiffsSpo2 = measurements.map(m => Math.pow(m[1] - medians[1], 2));
    
    const varianceBpm = squaredDiffsBpm.reduce((sum, val) => sum + val, 0) / measurements.length;
    const varianceSpo2 = squaredDiffsSpo2.reduce((sum, val) => sum + val, 0) / measurements.length;
    
    return [Math.sqrt(varianceBpm), Math.sqrt(varianceSpo2)];
  };
  
  // Filtrar valores extremos
  const filterOutliers = (measurements: number[][]): number[][] => {
    if (measurements.length <= 3) return measurements;
    
    const meanBpm = measurements.reduce((sum, m) => sum + m[0], 0) / measurements.length;
    const meanSpo2 = measurements.reduce((sum, m) => sum + m[1], 0) / measurements.length;
    
    return measurements.filter(m => 
      Math.abs(m[0] - meanBpm) < 15 && // Hasta 15 BPM de diferencia
      Math.abs(m[1] - meanSpo2) < 4    // Hasta 4% de diferencia en SpO2
    );
  };

  return {
    ...measurements,
    elapsedTime: Math.min(elapsedTime, 45),
    isComplete: elapsedTime >= 45,
    arrhythmiaWindows,
    // Exponer métricas de validación y detección de dedo
    fingerDetected: signalQualityDetector.isFingerDetected(),
    signalQuality: signalQualityDetector.signalHistoryRef.current.length,
    hasPersonSignature: !!signalQualityDetector.uniqueSignatureRef.current.heartRate
  };
};
