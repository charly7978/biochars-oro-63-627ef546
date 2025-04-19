
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { Droplet } from "lucide-react";
import FeedbackService from "@/services/FeedbackService";

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
    },
    hemoglobin: 0,
    hydration: 0
  });
  const [heartRate, setHeartRate] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const imageProcessingErrorsRef = useRef<number>(0);
  const fingerDetectionStableRef = useRef<boolean>(false);
  const fingerDetectionCountRef = useRef<number>(0);
  const lastFpsUpdateTimeRef = useRef<number>(Date.now());
  
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

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        console.log("Requesting fullscreen...");
        await document.documentElement.requestFullscreen();
      } else {
        console.log("Fullscreen API not available");
      }
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
      // Continue even if fullscreen fails
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
      const minQualityThreshold = 20; // Reduced from 40 for better sensitivity
      
      // Log finger detection for debugging
      console.log("Signal state:", {
        fingerDetected: lastSignal.fingerDetected,
        quality: lastSignal.quality,
        value: lastSignal.filteredValue
      });
      
      // Track finger detection stability
      if (lastSignal.fingerDetected) {
        fingerDetectionCountRef.current += 1;
        if (fingerDetectionCountRef.current >= 5 && !fingerDetectionStableRef.current) {
          fingerDetectionStableRef.current = true;
          console.log("Finger detection stabilized!");
          FeedbackService.vibrate(100); // Provide feedback when finger is detected
        }
      } else {
        fingerDetectionCountRef.current = Math.max(0, fingerDetectionCountRef.current - 1);
        if (fingerDetectionCountRef.current < 3 && fingerDetectionStableRef.current) {
          fingerDetectionStableRef.current = false;
          console.log("Finger detection lost!");
        }
      }
      
      // Only process vital signs if we have good signal quality or confirmed finger
      if (lastSignal.fingerDetected && (lastSignal.quality >= minQualityThreshold || fingerDetectionStableRef.current)) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        
        if (heartBeatResult && heartBeatResult.confidence > 0.3) { // Reduced from 0.4 for better responsiveness
          // Update heart rate if valid
          if (heartBeatResult.bpm > 30 && heartBeatResult.bpm < 200) {
            setHeartRate(prev => {
              // Apply smoothing to avoid jumps
              if (prev === 0) return heartBeatResult.bpm;
              return Math.round(prev * 0.7 + heartBeatResult.bpm * 0.3);
            });
          }
          
          try {
            // Process vital signs with the latest heart rate data
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              setVitalSigns(vitals);
            }
          } catch (error) {
            console.error("Error processing vital signs:", error);
          }
        }
        
        setSignalQuality(lastSignal.quality);
      } else {
        // Still update signal quality even when not processing vitals
        setSignalQuality(lastSignal.quality);
        
        // Reset heart rate if finger detection is lost for a significant time
        if (!lastSignal.fingerDetected && fingerDetectionCountRef.current < 2 && heartRate > 0) {
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      // Start a new measurement session
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      // Reset finger detection state
      fingerDetectionStableRef.current = false;
      fingerDetectionCountRef.current = 0;
      
      // Provide feedback to user
      FeedbackService.vibrate(100);
      FeedbackService.playSound('notification');
      
      // Start processors
      startProcessing();
      startHeartBeatMonitoring();
      
      // Set up timer
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          // Log progress
          if (newTime % 5 === 0) {
            console.log(`Tiempo transcurrido: ${newTime}s, Finger detected: ${
              fingerDetectionStableRef.current ? 'Yes (stable)' : lastSignal?.fingerDetected ? 'Yes' : 'No'
            }, Quality: ${lastSignal?.quality || 0}`);
          }
          
          // Auto-finalize after 30 seconds
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
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
    
    // Provide completion feedback
    const lastQuality = lastSignal?.quality ?? signalQuality;
    FeedbackService.signalMeasurementComplete(lastQuality >= 50); // Reduced threshold
    
    // Clean up timer
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    // Get final results
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    // Reset state
    setElapsedTime(0);
    setSignalQuality(0);
    
    // Don't immediately reset heart rate to maintain display
    // setHeartRate(0);
    
    // Reset frame processing state
    frameProcessingRef.current = false;
    imageProcessingErrorsRef.current = 0;
    frameCountRef.current = 0;
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    
    FeedbackService.vibrate([50, 30, 50]);
    
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
      },
      hemoglobin: 0,
      hydration: 0
    });
    setSignalQuality(0);
    
    // Reset frame processing state
    frameProcessingRef.current = false;
    imageProcessingErrorsRef.current = 0;
    fingerDetectionStableRef.current = false;
    fingerDetectionCountRef.current = 0;
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("No video track available");
        return;
      }
      
      // Create ImageCapture object
      const imageCapture = new ImageCapture(videoTrack);
      console.log("ImageCapture created with video track:", videoTrack.label || "unnamed track");
      
      // Try to enable torch if available
      if (videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna para mejorar la señal PPG");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => console.error("Error activando linterna:", err));
      } else {
        console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
      }
      
      // Set up canvas for processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("No se pudo obtener el contexto 2D");
        return;
      }
      
      // Frame processing variables
      let lastProcessTime = 0;
      const targetFrameInterval = 1000/30; // Target 30fps
      
      // Frame rate monitoring
      frameCountRef.current = 0;
      lastFpsUpdateTimeRef.current = Date.now();
      
      // Frame processing function
      const processImage = async () => {
        if (!isMonitoring) {
          console.log("Monitoring stopped, ending frame processing");
          frameProcessingRef.current = false;
          return;
        }
        
        // Prevent concurrent frame processing
        if (frameProcessingRef.current) {
          requestAnimationFrame(processImage);
          return;
        }
        
        frameProcessingRef.current = true;
        
        const now = Date.now();
        const timeSinceLastProcess = now - lastProcessTime;
        
        // Throttle frame processing to maintain consistent frame rate
        if (timeSinceLastProcess >= targetFrameInterval) {
          try {
            // Capture frame
            const frame = await imageCapture.grabFrame();
            
            // Resize for performance
            const targetWidth = Math.min(320, frame.width);
            const targetHeight = Math.min(240, frame.height);
            
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            
            // Draw frame to canvas
            tempCtx.drawImage(
              frame, 
              0, 0, frame.width, frame.height, 
              0, 0, targetWidth, targetHeight
            );
            
            // Get image data and process
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
            
            // Update metrics
            frameCountRef.current++;
            lastProcessTime = now;
            
            // Log FPS periodically
            if (now - lastFpsUpdateTimeRef.current > 5000) {
              const processingFps = frameCountRef.current / 5;
              frameCountRef.current = 0;
              lastFpsUpdateTimeRef.current = now;
              console.log(`Rendimiento de procesamiento: ${processingFps.toFixed(1)} FPS`);
            }
            
            // Reset error counter on success
            imageProcessingErrorsRef.current = 0;
            
          } catch (error) {
            // Handle errors with retry logic
            imageProcessingErrorsRef.current++;
            
            if (imageProcessingErrorsRef.current <= 3) {
              console.warn("Error capturando frame (retry):", error);
            } else if (imageProcessingErrorsRef.current === 4) {
              console.error("Error capturando frame (multiple failures):", error);
            }
            
            // If track ended or invalid, try to restart
            if (error instanceof DOMException && 
                (error.name === 'InvalidStateError' || error.message.includes('ended'))) {
              console.log("Video track appears to be in invalid state, attempting recovery...");
              
              // Set delay before next attempt
              setTimeout(() => {
                console.log("Resuming frame processing after error");
                frameProcessingRef.current = false;
                requestAnimationFrame(processImage);
              }, 500);
              return;
            }
          }
        }
        
        frameProcessingRef.current = false;
        
        // Continue processing if still monitoring
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      };

      // Start frame processing
      processImage();
      
    } catch (error) {
      console.error("Error initializing video processing:", error);
    }
  };

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  const getHydrationColor = (hydration: number) => {
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
            <div className="text-white text-sm">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-sm">
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
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus || "--"}
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 bottom-[40px] h-[40%] px-2 py-2">
            <div className="grid grid-cols-2 h-full gap-2">
              <div className="col-span-2 grid grid-cols-2 gap-2 mb-2">
                <VitalSign 
                  label="FRECUENCIA CARDÍACA"
                  value={heartRate || "--"}
                  unit="BPM"
                  highlighted={showResults}
                  compact={false}
                />
                <VitalSign 
                  label="SPO2"
                  value={vitalSigns.spo2 || "--"}
                  unit="%"
                  highlighted={showResults}
                  compact={false}
                />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <VitalSign 
                  label="PRESIÓN"
                  value={vitalSigns.pressure || "--/--"}
                  unit="mmHg"
                  highlighted={showResults}
                  compact={false}
                />
                <VitalSign 
                  label="HIDRATACIÓN"
                  value={vitalSigns.hydration || "--"}
                  unit="%"
                  highlighted={showResults}
                  icon={<Droplet className={`h-4 w-4 ${getHydrationColor(vitalSigns.hydration)}`} />}
                  compact={false}
                />
              </div>
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="COLESTEROL"
                value={vitalSigns.lipids?.totalCholesterol || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="TRIGLICÉRIDOS"
                value={vitalSigns.lipids?.triglycerides || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={Math.round(vitalSigns.hemoglobin) || "--"}
                unit="g/dL"
                highlighted={showResults}
                compact={false}
              />
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
