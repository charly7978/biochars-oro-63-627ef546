
import { useState, useCallback, useRef, useEffect } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';

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
  const audioInitializedRef = useRef<boolean>(false);
  const lastPeakRef = useRef<number | null>(null);
  const pendingPeakRef = useRef<boolean>(false);

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
        
        // Pasar el contexto de audio al procesador
        if (processorRef.current) {
          processorRef.current.setAudioContext(audioContextRef.current);
          audioInitializedRef.current = true;
          console.log("Audio context passed to HeartBeatProcessor");
        }
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
          
          // Volver a pasar el contexto de audio al procesador
          if (processorRef.current && audioContextRef.current) {
            processorRef.current.setAudioContext(audioContextRef.current);
            console.log("Audio context resumed and passed to HeartBeatProcessor after user interaction");
          }
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
    
    // Aseguramos que el procesador tenga el contexto de audio
    if (audioContextRef.current && !audioInitializedRef.current) {
      processor.setAudioContext(audioContextRef.current);
      audioInitializedRef.current = true;
      console.log("Audio context passed to HeartBeatProcessor during signal processing");
    }
    
    // Procesamos la señal
    const result = processor.processSignal(ppgValue);
    
    // Actualizamos el estado del BPM si es válido
    if (result.bpm > 0) {
      setBpm(result.bpm);
    }
    
    // Mejoramos la sincronización del beep con el pico visual
    // Agregamos un pequeño adelanto para compensar las latencias
    if (result.isPeak && audioContextRef.current && audioInitializedRef.current) {
      const now = Date.now();
      
      // Verificamos que no hayamos reproducido un beep recientemente
      if (!lastPeakRef.current || (now - lastPeakRef.current) > 300) {
        // Marcamos que hay un pico pendiente para reproducción inmediata
        pendingPeakRef.current = true;
        
        // Reproducimos el beep con prioridad alta (sin demora)
        try {
          if (processor.isReady()) {
            // Aumentamos ligeramente el volumen para mayor claridad
            processor.playBeep(0.45);
            lastPeakRef.current = now;
            pendingPeakRef.current = false;
            console.log("Beep played EXACTLY at peak detection", { 
              timestamp: now,
              isPeak: result.isPeak,
              filteredValue: result.filteredValue
            });
          }
        } catch (err) {
          console.error("Error playing synchronized beep at peak:", err);
          pendingPeakRef.current = false;
        }
      }
    }
    
    // Actualizar estado de arritmia si está presente en el resultado
    if (result.arrhythmiaCount > 0 && !isArrhythmia) {
      setIsArrhythmia(true);
      setArrhythmiaData(result.rrData);
      toast.warning("Se ha detectado una posible arritmia cardíaca", {
        duration: 3000,
      });
    }
    
    // Devolvemos el resultado completo
    return result;
  }, [isArrhythmia]);

  // Exponer métodos adicionales
  const reset = useCallback(() => {
    const processor = processorRef.current;
    if (processor) {
      processor.reset();
      setBpm(0);
      setIsArrhythmia(false);
      setArrhythmiaData(null);
      lastPeakRef.current = null;
      pendingPeakRef.current = false;
      
      // Reiniciar conexión de audio
      if (audioContextRef.current) {
        processor.setAudioContext(audioContextRef.current);
        console.log("Audio context reconnected after reset");
      }
    }
  }, []);

  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    reset();
    lastPeakRef.current = null;
    pendingPeakRef.current = false;
    
    // Asegurar que el audio esté habilitado al comenzar
    if (audioContextRef.current && processorRef.current) {
      audioContextRef.current.resume().then(() => {
        processorRef.current.setAudioContext(audioContextRef.current!);
        processorRef.current.setManualBeepMode(true); // Aseguramos que estamos en modo manual
        console.log("Audio context resumed at start processing");
      }).catch(err => {
        console.error("Error resuming audio context at start:", err);
      });
    }
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
