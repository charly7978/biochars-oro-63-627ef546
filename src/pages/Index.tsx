
import React, { useState, useRef, useEffect, useMemo } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/heart-beat/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { Droplet } from "lucide-react";
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';

const Index = () => {
  // Estado principal
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>(() => ResultFactory.createEmptyResults());
  const [heartRate, setHeartRate] = useState<number | string>("--");
  const [signalQuality, setSignalQuality] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Referencias para mejorar rendimiento
  const measurementTimer = useRef<NodeJS.Timeout | null>(null);
  const arrhythmiaTimer = useRef<NodeJS.Timeout | null>(null);
  const bpmCache = useRef<number[]>([]);
  const lastSignalRef = useRef<any>(null);
  const lastProcessTime = useRef<number>(0);
  const frameSkipCount = useRef<number>(0);
  const processorActive = useRef<boolean>(false);

  const {
    startProcessing: startSignalProcessing,
    stopProcessing: stopSignalProcessing,
    processFrame,
    lastSignal,
    error: processingError,
    optimizationLevel
  } = useSignalProcessor();

  const { 
    processSignal: processHeartBeat,
    reset: resetHeartBeatProcessor,
    currentBPM,
    confidence,
    isArrhythmia: heartBeatIsArrhythmia,
    requestBeep,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  // Memorizar funciones costosas para evitar recálculos
  const getHydrationColor = useMemo(() => (hydration: number) => {
    if (hydration >= 80) return 'text-blue-500';
    if (hydration >= 65) return 'text-green-500';
    if (hydration >= 50) return 'text-yellow-500';
    return 'text-red-500';
  }, []);

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  // Prevenir scroll para mejor rendimiento
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  // Actualizar resultados cuando estén disponibles
  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  // Procesar señal con optimización
  useEffect(() => {
    if (!lastSignal || !isMonitoring) {
      if (!isMonitoring) {
        setSignalQuality(0);
      }
      return;
    }
    
    // Controlar frecuencia de procesamiento basado en tiempo
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime.current;
    const processingInterval = optimizationLevel === 'high' ? 100 : 
                               optimizationLevel === 'medium' ? 50 : 30;
    
    // Omitir algunos cuadros para mejorar rendimiento
    if (timeSinceLastProcess < processingInterval) {
      frameSkipCount.current++;
      return;
    }
    
    // Procesar señal con umbral de calidad
    const minQualityThreshold = 40;
    
    if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      if (heartBeatResult && heartBeatResult.confidence > 0.4) {
        setHeartRate(heartBeatResult.bpm);
        
        try {
          // Solo procesar signos vitales cuando la confianza es alta
          if (heartBeatResult.confidence > 0.6) {
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              setVitalSigns(prev => ({...prev, ...vitals}));
            }
          }
        } catch (error) {
          console.error("Error processing vital signs:", error);
        }
      }
      
      setSignalQuality(lastSignal.quality);
    } else {
      setSignalQuality(lastSignal.quality);
      
      // Convertir heartRate a número para comparación
      if (!lastSignal.fingerDetected && typeof heartRate === 'number' && heartRate > 0) {
        setHeartRate(0);
      }
    }
    
    // Actualizar tiempo de último procesamiento
    lastProcessTime.current = now;
    
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, optimizationLevel]);

  // Actualizar frecuencia cardíaca
  useEffect(() => {
    if (vitalSigns.heartRate && vitalSigns.heartRate > 0) {
      setHeartRate(vitalSigns.heartRate);
    } else if (!isMonitoring) {
      if (!showResults) {
        setHeartRate("--");
      }
    } else {
      setHeartRate("--");
    }
  }, [vitalSigns.heartRate, isMonitoring, showResults]);

  const startMonitoring = () => {
    console.log("Starting monitoring...");
    setVitalSigns(ResultFactory.createEmptyResults());
    setShowResults(false);
    setIsArrhythmia(false);
    bpmCache.current = [];
    lastProcessTime.current = Date.now();
    frameSkipCount.current = 0;
    processorActive.current = true;
    setIsCameraOn(true);
    setIsMonitoring(true);
    startSignalProcessing();
    startHeartBeatMonitoring();
    
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    measurementTimer.current = setTimeout(() => {
      console.log("30 second measurement timer elapsed.");
      finalizeMeasurement();
    }, 30000);
  };

  const finalizeMeasurement = () => {
    if (!isMonitoring) return;
    console.log("Finalizing measurement...");
    setShowResults(true);
    stopMonitoring();
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopSignalProcessing();
    stopHeartBeatMonitoring();
    processorActive.current = false;
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (measurementTimer.current) {
      clearTimeout(measurementTimer.current);
      measurementTimer.current = null;
    }
    
    if (arrhythmiaTimer.current) {
      clearTimeout(arrhythmiaTimer.current);
      arrhythmiaTimer.current = null;
    }
  };

  const handleReset = () => {
    console.log("Resetting application state...");
    stopMonitoring();
    fullResetVitalSigns();
    resetHeartBeatProcessor();
    setVitalSigns(ResultFactory.createEmptyResults());
    setHeartRate("--");
    setSignalQuality(0);
    setIsArrhythmia(false);
    setShowResults(false);
    frameSkipCount.current = 0;
    lastProcessTime.current = 0;
    
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    if (arrhythmiaTimer.current) clearTimeout(arrhythmiaTimer.current);
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
    const targetFrameInterval = 1000/20; // Reducido de 30fps a 20fps para mejor rendimiento
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    const processImage = async () => {
      if (!isMonitoring || !stream || !videoTrack || videoTrack.readyState !== 'live') {
        if (isMonitoring) {
          console.error("Camera track is not live or stream lost. Stopping monitoring.");
          finalizeMeasurement();
        }
        return;
      }
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Controlar la frecuencia de muestreo para mejorar rendimiento
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          if (videoTrack.readyState !== 'live') throw new DOMException('Track ended before grabFrame', 'InvalidStateError');
          
          const frame = await imageCapture.grabFrame();
          
          // Reducir resolución para mejor rendimiento
          const targetWidth = Math.min(256, frame.width);
          const targetHeight = Math.min(192, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          if (!tempCtx) throw new Error("Canvas context lost");
          
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
          
          // Procesar frame con optimización
          if (processorActive.current) {
            processFrame(imageData);
          }
          
          frameCount++;
          lastProcessTime = now;
          
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            frameCount = 0;
            lastFpsUpdateTime = now;
            
            // Log de rendimiento en intervalos
            if (processingFps < 15) {
              console.log(`Rendimiento bajo: ${processingFps} FPS - Nivel optimización: ${optimizationLevel}`);
            }
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'InvalidStateError') {
            console.error("Error capturando frame: Track state is invalid. Stopping monitoring.", error);
            finalizeMeasurement();
            return;
          } else {
            console.error("Error capturando frame (other):", error);
            finalizeMeasurement();
            return;
          }
        }
      }
      
      if (isMonitoring) {
        // Usar requestAnimationFrame para sincronizar con el refresco de pantalla
        requestAnimationFrame(processImage);
      }
    };

    if (videoTrack && videoTrack.readyState === 'live') {
      processImage();
    } else {
      console.error("Cannot start processing loop, video track is not live.");
      finalizeMeasurement();
    }
  };

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{
      height: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: '100vh',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'linear-gradient(to bottom, #9b87f5 0%, #D6BCFA 15%, #8B5CF6 30%, #D946EF 45%, #F97316 60%, #0EA5E9 75%, #1A1F2C 85%, #221F26 92%, #222222 100%)'
    }}>
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <CameraView 
            onStreamReady={handleStreamReady} 
            isMonitoring={isCameraOn} 
            isFingerDetected={lastSignal?.fingerDetected} 
            signalQuality={signalQuality} 
          />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-sm">Calidad: {signalQuality}</div>
            <div className="text-white text-sm">{lastSignal?.fingerDetected ? "Huella Detectada" : "Huella No Detectada"}</div>
            {optimizationLevel !== 'low' && (
              <div className="text-white text-xs">Optimización: {optimizationLevel}</div>
            )}
          </div>
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0} 
              quality={lastSignal?.quality || 0} 
              isFingerDetected={lastSignal?.fingerDetected || false} 
              onStartMeasurement={startMonitoring} 
              onReset={handleReset} 
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus || "--"} 
              preserveResults={showResults} 
              isArrhythmia={isArrhythmia}
            />
          </div>
          <AppTitle />
          <div className="absolute inset-x-0 bottom-[40px] h-[40%] px-2 py-2">
            <div className="grid grid-cols-2 h-full gap-2">
              <div className="col-span-2 grid grid-cols-2 gap-2 mb-2">
                <VitalSign label="FRECUENCIA CARDÍACA" value={heartRate || "--"} unit="BPM" highlighted={showResults} compact={false} />
                <VitalSign label="SPO2" value={vitalSigns.spo2 || "--"} unit="%" highlighted={showResults} compact={false} />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <VitalSign label="PRESIÓN" value={vitalSigns.pressure || "--/--"} unit="mmHg" highlighted={showResults} compact={false} />
                <VitalSign label="HIDRATACIÓN" value={vitalSigns.hydration || "--"} unit="%" highlighted={showResults} icon={<Droplet className={`h-4 w-4 ${getHydrationColor(vitalSigns.hydration)}`} />} compact={false} />
              </div>
              <VitalSign label="GLUCOSA" value={vitalSigns.glucose || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="COLESTEROL" value={vitalSigns.lipids?.totalCholesterol || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="TRIGLICÉRIDOS" value={vitalSigns.lipids?.triglycerides || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="HEMOGLOBINA" value={Math.round(vitalSigns.hemoglobin) || "--"} unit="g/dL" highlighted={showResults} compact={false} />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-1 flex gap-1 px-1">
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleToggleMonitoring} 
                variant="monitor" 
              />
            </div>
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleReset} 
                variant="reset" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
