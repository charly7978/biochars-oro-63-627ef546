
import React, { useState, useRef, useEffect, useMemo } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { useParallelProcessing } from "@/hooks/useParallelProcessing";
import PerformanceMonitor from "@/components/PerformanceMonitor";

const PERFORMANCE_OPTIMIZATION = true;
const MEASUREMENT_DURATION = 30; // seconds
const MIN_QUALITY_THRESHOLD = 40;
const FRAMES_TO_PROCESS = 2; // Process 1 in every N frames

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
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  
  const measurementTimerRef = useRef<number | null>(null);
  const frameCounterRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const processingCapacityRef = useRef(1);
  const processingRateRef = useRef(FRAMES_TO_PROCESS);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
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
  
  const {
    isWorkerAvailable,
    processSignalParallel,
    resetWorker
  } = useParallelProcessing();

  // Dynamic processing capacity assessment
  useEffect(() => {
    if (!PERFORMANCE_OPTIMIZATION) return;
    
    // Simple benchmark to assess device capability
    const assess = () => {
      const start = performance.now();
      let sum = 0;
      for (let i = 0; i < 50000; i++) {
        sum += Math.sin(i * 0.01) * Math.cos(i * 0.02);
      }
      const duration = performance.now() - start;
      
      // Adjust processing capacity based on benchmark
      // Longer duration means slower device
      if (duration > 100) {
        processingCapacityRef.current = 0.5; // Very slow device
        processingRateRef.current = 3; // Process 1 in 3 frames
        console.log("Low processing capacity detected, reducing workload");
      } else if (duration > 50) {
        processingCapacityRef.current = 0.75; // Medium device
        processingRateRef.current = 2; // Process 1 in 2 frames
        console.log("Medium processing capacity detected");
      } else {
        processingCapacityRef.current = 1; // Fast device
        processingRateRef.current = 1; // Process all frames
        console.log("High processing capacity detected");
      }
    };
    
    assess();
  }, []);

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

  // Optimized signal processing with rate limiting
  useEffect(() => {
    if (lastSignal && isMonitoring) {
      // Apply processing rate limiting
      frameCounterRef.current = (frameCounterRef.current + 1) % processingRateRef.current;
      
      // Only process if it's our turn and we have a minimum quality
      const shouldProcess = frameCounterRef.current === 0;
      const minQualityThreshold = MIN_QUALITY_THRESHOLD;
      
      // Always update signal quality and finger detection status
      setSignalQuality(lastSignal.quality);
      
      if (shouldProcess && lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        // Use Web Worker for processing if available
        if (isWorkerAvailable && PERFORMANCE_OPTIMIZATION) {
          processSignalParallel([lastSignal.filteredValue], 30)
            .then(result => {
              if (result && result.bpm > 0 && result.confidence > 0.4) {
                setHeartRate(result.bpm);
                
                // Still process vital signs in main thread for now
                const vitals = processVitalSigns(lastSignal.filteredValue, {
                  intervals: result.intervals || [],
                  lastPeakTime: Date.now()
                });
                
                if (vitals) {
                  setVitalSigns(vitals);
                }
              }
            })
            .catch(err => {
              console.error("Error processing signal in worker:", err);
              // Fallback to main thread processing
              processSignalInMainThread();
            });
        } else {
          // Process in main thread if worker not available
          processSignalInMainThread();
        }
      } else if (!lastSignal.fingerDetected && heartRate > 0) {
        // If finger not detected for a while, reset heart rate to zero
        setHeartRate(0);
      }
    } else if (!isMonitoring) {
      // If not monitoring, maintain zero values
      setSignalQuality(0);
    }
    
    // Local function to process signals in main thread
    function processSignalInMainThread() {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      // Only update heart rate if confidence is sufficient
      if (heartBeatResult.confidence > 0.4) {
        setHeartRate(heartBeatResult.bpm);
        
        const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
        if (vitals) {
          setVitalSigns(vitals);
        }
      }
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, isWorkerAvailable, processSignalParallel]);

  // Space out processing intensive operations
  useEffect(() => {
    if (!lastSignal || !isMonitoring) return;
    
    // Limit the frequency of non-essential operations
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 500) return;
    
    lastUpdateTimeRef.current = now;
    
    // Performance monitoring for development
    if (Math.random() < 0.05) { // Only log occasionally
      console.log(`Performance: Processing capacity ${processingCapacityRef.current}, Rate ${processingRateRef.current}`);
    }
  }, [lastSignal, isMonitoring]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      // Reset processing counters
      frameCounterRef.current = 0;
      lastUpdateTimeRef.current = 0;
      
      startProcessing();
      startHeartBeatMonitoring();
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          if (newTime >= MEASUREMENT_DURATION) {
            finalizeMeasurement();
            return MEASUREMENT_DURATION;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (isWorkerAvailable) {
      resetWorker().catch(console.error);
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setSignalQuality(0);
    setHeartRate(0);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (isWorkerAvailable) {
      resetWorker().catch(console.error);
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
    
    // Triple click to toggle performance monitor (dev feature)
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 300) {
      setShowPerformanceMonitor(prev => !prev);
    }
    lastUpdateTimeRef.current = now;
  };

  // Optimized video handling
  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    }
    
    // Use a smaller canvas for processing to improve performance
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 160; // Reduced from original size
    tempCanvas.height = 120; // Reduced from original size
    
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Processing settings
    let lastProcessTime = 0;
    const targetFrameInterval = 1000 / 20; // Reduced target FPS
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          
          // Use even smaller processing area
          tempCtx.drawImage(
            frame, 
            frame.width/4, frame.height/4, frame.width/2, frame.height/2, // Focus on center region 
            0, 0, tempCanvas.width, tempCanvas.height
          );
          
          const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          processFrame(imageData);
          
          frameCount++;
          lastProcessTime = now;
          
          if (now - lastFpsUpdateTime > 2000) { // Check less frequently
            processingFps = Math.round((frameCount / (now - lastFpsUpdateTime)) * 1000);
            frameCount = 0;
            lastFpsUpdateTime = now;
            
            // Dynamically adjust processing rate based on actual FPS
            if (processingFps < 15 && processingRateRef.current < 4) {
              processingRateRef.current++;
              console.log(`Performance: FPS too low (${processingFps}), reducing processing rate to 1/${processingRateRef.current}`);
            } else if (processingFps > 25 && processingRateRef.current > 1) {
              processingRateRef.current--;
              console.log(`Performance: FPS good (${processingFps}), increasing processing rate to 1/${processingRateRef.current}`);
            }
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
      
      {/* Performance monitor in development mode */}
      <PerformanceMonitor enabled={true} showInUI={showPerformanceMonitor} />
    </div>
  );
};

export default Index;
