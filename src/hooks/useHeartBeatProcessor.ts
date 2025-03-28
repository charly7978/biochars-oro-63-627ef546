
import { useState, useCallback, useRef, useEffect } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  isPeak: boolean;
  confidence: number;
  filteredValue: number;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [arrhythmiaData, setArrhythmiaData] = useState<any>(null);
  const processorRef = useRef<HeartBeatProcessor>(new HeartBeatProcessor());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Inicializar el contexto de audio para asegurar que el sonido funcione
  useEffect(() => {
    const initAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.error("AudioContext not supported in this browser");
          return;
        }
        
        audioContextRef.current = new AudioContextClass();
        
        // Intentar reanudar el contexto (útil para Safari)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Reproducir un sonido silencioso para desbloquear el audio en iOS
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0.01;
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        oscillator.start(0);
        oscillator.stop(audioContextRef.current.currentTime + 0.01);
        
        console.log("Audio context initialized:", {
          state: audioContextRef.current.state,
          sampleRate: audioContextRef.current.sampleRate
        });
      } catch (err) {
        console.error("Error initializing audio context:", err);
      }
    };
    
    initAudio();
    
    // Agregar manejadores de eventos para desbloquear el audio en interacción del usuario
    const unlockAudio = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log("Audio context resumed after user interaction");
        } catch (err) {
          console.error("Error resuming audio context:", err);
        }
      }
    };
    
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('mousedown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('mousedown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => {
          console.error("Error closing audio context:", err);
        });
      }
    };
  }, []);

  const processSignal = useCallback((ppgValue: number): HeartBeatResult => {
    const processor = processorRef.current;
    
    // Verificamos que el procesador exista
    if (!processor) {
      console.error("HeartBeat processor not initialized");
      return {
        bpm: 0,
        isPeak: false,
        confidence: 0,
        filteredValue: 0,
        arrhythmiaCount: 0
      };
    }
    
    // Procesamos la señal
    const result = processor.processSignal(ppgValue);
    
    // Actualizamos el estado del BPM si es válido
    if (result.bpm > 0) {
      setBpm(result.bpm);
    }
    
    // Devolvemos el resultado completo
    return result;
  }, []);

  // Exponer métodos adicionales
  const reset = useCallback(() => {
    const processor = processorRef.current;
    if (processor) {
      processor.reset();
      setBpm(0);
      setIsArrhythmia(false);
      setArrhythmiaData(null);
    }
  }, []);

  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    reset();
  }, [reset]);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);

  return {
    bpm,
    isArrhythmia,
    arrhythmiaData,
    isProcessing,
    processSignal,
    startProcessing,
    stopProcessing,
    reset
  };
};
