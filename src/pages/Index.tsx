
import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { toast } from "sonner";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
    glucose: 0,
    lipids: {
      totalCholesterol: 0,
      triglycerides: 0
    }
  });
  const [heartRate, setHeartRate] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  
  // References for stability
  const measurementTimerRef = useRef<number | null>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const frameQueueRef = useRef<ImageData[]>([]);
  const processingTimestampRef = useRef<number>(0);
  const lastProcessedFrameRef = useRef<number>(0);
  const lastValidHeartRateRef = useRef<number>(0);
  const processingIntervalRef = useRef<number>(33); // Target ~30fps
  const heartRateStabilityRef = useRef<number>(0);
  
  const { 
    startProcessing, 
    stopProcessing, 
    lastSignal, 
    processFrame 
  } = useSignalProcessor();
  
  const { 
    processSignal: processHeartBeat, 
    isArrhythmia,
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

  // Prevent screen locking, optimize for performance
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock is active');
        }
      } catch (err) {
        console.error(`Failed to acquire Wake Lock: ${err}`);
      }
    };
    
    acquireWakeLock();
    
    return () => {
      wakeLock?.release().then(() => {
        console.log('Wake Lock released');
      });
    };
  }, []);

  // Handle screen orientation and scroll prevention
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    // Lock orientation if possible
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.lock('portrait').catch(err => {
        console.log('Orientation lock failed:', err);
      });
    }

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  // Stabilize heart rate values to prevent flickering
  const stabilizeHeartRate = useCallback((value: number): number => {
    if (value >= 40 && value <= 200) {
      // Valid value, increase stability
      lastValidHeartRateRef.current = value;
      heartRateStabilityRef.current = Math.min(5, heartRateStabilityRef.current + 1);
      return value;
    } 
    
    // Use last valid heart rate if we have stability
    if (lastValidHeartRateRef.current > 0 && heartRateStabilityRef.current > 2) {
      // Decrease stability gradually
      heartRateStabilityRef.current = Math.max(0, heartRateStabilityRef.current - 0.5);
      return lastValidHeartRateRef.current;
    }
    
    return value;
  }, []);

  // Handle last valid results from processor
  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  // Process new signal data on every frame
  useEffect(() => {
    if (!lastSignal || !isMonitoring) return;
    
    const minQualityThreshold = 30; // Lower threshold for detection
    
    if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
      // Process heart beat
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      // Apply stabilization
      if (heartBeatResult.confidence > 0.3) {
        const stableHeartRate = stabilizeHeartRate(heartBeatResult.bpm);
        setHeartRate(stableHeartRate);
        
        // Only process vital signs on valid heart rate
        if (stableHeartRate > 40 && stableHeartRate < 200) {
          const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
          if (vitals) {
            setVitalSigns(vitals);
          }
        }
      }
      
      setSignalQuality(lastSignal.quality);
    } else {
      // Update signal quality even when finger not detected
      setSignalQuality(lastSignal.quality);
      
      // Reset heart rate when finger removed
      if (!lastSignal.fingerDetected && heartRate > 0) {
        setHeartRate(0);
        heartRateStabilityRef.current = 0;
      }
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, stabilizeHeartRate]);

  // Main processing loop for frame queue
  useEffect(() => {
    const processQueue = () => {
      if (!frameQueueRef.current.length || !isMonitoring || frameProcessingRef.current) {
        return;
      }
      
      const now = Date.now();
      const elapsed = now - lastProcessedFrameRef.current;
      
      // Enforce frame rate limit to avoid overloading the device
      if (elapsed < processingIntervalRef.current) {
        return;
      }
      
      frameProcessingRef.current = true;
      lastProcessedFrameRef.current = now;

      // Process oldest frame in queue
      const frame = frameQueueRef.current.shift();
      if (frame) {
        try {
          processFrame(frame);
        } catch (err) {
          console.error("Error processing frame:", err);
        }
      }
      
      frameProcessingRef.current = false;
    };
    
    // Set up regular processing interval
    const intervalId = setInterval(processQueue, Math.floor(processingIntervalRef.current / 2));
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isMonitoring, processFrame]);

  // Start monitoring state
  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      // Reset frame processing state
      frameQueueRef.current = [];
      frameProcessingRef.current = false;
      lastProcessedFrameRef.current = 0;
      lastValidHeartRateRef.current = 0;
      heartRateStabilityRef.current = 0;
      
      startProcessing();
      startHeartBeatMonitoring();
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          if (newTime >= 45) {
            finalizeMeasurement();
            return 45;
          }
          return newTime;
        });
      }, 1000);
      
      toast.success("Medición iniciada", {
        description: "Coloque su dedo sobre la cámara"
      });
    }
  };

  // Enter full screen mode
  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        console.log('Fullscreen API not supported');
      }
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  // Finish measurement process
  const finalizeMeasurement = () => {
    console.log("Finalizando medición");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    
    // Clear frame queue
    frameQueueRef.current = [];
    frameProcessingRef.current = false;
    
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
    
    toast.info("Medición finalizada", {
      description: "Resultados guardados"
    });
  };

  // Complete reset of the app
  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    
    // Clear processing state
    frameQueueRef.current = [];
    frameProcessingRef.current = false;
    lastValidHeartRateRef.current = 0;
    heartRateStabilityRef.current = 0;
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({ 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    });
    setSignalQuality(0);
    
    toast.success("Aplicación reiniciada", {
      description: "Todos los datos han sido borrados"
    });
  };

  // Camera stream processing
  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    // Try to enable torch for better signal
    if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    }
    
    // Set up canvas for frame processing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Track performance
    let lastProcessTime = 0;
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    
    // Target 30fps for real-time processing
    const processingInterval = 33; // ~30fps
    processingIntervalRef.current = processingInterval;
    
    // Frame capture function
    const captureFrame = async () => {
      if (!isMonitoring) return;
      
      try {
        const now = Date.now();
        
        // Skip if we just processed a frame recently (throttle capture)
        if (now - lastProcessTime < processingInterval) {
          requestAnimationFrame(captureFrame);
          return;
        }
        
        // Capture new frame
        const frame = await imageCapture.grabFrame();
        lastProcessTime = now;
        
        // Optimize frame size for better performance
        const targetWidth = Math.min(320, frame.width);
        const targetHeight = Math.min(240, frame.height);
        
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        
        // Draw frame to canvas with reduced size
        tempCtx.drawImage(
          frame, 
          0, 0, frame.width, frame.height, 
          0, 0, targetWidth, targetHeight
        );
        
        // Get image data and queue for processing
        const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
        
        // Limit queue size to avoid memory issues
        if (frameQueueRef.current.length < 5) {
          frameQueueRef.current.push(imageData);
        }
        
        // Track performance
        frameCount++;
        if (now - lastFpsUpdateTime > 1000) {
          const fps = frameCount;
          console.log(`Rendimiento de captura: ${fps} FPS`);
          
          // Adapt processing interval based on device performance
          if (fps < 20 && processingIntervalRef.current < 50) {
            // Device struggling - reduce frame rate
            processingIntervalRef.current += 5;
            console.log(`Ajustando intervalo de procesamiento a ${processingIntervalRef.current}ms`);
          } else if (fps > 28 && processingIntervalRef.current > 25) {
            // Device handling well - try to increase frame rate
            processingIntervalRef.current -= 2;
          }
          
          frameCount = 0;
          lastFpsUpdateTime = now;
        }
        
        // Continue capture loop
        requestAnimationFrame(captureFrame);
      } catch (error) {
        // Handle error but continue capture loop if monitoring
        console.error("Error capturando frame:", error);
        
        if (isMonitoring) {
          // Wait a bit before retrying after error
          setTimeout(() => {
            requestAnimationFrame(captureFrame);
          }, 200);
        }
      }
    };

    // Start the capture loop
    captureFrame();
  };

  // Button handler
  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-black" style={{ 
      height: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: '100vh',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)'
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
            <div className="text-white text-lg">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-lg">
              {lastSignal?.fingerDetected ? "Huella Detectada" : "Huella No Detectada"}
            </div>
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              arrhythmiaWindows={vitalSigns.arrhythmiaWindows}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 top-[45%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 place-items-center h-full overflow-y-auto pb-4">
              <VitalSign 
                label="FRECUENCIA CARDÍACA"
                value={heartRate || "--"}
                unit="BPM"
                highlighted={showResults}
              />
              <VitalSign 
                label="SPO2"
                value={vitalSigns.spo2 || "--"}
                unit="%"
                highlighted={showResults}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL"
                value={vitalSigns.pressure}
                unit="mmHg"
                highlighted={showResults}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="COLESTEROL"
                value={vitalSigns.lipids?.totalCholesterol || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="TRIGLICÉRIDOS"
                value={vitalSigns.lipids?.triglycerides || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
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

      {isMonitoring && (
        <div className="absolute bottom-40 left-0 right-0 text-center">
          <span className="text-xl font-medium text-gray-300">{elapsedTime}s / 45s</span>
        </div>
      )}
    </div>
  );
};

export default Index;
