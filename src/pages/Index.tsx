import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';
import { registerGlobalCleanup } from '@/utils/cleanup-utils';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import MonitorButton from "@/components/MonitorButton";
import { Droplet } from "lucide-react";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>(() => ResultFactory.createEmptyResults());
  const [heartRate, setHeartRate] = useState<number | string>("--");
  const [signalQuality, setSignalQuality] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const measurementTimer = useRef<NodeJS.Timeout | null>(null);
  const bpmCache = useRef<number[]>([]);
  const lastSignalRef = useRef<any>(null);
  const debugFrameCountRef = useRef(0);
  const processedFrameCountRef = useRef(0);

  const {
    startProcessing: startSignalProcessing,
    stopProcessing: stopSignalProcessing,
    processFrame,
    lastSignal,
    error: processingError
  } = useSignalProcessor();

  const { 
    processSignal: processHeartBeat, 
    isArrhythmia: heartBeatIsArrhythmia,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
    reset: resetHeartBeatProcessor
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  useEffect(() => {
    registerGlobalCleanup();
    
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
      console.log("Index: Setting vital signs from lastValidResults", lastValidResults);
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      debugFrameCountRef.current++;
      processedFrameCountRef.current++;
      const minQualityThreshold = 30;
      
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        
        if (heartBeatResult.confidence > 0.3) {
          setHeartRate(heartBeatResult.bpm);
          
          try {
            if (debugFrameCountRef.current % 30 === 0) {
              console.log("Index: Processing vital signs", {
                filteredValue: lastSignal.filteredValue,
                hasRRData: !!heartBeatResult.rrData,
                rrIntervals: heartBeatResult.rrData?.intervals?.length || 0,
                frameCount: debugFrameCountRef.current,
                signalQuality: lastSignal.quality
              });
            }
            
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            
            if (vitals) {
              if (processedFrameCountRef.current % 30 === 0) {
                console.log("Index: Received vitals update", {
                  heartRate: vitals.heartRate,
                  spo2: vitals.spo2, 
                  pressure: vitals.pressure,
                  glucose: vitals.glucose,
                  hydration: vitals.hydration,
                  lipids: vitals.lipids,
                  hemoglobin: vitals.hemoglobin,
                  frameCount: processedFrameCountRef.current
                });
              }
              
              setVitalSigns(vitals);
              setIsArrhythmia(ArrhythmiaDetectionService.isArrhythmia());
              
              if (processedFrameCountRef.current % 60 === 0) {
                console.log("Current values on screen:", {
                  heartRate: typeof heartRate === 'number' ? heartRate : 'Not numeric',
                  spo2: vitals.spo2,
                  pressure: vitals.pressure,
                  glucose: vitals.glucose,
                  hydration: vitals.hydration,
                  lipids: vitals.lipids,
                  hemoglobin: vitals.hemoglobin
                });
              }
            }
          } catch (error) {
            console.error("Error processing vital signs:", error);
          }
        }
        
        setSignalQuality(lastSignal.quality);
      } else {
        setSignalQuality(lastSignal.quality);
        
        if (!lastSignal.fingerDetected && typeof heartRate === 'number' && heartRate > 0) {
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, heartBeatIsArrhythmia]);

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
    setIsCameraOn(true);
    setIsMonitoring(true);
    processedFrameCountRef.current = 0;
    startSignalProcessing();
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
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (measurementTimer.current) {
      clearTimeout(measurementTimer.current);
      measurementTimer.current = null;
    }
  };

  const handleReset = () => {
    console.log("Resetting application state...");
    stopMonitoring();
    fullResetVitalSigns();
    setVitalSigns(ResultFactory.createEmptyResults());
    setHeartRate("--");
    setSignalQuality(0);
    setIsArrhythmia(false);
    setShowResults(false);
    processedFrameCountRef.current = 0;
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    setStream(stream);
    
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
      
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          if (videoTrack.readyState !== 'live') throw new DOMException('Track ended before grabFrame', 'InvalidStateError');
          
          const frame = await imageCapture.grabFrame();
          
          const targetWidth = frame.width < 320 ? frame.width : 320;
          const targetHeight = frame.height < 240 ? frame.height : 240;
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          if (!tempCtx) throw new Error("Canvas context lost");
          
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
          processFrame(imageData);
          
          frameCount++;
          lastProcessTime = now;
          
          if (now - lastFpsUpdateTime > 1000) {
            frameCount = 0;
            lastFpsUpdateTime = now;
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

  const getHydrationColor = (hydration: number): string => {
    if (hydration >= 80) return 'text-blue-500';
    if (hydration >= 65) return 'text-green-500';
    if (hydration >= 50) return 'text-yellow-500';
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
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
              preserveResults={showResults} 
              isArrhythmia={isArrhythmia}
              arrhythmiaWindows={ArrhythmiaDetectionService.getArrhythmiaWindows()}
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
                <VitalSign 
                  label="HIDRATACIÓN" 
                  value={vitalSigns.hydration || "--"} 
                  unit="%" 
                  highlighted={showResults} 
                  icon={<Droplet className={`h-4 w-4 ${getHydrationColor(vitalSigns.hydration)}`} />} 
                  compact={false} 
                />
              </div>
              <VitalSign label="GLUCOSA" value={vitalSigns.glucose || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="COLESTEROL" value={vitalSigns.lipids?.totalCholesterol || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="TRIGLICÉRIDOS" value={vitalSigns.lipids?.triglycerides || "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              <VitalSign label="HEMOGLOBINA" value={vitalSigns.hemoglobin || "--"} unit="g/dL" highlighted={showResults} compact={false} />
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
