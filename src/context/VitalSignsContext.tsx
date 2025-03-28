
import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { toast } from "sonner";

interface VitalSignsContextType {
  // Measurement state
  isMonitoring: boolean;
  isCameraOn: boolean;
  signalQuality: number;
  vitalSigns: VitalSignsResult;
  heartRate: number;
  elapsedTime: number;
  showResults: boolean;
  lastSignal: {
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  } | null;
  isArrhythmia: boolean;
  
  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetAll: () => void;
  handleStreamReady: (stream: MediaStream) => void;
}

const initialVitalSigns: VitalSignsResult = {
  spo2: 0,
  pressure: "--/--",
  arrhythmiaStatus: "--",
  glucose: 0,
  lipids: {
    totalCholesterol: 0,
    triglycerides: 0
  }
};

const VitalSignsContext = createContext<VitalSignsContextType | undefined>(undefined);

export const useVitalSigns = () => {
  const context = useContext(VitalSignsContext);
  if (!context) {
    throw new Error("useVitalSigns must be used within a VitalSignsProvider");
  }
  return context;
};

export const VitalSignsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>(initialVitalSigns);
  const [heartRate, setHeartRate] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  
  // Custom hooks
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat, isArrhythmia } = useHeartBeatProcessor();
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  const startMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      
      startProcessing();
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          if (newTime >= 30) {
            stopMonitoring();
            return 30;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const stopMonitoring = () => {
    console.log("Finalizando medición: manteniendo resultados");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setSignalQuality(0);
  };

  const resetAll = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns(initialVitalSigns);
    setSignalQuality(0);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30;
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;
    enhanceCanvas.height = 240;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          
          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          if (enhanceCtx) {
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.05)';
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.globalCompositeOperation = 'source-over';
            
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            processFrame(imageData);
          } else {
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
          }
          
          frameCount++;
          lastProcessTime = now;
          
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            frameCount = 0;
            lastFpsUpdateTime = now;
            console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
          }
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };

    processImage();
  };

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  const value = {
    isMonitoring,
    isCameraOn,
    signalQuality,
    vitalSigns,
    heartRate,
    elapsedTime,
    showResults,
    lastSignal,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    resetAll,
    handleStreamReady
  };

  return (
    <VitalSignsContext.Provider value={value}>
      {children}
    </VitalSignsContext.Provider>
  );
};
