import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useOptimizedVitalSigns } from "@/hooks/useOptimizedVitalSigns";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';
import { registerGlobalCleanup } from '@/utils/cleanup-utils';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import BidirectionalFeedbackService from '@/services/BidirectionalFeedbackService';
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
    lastValidResults,
    optimizationStats,
    getCurrentSignalQuality
  } = useOptimizedVitalSigns();

  // Ref to store the brightness adjustment function
  const adjustBrightnessRef = useRef<((targetBrightness: number) => Promise<void>) | null>(null);

  // Callback for CameraView to provide the function
  const handleSetAdjustBrightnessCallback = useCallback((callback: (targetBrightness: number) => Promise<void>) => {
    console.log("Index: Recibido adjustBrightness callback desde CameraView.");
    adjustBrightnessRef.current = callback;
  }, []);

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
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40; // Threshold for processing vitals

      // --- START Brightness Adjustment Logic ---
      const lowQualityForBrightness = 30; // Threshold to trigger brightness adjustment
      // Use rawValue as proxy for DC level - adjust threshold as needed
      const highBrightnessThreshold = 200; // Example: Trigger if average brightness is above this
      const targetLowBrightness = 110; // Example: Target brightness when reducing

      // Check if the adjust function exists AND if quality is low AND raw value indicates high brightness
      if (
        adjustBrightnessRef.current &&
        lastSignal.quality < lowQualityForBrightness &&
        lastSignal.rawValue > highBrightnessThreshold
      ) {
        console.log(`Index: Calidad baja (${lastSignal.quality}) y/o señal alta (${lastSignal.rawValue}). Intentando reducir brillo.`);
        // Call the adjust function - no need for .then/.catch here unless specific handling needed
        adjustBrightnessRef.current(targetLowBrightness);
      }
      // TODO: Add logic to potentially increase brightness if signal is too dim (low rawValue)
      // --- END Brightness Adjustment Logic ---


      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);

        if (heartBeatResult.confidence > 0.4) {
          setHeartRate(heartBeatResult.bpm);

          try {
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              setVitalSigns(vitals);

              setIsArrhythmia(ArrhythmiaDetectionService.isArrhythmia());
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
    // adjustBrightnessRef itself is stable, no need to list as dependency.
    // Dependencies should be values that trigger re-run when changed.
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
    startSignalProcessing();
    
    BidirectionalFeedbackService.setDebugMode(true);
    
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
    
    console.log("Measurement complete with optimizations:", optimizationStats);
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
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;

    console.log("Index: handleStreamReady llamado. Stream recibido.");

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("Index: No se encontró videoTrack en handleStreamReady.");
      stopMonitoring();
      return;
    }

    // *** RE-ENABLE IMAGE PROCESSING LOOP ***
    console.log("Index: Reactivando bucle processImage.");
    const imageCapture = new ImageCapture(videoTrack);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
     if (!tempCtx) {
       console.error("No se pudo obtener el contexto 2D para processImage.");
       stopMonitoring(); // Stop if context fails
       return;
     }

    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // Aim for 30fps processing
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;

    const processImage = async () => {
      // console.log("processImage: Loop start. isMonitoring:", isMonitoring);

      if (!isMonitoring || !stream || !videoTrack || videoTrack.readyState !== 'live') {
        if (isMonitoring) {
          console.error(`processImage: Stopping. isMonitoring=${isMonitoring}, stream=${!!stream}, track=${!!videoTrack}, trackState=${videoTrack?.readyState}`);
          stopMonitoring();
        }
        return;
      }

      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;

      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          // *** START EXTREME SIMPLIFICATION ***
          console.time("FrameProcessingTotal");
          console.log("processImage: Loop running (Simplified - No Frame Grab/Draw/Process)");

          /* // Commented out actual frame processing
          if (videoTrack.readyState !== 'live') throw new DOMException('Track ended before grabFrame', 'InvalidStateError');
          console.time("grabFrame");
          const frame = await imageCapture.grabFrame();
          console.timeEnd("grabFrame");

          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          if (!tempCtx) throw new Error("Canvas context lost during loop");

          console.time("drawImage");
          tempCtx.drawImage(
            frame,
            0, 0, frame.width, frame.height,
            0, 0, targetWidth, targetHeight
          );
          console.timeEnd("drawImage");
          frame.close();

          console.time("getImageData");
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
          console.timeEnd("getImageData");
          
          console.time("processFrameHook");
          // processFrame(imageData); // Call commented out
          console.timeEnd("processFrameHook");
          */

           // Simulate processing time slightly
           await new Promise(resolve => setTimeout(resolve, 5)); 
         
          // Call processFrame with null to test if the call itself causes issues
           // console.log("processImage: Calling processFrame(null) for testing...");
           // processFrame(null as any); 
           // console.log("processImage: Call to processFrame(null) completed.");

          // --- Update timing and FPS (keep this part) ---
          frameCount++;
          lastProcessTime = now;
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            // console.log(`Processing FPS (Simplified Loop): ${processingFps}`);
            frameCount = 0;
            lastFpsUpdateTime = now;
          }
          console.timeEnd("FrameProcessingTotal");
          // *** END EXTREME SIMPLIFICATION ***

        } catch (error) {
          console.timeEnd("FrameProcessingTotal");
          console.error("processImage: Error caught inside simplified loop:", error);
          if (error instanceof DOMException) {
            console.error(`processImage: DOMException Name: ${error.name}, Message: ${error.message}`);
          }
          console.error(`processImage: Stopping monitoring due to error. trackState: ${videoTrack?.readyState}`);
          stopMonitoring();
          return;
        }
      }

      if (isMonitoring) {
        requestAnimationFrame(processImage);
      } else {
         console.log("processImage: Monitoring stopped, not requesting next frame.");
      }
    };

    if (videoTrack && videoTrack.readyState === 'live') {
       console.log("Index: Iniciando bucle processImage porque videoTrack está 'live'.") // Added log
      processImage();
    } else {
      console.error("Index: No se puede iniciar processImage, videoTrack no está 'live'. State:", videoTrack?.readyState);
      stopMonitoring(); // Stop if track is not live initially
    }
    // *** END RE-ENABLE ***
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
            setAdjustBrightnessCallback={handleSetAdjustBrightnessCallback}
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
