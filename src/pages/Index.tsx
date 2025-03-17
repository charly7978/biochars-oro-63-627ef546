
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { toast } from "@/components/ui/use-toast";

const Index = () => {
  console.log("DEBUG: Index component - Initialization start");
  
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
  const measurementTimerRef = useRef<number | null>(null);
  
  console.log("DEBUG: Index component - State initialized");
  
  console.log("DEBUG: Index component - Initializing hooks");
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  console.log("DEBUG: Index component - useSignalProcessor initialized", { hasLastSignal: !!lastSignal });
  
  const { 
    processSignal: processHeartBeat, 
    isArrhythmia,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
    reset: resetHeartBeatProcessor
  } = useHeartBeatProcessor();
  console.log("DEBUG: Index component - useHeartBeatProcessor initialized", { isArrhythmia });
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();
  console.log("DEBUG: Index component - useVitalSignsProcessor initialized", { hasLastValidResults: !!lastValidResults });

  const enterFullScreen = async () => {
    console.log("DEBUG: Index component - Attempting to enter fullscreen");
    try {
      await document.documentElement.requestFullscreen();
      console.log("DEBUG: Index component - Fullscreen entered successfully");
    } catch (err) {
      console.error("DEBUG: Index component - Error entering fullscreen:", err);
    }
  };

  useEffect(() => {
    console.log("DEBUG: Index component - useEffect for scroll prevention setup");
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    console.log("DEBUG: Index component - Scroll prevention listeners attached");
    
    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
      console.log("DEBUG: Index component - Scroll prevention listeners removed");
    };
  }, []);

  useEffect(() => {
    console.log("DEBUG: Index component - useEffect for lastValidResults tracking", {
      lastValidResults: !!lastValidResults,
      isMonitoring,
      showResults
    });
    
    if (lastValidResults && !isMonitoring) {
      console.log("DEBUG: Index component - Setting vitalSigns from lastValidResults", {
        spo2: lastValidResults.spo2,
        pressure: lastValidResults.pressure,
        arrhythmiaStatus: lastValidResults.arrhythmiaStatus
      });
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  useEffect(() => {
    console.log("DEBUG: Index component - useEffect for signal processing", {
      hasLastSignal: !!lastSignal,
      isMonitoring,
      signalQuality: lastSignal?.quality
    });
    
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        console.log("DEBUG: Index component - Processing signal with good quality", {
          quality: lastSignal.quality,
          fingerDetected: lastSignal.fingerDetected,
          value: lastSignal.filteredValue.toFixed(2)
        });
        
        try {
          const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
          
          if (heartBeatResult.confidence > 0.4) {
            console.log("DEBUG: Index component - Heart beat processed with good confidence", {
              bpm: heartBeatResult.bpm,
              confidence: heartBeatResult.confidence,
              rrIntervalsCount: heartBeatResult.rrData?.intervals.length
            });
            
            setHeartRate(heartBeatResult.bpm);
            
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              console.log("DEBUG: Index component - Vitals processed successfully", {
                spo2: vitals.spo2,
                pressure: vitals.pressure,
                arrhythmiaStatus: vitals.arrhythmiaStatus
              });
              setVitalSigns(vitals);
            }
          } else {
            console.log("DEBUG: Index component - Heart beat processed with low confidence", {
              confidence: heartBeatResult.confidence
            });
          }
          
          setSignalQuality(lastSignal.quality);
        } catch (error) {
          console.error("DEBUG: Index component - Error during signal processing:", error);
        }
      } else {
        console.log("DEBUG: Index component - Low quality signal", {
          quality: lastSignal.quality,
          fingerDetected: lastSignal.fingerDetected,
          threshold: minQualityThreshold
        });
        
        setSignalQuality(lastSignal.quality);
        
        if (!lastSignal.fingerDetected && heartRate > 0) {
          console.log("DEBUG: Index component - Finger removed, resetting heart rate");
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate]);

  const startMonitoring = () => {
    console.log("DEBUG: Index component - startMonitoring called", { currentlyMonitoring: isMonitoring });
    
    if (isMonitoring) {
      console.log("DEBUG: Index component - Already monitoring, finalizing measurement");
      finalizeMeasurement();
    } else {
      console.log("DEBUG: Index component - Starting new monitoring session");
      
      try {
        enterFullScreen();
        setIsMonitoring(true);
        setIsCameraOn(true);
        setShowResults(false);
        setHeartRate(0);
        
        startProcessing();
        startHeartBeatMonitoring();
        
        setElapsedTime(0);
        
        if (measurementTimerRef.current) {
          clearInterval(measurementTimerRef.current);
          console.log("DEBUG: Index component - Cleared existing measurement timer");
        }
        
        measurementTimerRef.current = window.setInterval(() => {
          setElapsedTime(prev => {
            const newTime = prev + 1;
            console.log(`DEBUG: Index component - Measurement time: ${newTime}s`);
            
            if (newTime >= 30) {
              console.log("DEBUG: Index component - Reached maximum measurement time (30s)");
              finalizeMeasurement();
              return 30;
            }
            return newTime;
          });
        }, 1000);
        
        console.log("DEBUG: Index component - Monitoring started successfully");
      } catch (error) {
        console.error("DEBUG: Index component - Error starting monitoring:", error);
        toast({
          title: "Error",
          description: "No se pudo iniciar la monitorización",
          variant: "destructive"
        });
      }
    }
  };

  const finalizeMeasurement = () => {
    console.log("DEBUG: Index component - Finalizing measurement");
    
    try {
      setIsMonitoring(false);
      setIsCameraOn(false);
      stopProcessing();
      stopHeartBeatMonitoring();
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
        console.log("DEBUG: Index component - Measurement timer cleared");
      }
      
      resetVitalSigns();
      console.log("DEBUG: Index component - VitalSigns reset completed");
      
      if (lastValidResults) {
        console.log("DEBUG: Index component - Setting results from lastValidResults", {
          spo2: lastValidResults.spo2,
          pressure: lastValidResults.pressure,
          arrhythmiaStatus: lastValidResults.arrhythmiaStatus
        });
        setVitalSigns(lastValidResults);
        setShowResults(true);
      } else {
        console.log("DEBUG: Index component - No valid results available");
      }
      
      setElapsedTime(0);
      setSignalQuality(0);
      setHeartRate(0);
      
      console.log("DEBUG: Index component - Measurement finalized successfully");
    } catch (error) {
      console.error("DEBUG: Index component - Error finalizing measurement:", error);
    }
  };

  const handleReset = () => {
    console.log("DEBUG: Index component - Full reset initiated");
    
    try {
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
      
      console.log("DEBUG: Index component - Full reset completed");
    } catch (error) {
      console.error("DEBUG: Index component - Error during full reset:", error);
    }
  };

  const handleStreamReady = (stream: MediaStream) => {
    console.log("DEBUG: Index component - Stream ready event received", {
      isMonitoring,
      trackCount: stream.getTracks().length
    });
    
    if (!isMonitoring) {
      console.log("DEBUG: Index component - Not monitoring, ignoring stream");
      return;
    }
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("DEBUG: Index component - No video track available in stream");
        return;
      }
      
      console.log("DEBUG: Index component - Video track obtained", {
        label: videoTrack.label,
        hasTorch: !!videoTrack.getCapabilities()?.torch
      });
      
      const imageCapture = new ImageCapture(videoTrack);
      
      if (videoTrack.getCapabilities()?.torch) {
        console.log("DEBUG: Index component - Activating torch for better PPG signal");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => console.error("DEBUG: Index component - Error activating torch:", err));
      } else {
        console.warn("DEBUG: Index component - This camera doesn't have torch available, measurement may be less accurate");
      }
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("DEBUG: Index component - Could not get 2D context");
        return;
      }
      
      let lastProcessTime = 0;
      const targetFrameInterval = 1000/30;
      let frameCount = 0;
      let lastFpsUpdateTime = Date.now();
      let processingFps = 0;
      
      const processImage = async () => {
        if (!isMonitoring) {
          console.log("DEBUG: Index component - No longer monitoring, stopping image processing");
          return;
        }
        
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
            
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
            
            frameCount++;
            lastProcessTime = now;
            
            if (now - lastFpsUpdateTime > 1000) {
              processingFps = frameCount;
              frameCount = 0;
              lastFpsUpdateTime = now;
              console.log(`DEBUG: Index component - Processing performance: ${processingFps} FPS`);
            }
          } catch (error) {
            console.error("DEBUG: Index component - Error capturing frame:", error);
          }
        }
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      };

      processImage();
      console.log("DEBUG: Index component - Image processing loop started");
    } catch (error) {
      console.error("DEBUG: Index component - Error setting up camera processing:", error);
    }
  };

  const handleToggleMonitoring = () => {
    console.log("DEBUG: Index component - Toggle monitoring button pressed", { currentlyMonitoring: isMonitoring });
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  console.log("DEBUG: Index component - Rendering component", {
    isMonitoring,
    isCameraOn,
    signalQuality,
    showResults
  });

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
    </div>
  );
};

export default Index;
