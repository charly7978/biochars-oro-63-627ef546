
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor, HeartBeatResult } from '../modules/HeartBeatProcessor';
import { toast } from "sonner";

interface ProcessedHeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastUpdateTime = useRef<number>(Date.now());
  const stableReadingsCount = useRef<number>(0);
  const lastValidBPM = useRef<number>(0);
  const peakCount = useRef<number>(0);
  const processingStartTime = useRef<number>(0);
  const noBeatsDetectedTimer = useRef<NodeJS.Timeout | null>(null);
  const beatDetectedOnce = useRef<boolean>(false);
  const beatsDetectionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creando nueva instancia de procesador', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    processingStartTime.current = Date.now();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Procesador registrado globalmente', {
        processorRegistered: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    // Configurar un temporizador para verificar si no se detectan latidos
    startNoBeatsDetectionTimer();
    
    // Iniciar verificación periódica de latidos
    startBeatsDetectionCheck();

    return () => {
      console.log('useHeartBeatProcessor: Limpieza', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      stopNoBeatsDetectionTimer();
      stopBeatsDetectionCheck();
      processorRef.current = null;
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  const startNoBeatsDetectionTimer = () => {
    stopNoBeatsDetectionTimer();
    
    noBeatsDetectedTimer.current = setTimeout(() => {
      // Si después de 7 segundos no hay latidos detectados (reducido de 10 a 7)
      if (peakCount.current === 0 && Date.now() - processingStartTime.current > 7000) {
        console.warn('useHeartBeatProcessor: No se han detectado latidos después de 7 segundos', {
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
        
        toast.warning("No se detectan latidos. Por favor, ajuste su dedo en la cámara y asegure que esté bien iluminado.", {
          duration: 5000,
        });
      }
    }, 7000); // Reducido de 10000 a 7000
  };
  
  const stopNoBeatsDetectionTimer = () => {
    if (noBeatsDetectedTimer.current) {
      clearTimeout(noBeatsDetectedTimer.current);
      noBeatsDetectedTimer.current = null;
    }
  };
  
  const startBeatsDetectionCheck = () => {
    stopBeatsDetectionCheck();
    
    beatsDetectionCheckInterval.current = setInterval(() => {
      const now = Date.now();
      const timeElapsed = now - processingStartTime.current;
      
      // Solo verificar después de los primeros 3 segundos
      if (timeElapsed > 3000) {
        if (peakCount.current === 0) {
          console.warn('useHeartBeatProcessor: Aún no se detectan latidos después de', {
            segundosTranscurridos: Math.floor(timeElapsed / 1000),
            timestamp: new Date().toISOString()
          });
          
          // Mostrar toast solo cada 5 segundos si no hay latidos
          if (timeElapsed % 5000 < 1000) {
            toast.warning("Señal débil. Intente mover ligeramente el dedo o mejorar la iluminación.", {
              duration: 3000,
            });
          }
        } else if (!beatDetectedOnce.current) {
          // Primer latido detectado
          beatDetectedOnce.current = true;
          console.log('useHeartBeatProcessor: Primer latido detectado!', {
            tiempoTranscurrido: Math.floor(timeElapsed / 1000),
            timestamp: new Date().toISOString()
          });
          
          toast.success("¡Primeros latidos detectados! Mantenga el dedo quieto.", {
            duration: 3000,
          });
        }
      }
    }, 1000);
  };
  
  const stopBeatsDetectionCheck = () => {
    if (beatsDetectionCheckInterval.current) {
      clearInterval(beatsDetectionCheckInterval.current);
      beatsDetectionCheckInterval.current = null;
    }
  };

  const processSignal = useCallback((value: number): ProcessedHeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Procesador no inicializado', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    const now = Date.now();
    const shouldLog = now - lastUpdateTime.current > 1000; // Registrar solo una vez por segundo
    
    if (shouldLog) {
      console.log('useHeartBeatProcessor - procesando señal:', {
        inputValue: value.toFixed(2),
        timestamp: new Date().toISOString(),
        elapsedTime: now - processingStartTime.current
      });
      lastUpdateTime.current = now;
    }

    try {
      // Procesamiento más sensible de la señal
      const result = processorRef.current.processSignal(value);
      const rrData = processorRef.current.getRRIntervals();
      
      // Si se detecta un latido, incrementar contador y reiniciar temporizador
      if (result.isBeat) {
        peakCount.current++;
        
        // Reiniciar temporizador de detección de latidos
        stopNoBeatsDetectionTimer();
        startNoBeatsDetectionTimer();
        
        if (peakCount.current === 1) {
          console.log('useHeartBeatProcessor: Primer latido detectado después de', {
            milliseconds: now - processingStartTime.current,
            timestamp: new Date().toISOString()
          });
          
          toast.success("¡Primer latido detectado!", {
            duration: 2000,
          });
          
          beatDetectedOnce.current = true;
        }
      }
      
      if (shouldLog) {
        console.log('useHeartBeatProcessor - resultado:', {
          bpm: result.bpm,
          confidence: result.confidence,
          isPeak: result.isBeat,
          arrhythmiaCount: 0,
          intervals: rrData.intervals.length,
          totalPeaks: peakCount.current
        });
      }
      
      // Umbral de confianza más bajo para permitir más detecciones
      if (result.confidence < 0.15) { // Reducido de 0.2 a 0.15
        stableReadingsCount.current = 0;
        return {
          bpm: currentBPM > 0 ? currentBPM : result.bpm || 70,
          confidence: result.confidence,
          isPeak: result.isBeat,
          arrhythmiaCount: 0,
          rrData
        };
      }

      let validatedBPM = result.bpm;
      // Rango más amplio de valores BPM aceptables
      const isValidBPM = result.bpm >= 40 && result.bpm <= 200; // Ampliado de 45-180 a 40-200
      
      if (!isValidBPM) {
        stableReadingsCount.current = 0;
        validatedBPM = lastValidBPM.current || result.bpm || 70;
      } else {
        if (lastValidBPM.current > 0) {
          const bpmDiff = Math.abs(result.bpm - lastValidBPM.current);
          
          // Mayor tolerancia a cambios en BPM
          if (bpmDiff > 25) { // Aumentado de 20 a 25
            stableReadingsCount.current = 0;
            // Transición más rápida hacia nuevos valores
            validatedBPM = lastValidBPM.current + (result.bpm > lastValidBPM.current ? 5 : -5); // Aumentado de 3 a 5
          } else {
            stableReadingsCount.current++;
            // Mayor peso para los nuevos valores
            validatedBPM = lastValidBPM.current * 0.5 + result.bpm * 0.5; // Cambiado de 0.6/0.4 a 0.5/0.5
          }
        }
        
        lastValidBPM.current = validatedBPM;
      }
      
      // Menos lecturas estables requeridas o menor umbral de confianza
      if ((stableReadingsCount.current >= 2 || result.confidence > 0.6) && validatedBPM > 0) { // Reducido de 3 a 2 y de 0.65 a 0.6
        setCurrentBPM(Math.round(validatedBPM));
        setConfidence(result.confidence);
      }

      return {
        bpm: validatedBPM > 0 ? Math.round(validatedBPM) : (currentBPM || 70),
        confidence: result.confidence,
        isPeak: result.isBeat,
        arrhythmiaCount: 0,
        rrData
      };
    } catch (error) {
      console.error('useHeartBeatProcessor - Error al procesar señal:', error);
      return {
        bpm: currentBPM || 70,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
  }, [currentBPM, confidence]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reiniciando procesador', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      peaksDetected: peakCount.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    stableReadingsCount.current = 0;
    lastValidBPM.current = 0;
    peakCount.current = 0;
    processingStartTime.current = Date.now();
    beatDetectedOnce.current = false;
    
    // Reiniciar temporizador de detección
    stopNoBeatsDetectionTimer();
    startNoBeatsDetectionTimer();
    
    // Reiniciar verificación periódica
    stopBeatsDetectionCheck();
    startBeatsDetectionCheck();
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    peakCount: peakCount.current
  };
};
