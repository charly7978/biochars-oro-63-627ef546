import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessing } from "@/hooks/useSignalProcessing";
import { useOptimizedVitalSigns } from "@/hooks/useOptimizedVitalSigns";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { Droplet } from "lucide-react";

const OptimizedIndex = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  
  const { 
    startProcessing, 
    stopProcessing, 
    lastSignal, 
    processFrame,
    metrics
  } = useSignalProcessing();
  
  const {
    vitalSigns,
    heartRate,
    startMonitoring: startVitalSignsMonitoring,
    stopMonitoring: stopVitalSignsMonitoring,
    fingerDetected,
    signalQuality
  } = useOptimizedVitalSigns();

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
    if (isMonitoring && lastSignal) {
      // Monitoring is active and we have signal data
      setShowResults(true);
    } else if (!isMonitoring && !showResults) {
      // Not monitoring and no results showing
      setShowResults(false);
    }
  }, [isMonitoring, lastSignal, showResults]);

  const startMonitoring = () => {
    enterFullScreen();
    setIsMonitoring(true);
    setIsCameraOn(true);
    setShowResults(false);
    
    // Start both signal processing and vital signs monitoring
    startProcessing();
    startVitalSignsMonitoring();
    
    // Set up 30-second measurement timer
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setTimeout(() => {
      finalizeMeasurement();
    }, 30000);
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopVitalSignsMonitoring();
    
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    // Keep showing the last results
    setShowResults(true);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopVitalSignsMonitoring();
    
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    // Try to turn on flashlight for better signal
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible");
    }
    
    // Create offscreen canvas for processing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Target 30 FPS for processing
    const targetFrameInterval = 1000/30;
    let lastProcessTime = 0;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Throttle processing to maintain consistent frame rate
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          
          // Use lower resolution for better performance
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
          
          lastProcessTime = now;
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

  const getHydrationColor = (hydration: number) => {
    if (hydration >= 80) return 'text-blue-500';
    if (hydration >= 65) return 'text-green-500';
    if (hydration >= 50) return 'text-yellow-500';
    return 'text-red-500';
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
            isFingerDetected={fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-between items-center bg-black/20">
            <div className="text-white text-sm">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-xs">
              {metrics.fps} FPS
            </div>
            <div className="text-white text-sm">
              {fingerDetected ? "Huella Detectada" : "Huella No Detectada"}
            </div>
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={signalQuality}
              isFingerDetected={fingerDetected}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus || "--"}
              preserveResults={showResults}
              isArrhythmia={vitalSigns.arrhythmiaStatus?.includes("ARRITMIA") || false}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 bottom-[55px] h-[40%] px-2 py-2">
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

export default OptimizedIndex;
