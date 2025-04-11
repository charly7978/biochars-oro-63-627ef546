import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { Droplet } from "lucide-react";
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>(() => ResultFactory.createEmptyResults());
  const [signalQuality, setSignalQuality] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const measurementTimer = useRef<NodeJS.Timeout | null>(null);
  const arrhythmiaTimer = useRef<NodeJS.Timeout | null>(null);
  const bpmCache = useRef<number[]>([]);
  const lastSignalRef = useRef<any>(null);
  const lastVibratedBpmRef = useRef<number>(0);

  const {
    startProcessing: startSignalCapture,
    stopProcessing: stopSignalCapture,
    processFrame,
    lastSignal,
    error: processingError
  } = useSignalProcessor();

  const { 
    processSignal: calculateAllVitalSigns, 
    reset: resetVitalSignsProcessor,
    fullReset: fullResetVitalSignsProcessor,
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
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      let currentVitals: VitalSignsResult | null = null;

      setSignalQuality(lastSignal.quality || 0);
      lastSignalRef.current = lastSignal;
      
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        try {
            currentVitals = calculateAllVitalSigns(lastSignal.filteredValue, undefined);
        } catch (error) {
            console.error("Error processing vital signs:", error);
            currentVitals = null;
        }
      }

      if (currentVitals) {
        const previousHeartRate = vitalSigns.heartRate;
        const newHeartRate = currentVitals.heartRate;

        setVitalSigns(currentVitals);

        if (newHeartRate && newHeartRate > 0 && newHeartRate !== lastVibratedBpmRef.current) {
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          lastVibratedBpmRef.current = newHeartRate;
        } else if (!newHeartRate || newHeartRate <= 0) {
          lastVibratedBpmRef.current = 0;
        }

        if (currentVitals.arrhythmiaStatus?.includes('ARRHYTHMIA')) {
          if (!isArrhythmia) {
            setIsArrhythmia(true);
            if (arrhythmiaTimer.current) clearTimeout(arrhythmiaTimer.current);
            arrhythmiaTimer.current = setTimeout(() => setIsArrhythmia(false), 5000);
          }
        }
      } 
      else if (lastSignal && !lastSignal.fingerDetected) {
         lastVibratedBpmRef.current = 0;
      }

    } else if (!isMonitoring) {
      setSignalQuality(0);
      lastVibratedBpmRef.current = 0;
    }
  }, [lastSignal, isMonitoring, calculateAllVitalSigns]);

  const startMonitoring = () => {
    console.log("Starting monitoring...");
    setVitalSigns(ResultFactory.createEmptyResults());
    setShowResults(false);
    setIsArrhythmia(false);
    bpmCache.current = [];
    setIsCameraOn(true);
    setIsMonitoring(true);
    startSignalCapture();
    
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    measurementTimer.current = setTimeout(() => {
      console.log("30 second measurement timer elapsed.");
      finalizeMeasurement();
    }, 30000);
    enterFullScreen().catch(err => console.error("Error entering fullscreen:", err));
  };

  const finalizeMeasurement = () => {
    if (!isMonitoring) return;
    console.log("Finalizing measurement...");
    setShowResults(true);
    stopMonitoring();
    if (document.exitFullscreen) { 
      document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
    } else { 
      console.warn("exitFullscreen not available on document");
    }
  };

  const stopMonitoring = () => {
    if (!isMonitoring && !isCameraOn) return;
    console.log("Stopping monitoring & camera...");
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopSignalCapture();
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
    resetVitalSignsProcessor();
  };

  const handleReset = () => {
    console.log("Resetting application state...");
    stopMonitoring();
    fullResetVitalSignsProcessor();
    setVitalSigns(ResultFactory.createEmptyResults());
    setSignalQuality(0);
    setIsArrhythmia(false);
    setShowResults(false);
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    if (arrhythmiaTimer.current) clearTimeout(arrhythmiaTimer.current);
    lastVibratedBpmRef.current = 0;
  };

  const handleStreamReady = (streamParam: MediaStream) => {
    console.log("Stream Ready, setting state and starting processing loop.");
    setStream(streamParam);
    if (!isMonitoring) return;
    
    const videoTrack = streamParam.getVideoTracks()[0];
    if (!videoTrack) { console.error("No video track!"); finalizeMeasurement(); return; }
    const imageCapture = new ImageCapture(videoTrack);
    
    if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({ advanced: [{ torch: true }] })
        .catch(err => console.error("Error activando linterna:", err));
    } else { console.warn("Linterna no disponible."); }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) { console.error("No context 2D"); finalizeMeasurement(); return; }
    
    let lastProcessTime = 0;
    const FRAME_PROCESSING_INTERVAL_MS = 200; // Process frame ~5 times per second

    const processImage = async () => {
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      } else {
        return; // Stop loop if not monitoring
      }

      if (!videoTrack || videoTrack.readyState !== 'live') {
        if (isMonitoring) {
          console.error("Track not live in processImage loop. Stopping.");
          finalizeMeasurement(); 
        }
        return; 
      }

      const now = Date.now();
      if (now - lastProcessTime < FRAME_PROCESSING_INTERVAL_MS) {
        return; // Not enough time passed, skip processing this frame
      }
      lastProcessTime = now; // Update time only when we are actually processing

      try {
        if (videoTrack.readyState !== 'live') throw new DOMException('Track ended before grabFrame', 'InvalidStateError');
        
        const frame = await imageCapture.grabFrame();
        
        if (!tempCtx) throw new Error("Canvas context lost");
        const targetWidth = Math.min(320, frame.width);
        const targetHeight = Math.min(240, frame.height);
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        tempCtx.drawImage(frame, 0, 0, frame.width, frame.height, 0, 0, targetWidth, targetHeight);
        const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
        
        processFrame(imageData); 

      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.error("ERROR CRÍTICO: Track inválido capturado.", error);
        } else {
          console.error("Error capturando/procesando frame:", error);
        }
        finalizeMeasurement(); // Stop on any error during processing
        return; // Stop loop
      }
    };

    if (videoTrack.readyState === 'live') {
      processImage();
    } else {
      console.error("Track no disponible al iniciar processImage loop.");
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

  const getHydrationColor = (hydration) => {
    if (hydration >= 80)
      return 'text-blue-500';
    if (hydration >= 65)
      return 'text-green-500';
    if (hydration >= 50)
      return 'text-yellow-500';
    return 'text-red-500';
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
                <VitalSign label="FRECUENCIA CARDÍACA" value={(vitalSigns.heartRate && vitalSigns.heartRate > 0) ? vitalSigns.heartRate : "--"} unit="BPM" highlighted={showResults} compact={false} />
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
