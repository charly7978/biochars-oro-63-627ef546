import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/camera/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import HelpOverlay from "@/components/HelpOverlay";
import { toast } from "sonner";
import { VitalSignsResult } from "@/types/vital-signs";
import { HelpCircle } from "lucide-react";

const Index = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [vitalCalibrationComplete, setVitalCalibrationComplete] = useState(false);
  const [arrhythmiaCalibrationProgress, setArrhythmiaCalibrationProgress] = useState(0);
  const [arrhythmiaCalibrationComplete, setArrhythmiaCalibrationComplete] = useState(false);
  
  const measurementTimerRef = useRef<number | null>(null);
  const calibrationCheckTimerRef = useRef<number | null>(null);
  const consecutiveFingerDetectionsRef = useRef<number>(0);
  const fingerDetectedRef = useRef<boolean>(false);
  const lastCalibrationUpdateRef = useRef<number>(0);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { 
    processSignal: processHeartBeat, 
    isArrhythmia,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
    reset: resetHeartBeatProcessor,
    getCalibrationProgress: getHeartBeatCalibrationProgress,
    isCalibrationComplete: isHeartBeatCalibrationComplete
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults,
    isCalibrationComplete,
    getCalibrationProgress,
    arrhythmiaCounter,
    arrhythmiaWindows
  } = useVitalSignsProcessor();

  const finalizeMeasurement = useCallback(() => {
    console.log("Finalizando medición");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (calibrationCheckTimerRef.current) {
      clearInterval(calibrationCheckTimerRef.current);
      calibrationCheckTimerRef.current = null;
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setCalibrationComplete(false);
    setCalibrationProgress(0);
    setVitalCalibrationComplete(false);
    setArrhythmiaCalibrationProgress(0);
    setArrhythmiaCalibrationComplete(false);
    setSignalQuality(0);
    consecutiveFingerDetectionsRef.current = 0;
    fingerDetectedRef.current = false;
  }, [stopProcessing, stopHeartBeatMonitoring, resetVitalSigns]);

  useEffect(() => {
    if (isMonitoring) {
      console.log("Setting up more frequent calibration check timer");
      
      if (calibrationCheckTimerRef.current !== null) {
        clearInterval(calibrationCheckTimerRef.current);
      }
      
      calibrationCheckTimerRef.current = window.setInterval(() => {
        const progress = getCalibrationProgress();
        
        if (Math.floor(progress) !== Math.floor(calibrationProgress)) {
          console.log("Regular calibration check:", progress);
        }
        
        setCalibrationProgress(progress);
        
        if (progress >= 100 && !calibrationComplete) {
          console.log("Calibration complete from timer check!");
          setCalibrationComplete(true);
          
          if (!measurementTimerRef.current) {
            startMeasurementTimer();
          }
          
          clearInterval(calibrationCheckTimerRef.current!);
          calibrationCheckTimerRef.current = null;
        }
      }, 100);
      
      return () => {
        if (calibrationCheckTimerRef.current !== null) {
          clearInterval(calibrationCheckTimerRef.current);
          calibrationCheckTimerRef.current = null;
        }
      };
    }
  }, [isMonitoring, getCalibrationProgress, calibrationProgress, calibrationComplete]);
  
  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
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
    if (lastSignal && isMonitoring) {
      if (lastSignal.fingerDetected) {
        consecutiveFingerDetectionsRef.current++;
        if (consecutiveFingerDetectionsRef.current >= 3) {
          fingerDetectedRef.current = true;
        }
      } else {
        consecutiveFingerDetectionsRef.current = 0;
        fingerDetectedRef.current = false;
      }
      
      if (fingerDetectedRef.current && lastSignal.quality >= 35) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        
        if (heartBeatResult.confidence > 0.3) {
          setHeartRate(heartBeatResult.bpm);
          
          const now = Date.now();
          if (now - lastCalibrationUpdateRef.current > 50) {
            lastCalibrationUpdateRef.current = now;
            
            const progress = getCalibrationProgress();
            
            if (Math.floor(progress) !== Math.floor(calibrationProgress)) {
              console.log("Calibration progress in effect:", progress);
            }
            
            setCalibrationProgress(progress);
            
            if (fingerDetectedRef.current && progress === 0 && lastSignal.quality > 35) {
              console.log("WARNING: Valid signal detected but calibration progress is 0", {
                signalQuality: lastSignal.quality,
                fingerDetected: fingerDetectedRef.current,
                calibrationProgress: progress
              });
            }
            
            if (progress >= 100) {
              setCalibrationComplete(true);
              
              if (!vitalCalibrationComplete) {
                setTimeout(() => {
                  setVitalCalibrationComplete(true);
                }, 1000);
              }
            }
          }
          
          const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
          if (vitals) {
            setVitalSigns(vitals);
            
            if (vitals.arrhythmiaStatus.includes("CALIBRANDO")) {
              const match = vitals.arrhythmiaStatus.match(/(\d+)%/);
              if (match) {
                const progress = parseInt(match[1], 10);
                setArrhythmiaCalibrationProgress(progress);
              } else {
                const arrhythmiaProgress = Math.min(100, elapsedTime * 5);
                setArrhythmiaCalibrationProgress(arrhythmiaProgress);
              }
              setArrhythmiaCalibrationComplete(false);
            } else {
              setArrhythmiaCalibrationComplete(true);
              setArrhythmiaCalibrationProgress(100);
            }
          }
        }
        
        setSignalQuality(lastSignal.quality);
      } else {
        setSignalQuality(lastSignal.quality);
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
      consecutiveFingerDetectionsRef.current = 0;
      fingerDetectedRef.current = false;
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, elapsedTime, getHeartBeatCalibrationProgress, getCalibrationProgress, calibrationProgress]);

  const startMeasurementTimer = useCallback(() => {
    console.log("Calibration complete, starting measurement timer");
    
    if (calibrationCheckTimerRef.current) {
      clearInterval(calibrationCheckTimerRef.current);
      calibrationCheckTimerRef.current = null;
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        
        if (newTime >= 30) {
          finalizeMeasurement();
          return 30;
        }
        return newTime;
      });
    }, 1000);
    
    toast.success("Calibración completa. Comenzando medición", {
      duration: 3000
    });
  }, [finalizeMeasurement]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) {
      finalizeMeasurement();
      return;
    } 
    
    enterFullScreen().then(() => {
      console.log("Starting monitoring process with forced calibration");
      
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      setElapsedTime(0);
      setCalibrationComplete(false);
      setCalibrationProgress(1);
      setVitalCalibrationComplete(false);
      setArrhythmiaCalibrationProgress(0);
      setArrhythmiaCalibrationComplete(false);
      lastCalibrationUpdateRef.current = 0;
      
      if (calibrationCheckTimerRef.current) {
        clearInterval(calibrationCheckTimerRef.current);
        calibrationCheckTimerRef.current = null;
      }
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
        measurementTimerRef.current = null;
      }
      
      startProcessing();
      startHeartBeatMonitoring();
      
      console.log("Camera opened, starting calibration check");
      toast.info("Ubique su dedo sobre el lente para iniciar calibración", {
        duration: 5000
      });
    }).catch(err => {
      console.error("Error starting monitoring:", err);
      toast.error("Error al iniciar. Por favor intente de nuevo.");
    });
  }, [isMonitoring, enterFullScreen, startProcessing, startHeartBeatMonitoring, finalizeMeasurement]);

  const handleReset = useCallback(() => {
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
    
    if (calibrationCheckTimerRef.current) {
      clearInterval(calibrationCheckTimerRef.current);
      calibrationCheckTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
    setCalibrationComplete(false);
    setCalibrationProgress(0);
    setVitalCalibrationComplete(false);
    setArrhythmiaCalibrationProgress(0);
    setArrhythmiaCalibrationComplete(false);
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
    consecutiveFingerDetectionsRef.current = 0;
    fingerDetectedRef.current = false;
  }, [stopProcessing, stopHeartBeatMonitoring, resetHeartBeatProcessor, fullResetVitalSigns]);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    if (!isMonitoring) {
      console.log("Not monitoring, ignoring stream ready callback");
      return;
    }
    
    console.log("Stream ready callback received, setting up processing");
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("No video track found in stream");
        toast.error("Error: No se encontró pista de video en la cámara");
        return;
      }
      
      if (videoTrack.readyState !== 'live') {
        console.error("Video track is not in live state:", videoTrack.readyState);
        toast.error("Error: La cámara no está activa");
        return;
      }
      
      let imageCapture: ImageCapture;
      try {
        imageCapture = new ImageCapture(videoTrack);
      } catch (err) {
        console.error("Error creating ImageCapture:", err);
        toast.error("Error al inicializar el procesamiento de la cámara");
        return;
      }
      
      if ('getCapabilities' in videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        console.log("Camera capabilities:", capabilities);
        
        if (capabilities?.torch) {
          console.log("Enabling torch for better PPG signal");
          videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          }).catch(err => console.error("Error enabling torch:", err));
        }
      }
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("Could not get 2D context");
        toast.error("Error al inicializar el procesamiento gráfico");
        return;
      }
      
      let lastProcessTime = 0;
      const targetFrameInterval = 1000/30;
      let frameCount = 0;
      let lastFpsUpdateTime = Date.now();
      
      const processImage = async () => {
        if (!isMonitoring) return;
        
        const now = Date.now();
        const timeSinceLastProcess = now - lastProcessTime;
        
        if (timeSinceLastProcess >= targetFrameInterval) {
          try {
            if (videoTrack.readyState !== 'live') {
              console.error("Video track is no longer live:", videoTrack.readyState);
              return;
            }
            
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
              const processingFps = frameCount;
              frameCount = 0;
              lastFpsUpdateTime = now;
              console.log(`Processing performance: ${processingFps} FPS`);
            }
          } catch (error) {
            console.error("Error capturing frame:", error);
          }
        }
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      };

      processImage();
    } catch (err) {
      console.error("Error in handleStreamReady:", err);
      toast.error("Error al procesar el video de la cámara");
    }
  }, [isMonitoring, processFrame]);

  const getStatusMessage = useCallback(() => {
    if (!isMonitoring) return "";
    if (!fingerDetectedRef.current) return "Ubique su dedo sobre el lente";
    
    if (!calibrationComplete) {
      return `Calibrando dispositivo... ${Math.floor(calibrationProgress)}%`;
    }
    
    if (!arrhythmiaCalibrationComplete) {
      return `Calibrando detección de arritmias... ${Math.floor(arrhythmiaCalibrationProgress)}%`;
    }
    
    return `Midiendo: ${elapsedTime}s / 30s`;
  }, [isMonitoring, calibrationComplete, calibrationProgress, elapsedTime, arrhythmiaCalibrationComplete, arrhythmiaCalibrationProgress]);

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
            isFingerDetected={fingerDetectedRef.current}
            signalQuality={signalQuality}
            calibrationProgress={calibrationProgress}
            isCalibrating={!calibrationComplete}
            arrhythmiaCalibrationProgress={arrhythmiaCalibrationProgress}
            isArrhythmiaCalibrating={calibrationComplete && !arrhythmiaCalibrationComplete}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-between items-center bg-black/50">
            <div className="text-white text-lg">
              {getStatusMessage()}
            </div>
            <div className="text-white text-lg flex items-center">
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
                aria-label="Ayuda"
              >
                <HelpCircle size={24} />
              </button>
              {fingerDetectedRef.current ? 
                <span className="text-green-500 ml-2">Dedo Detectado</span> : 
                <span className="text-gray-400 ml-2">Sin Detección</span>
              }
            </div>
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={fingerDetectedRef.current}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 top-[45%] bottom-[60px] bg-black/30 px-4 py-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 place-items-center h-full overflow-y-auto pb-4">
              <VitalSign 
                label="FRECUENCIA CARDÍACA"
                value={heartRate || "--"}
                unit="BPM"
                highlighted={showResults || (calibrationComplete && vitalCalibrationComplete)}
                calibrationProgress={calibrationComplete && !vitalCalibrationComplete ? 
                  Math.max(1, vitalSigns.calibration?.progress.heartRate * 100 || 0) : undefined}
              />
              <VitalSign 
                label="SPO2"
                value={vitalSigns.spo2 || "--"}
                unit="%"
                highlighted={showResults || (calibrationComplete && vitalCalibrationComplete)}
                calibrationProgress={calibrationComplete && !vitalCalibrationComplete ? 
                  Math.max(1, vitalSigns.calibration?.progress.spo2 * 100 || 0) : undefined}
              />
              <VitalSign 
                label="PRESIÓN ARTERIAL"
                value={vitalSigns.pressure}
                unit="mmHg"
                highlighted={showResults || (calibrationComplete && vitalCalibrationComplete)}
                calibrationProgress={calibrationComplete && !vitalCalibrationComplete ? 
                  Math.max(1, vitalSigns.calibration?.progress.pressure * 100 || 0) : undefined}
              />
              <VitalSign 
                label="ARRITMIAS"
                value={vitalSigns.arrhythmiaStatus}
                highlighted={showResults || (calibrationComplete && arrhythmiaCalibrationComplete)}
                calibrationProgress={calibrationComplete && !arrhythmiaCalibrationComplete ? 
                  arrhythmiaCalibrationProgress : undefined}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults || (calibrationComplete && vitalCalibrationComplete)}
              />
              <VitalSign 
                label="COLESTEROL"
                value={vitalSigns.lipids?.totalCholesterol || "--"}
                unit="mg/dL"
                highlighted={showResults || (calibrationComplete && vitalCalibrationComplete)}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={startMonitoring} 
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
      
      <HelpOverlay isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default Index;
