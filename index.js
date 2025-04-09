
import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MeasurementConfirmationDialog from "@/components/MeasurementConfirmationDialog";
import { toast } from "sonner";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState({ 
    spo2: 0, 
    pressure: "--/--",
    arrhythmiaStatus: "--" 
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Referencias para estabilidad de mediciones
  const measurementTimerRef = useRef(null);
  const lastValidHeartRateRef = useRef(0);
  const heartRateStabilityRef = useRef(0);
  const lastValidVitalSignsRef = useRef({ spo2: 0, pressure: "--/--", arrhythmiaStatus: "--" });
  const vitalSignsStabilityRef = useRef(0);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen({ navigationUI: "hide" });
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen({ navigationUI: "hide" });
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen({ navigationUI: "hide" });
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen({ navigationUI: "hide" });
      }
      
      if (window.navigator.userAgent.match(/Android/i)) {
        if (window.AndroidFullScreen) {
          window.AndroidFullScreen.immersiveMode(
            function() { console.log('Immersive mode enabled'); },
            function() { console.log('Failed to enable immersive mode'); }
          );
        }
      }
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  useEffect(() => {
    const preventScroll = (e) => e.preventDefault();
    
    const lockOrientation = async () => {
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock('portrait');
        }
      } catch (error) {
        console.log('No se pudo bloquear la orientación:', error);
      }
    };
    
    const setMaxResolution = () => {
      if ('devicePixelRatio' in window && window.devicePixelRatio !== 1) {
        document.body.style.zoom = 1 / window.devicePixelRatio;
      }
    };
    
    lockOrientation();
    setMaxResolution();
    enterFullScreen();
    
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });
    document.body.addEventListener('touchstart', preventScroll, { passive: false });
    document.body.addEventListener('gesturestart', preventScroll, { passive: false });
    document.body.addEventListener('gesturechange', preventScroll, { passive: false });
    document.body.addEventListener('gestureend', preventScroll, { passive: false });
    
    window.addEventListener('orientationchange', enterFullScreen);
    
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        setTimeout(enterFullScreen, 1000);
      }
    });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
      document.body.removeEventListener('touchstart', preventScroll);
      document.body.removeEventListener('gesturestart', preventScroll);
      document.body.removeEventListener('gesturechange', preventScroll);
      document.body.removeEventListener('gestureend', preventScroll);
      window.removeEventListener('orientationchange', enterFullScreen);
      document.removeEventListener('fullscreenchange', enterFullScreen);
    };
  }, []);

  // Función para estabilizar el ritmo cardiaco
  const stabilizeHeartRate = useCallback((newHeartRate) => {
    // Verificar si el nuevo valor es fisiológicamente válido
    const isValidHeartRate = newHeartRate >= 40 && newHeartRate <= 200;
    
    if (isValidHeartRate) {
      // Actualizar último valor válido y aumentar estabilidad
      lastValidHeartRateRef.current = newHeartRate;
      heartRateStabilityRef.current = Math.min(heartRateStabilityRef.current + 1, 5);
      return newHeartRate;
    }
    
    // Si tenemos un valor válido anterior y suficiente estabilidad
    if (lastValidHeartRateRef.current > 0 && heartRateStabilityRef.current >= 3) {
      // Degradar lentamente la estabilidad
      heartRateStabilityRef.current = Math.max(0, heartRateStabilityRef.current - 0.5);
      return lastValidHeartRateRef.current;
    }
    
    return newHeartRate;
  }, []);
  
  // Función para estabilizar los signos vitales
  const stabilizeVitalSigns = useCallback((newVitalSigns) => {
    // Verificar si los nuevos valores son fisiológicamente válidos
    const isValidSpO2 = newVitalSigns.spo2 >= 80 && newVitalSigns.spo2 <= 100;
    const isValidPressure = newVitalSigns.pressure !== "--/--";
    
    if (isValidSpO2 || isValidPressure) {
      // Actualizar últimos valores válidos y aumentar estabilidad
      lastValidVitalSignsRef.current = { ...newVitalSigns };
      vitalSignsStabilityRef.current = Math.min(vitalSignsStabilityRef.current + 1, 5);
      return newVitalSigns;
    }
    
    // Si tenemos valores válidos anteriores y suficiente estabilidad
    if ((lastValidVitalSignsRef.current.spo2 > 0 || lastValidVitalSignsRef.current.pressure !== "--/--") && 
        vitalSignsStabilityRef.current >= 3) {
      // Degradar lentamente la estabilidad
      vitalSignsStabilityRef.current = Math.max(0, vitalSignsStabilityRef.current - 0.5);
      return lastValidVitalSignsRef.current;
    }
    
    return newVitalSigns;
  }, []);

  const startMonitoring = () => {
    enterFullScreen();
    setIsMonitoring(true);
    setIsCameraOn(true);
    startProcessing();
    setElapsedTime(0);
    
    // Resetear valores de estabilidad
    lastValidHeartRateRef.current = 0;
    heartRateStabilityRef.current = 0;
    lastValidVitalSignsRef.current = { spo2: 0, pressure: "--/--", arrhythmiaStatus: "--" };
    vitalSignsStabilityRef.current = 0;
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        if (prev >= 30) {
          stopMonitoring();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const showMeasurementConfirmation = () => {
    setShowConfirmDialog(true);
  };

  const confirmMeasurement = () => {
    setShowConfirmDialog(false);
    completeMonitoring();
  };

  const cancelMeasurement = () => {
    setShowConfirmDialog(false);
    stopMonitoring();
  };

  const completeMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    resetVitalSigns();
    setElapsedTime(0);
    
    // Mantener los últimos valores estables por consistencia en UI
    // pero reiniciar contadores de estabilidad
    heartRateStabilityRef.current = 0;
    vitalSignsStabilityRef.current = 0;
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    resetVitalSigns();
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({ 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--" 
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    
    // Reiniciar todos los valores de estabilidad
    lastValidHeartRateRef.current = 0;
    heartRateStabilityRef.current = 0;
    lastValidVitalSignsRef.current = { spo2: 0, pressure: "--/--", arrhythmiaStatus: "--" };
    vitalSignsStabilityRef.current = 0;
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
  };

  const handleStreamReady = (stream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    const capabilities = videoTrack.getCapabilities();
    if (capabilities.width && capabilities.height) {
      const maxWidth = capabilities.width.max;
      const maxHeight = capabilities.height.max;
      
      videoTrack.applyConstraints({
        width: { ideal: maxWidth },
        height: { ideal: maxHeight },
        torch: true
      }).catch(err => console.error("Error aplicando configuración de alta resolución:", err));
    } else if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      try {
        const frame = await imageCapture.grabFrame();
        tempCanvas.width = frame.width;
        tempCanvas.height = frame.height;
        tempCtx.drawImage(frame, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, frame.width, frame.height);
        processFrame(imageData);
        
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      } catch (error) {
        console.error("Error capturando frame:", error);
        if (isMonitoring) {
          requestAnimationFrame(processImage);
        }
      }
    };

    processImage();
  };

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      // Estabilizar ritmo cardíaco para prevenir parpadeo
      const stableHeartRate = stabilizeHeartRate(heartBeatResult.bpm);
      setHeartRate(stableHeartRate);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        // Estabilizar signos vitales para prevenir parpadeo
        const stableVitals = stabilizeVitalSigns(vitals);
        setVitalSigns(stableVitals);
        setArrhythmiaCount(stableVitals.arrhythmiaStatus.split('|')[1] || "--");
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, stabilizeHeartRate, stabilizeVitalSigns]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black" 
      style={{ 
        height: '100%',
        width: '100%',
        maxWidth: '100vw',
        maxHeight: '100vh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        touchAction: 'none',
        userSelect: 'none',
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
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={stopMonitoring}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
            />
          </div>

          <div className="absolute bottom-[200px] left-0 right-0 px-4">
            <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl p-4">
              <div className="grid grid-cols-4 gap-2">
                <VitalSign 
                  label="FRECUENCIA CARDÍACA"
                  value={heartRate || "--"}
                  unit="BPM"
                />
                <VitalSign 
                  label="SPO2"
                  value={vitalSigns.spo2 || "--"}
                  unit="%"
                />
                <VitalSign 
                  label="PRESIÓN ARTERIAL"
                  value={vitalSigns.pressure}
                  unit="mmHg"
                />
                <VitalSign 
                  label="ARRITMIAS"
                  value={arrhythmiaCount}
                />
              </div>
            </div>
          </div>

          {isMonitoring && (
            <div className="absolute bottom-40 left-0 right-0 text-center">
              <span className="text-xl font-medium text-gray-300">{elapsedTime}s / 30s</span>
            </div>
          )}

          <div className="h-[80px] grid grid-cols-2 gap-px bg-gray-900 mt-auto">
            <button 
              onClick={startMonitoring}
              className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
            >
              INICIAR
            </button>
            <button 
              onClick={stopMonitoring}
              className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
            >
              RESET
            </button>
          </div>
        </div>
      </div>

      <MeasurementConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmMeasurement}
        onCancel={cancelMeasurement}
        measurementTime={elapsedTime}
        heartRate={heartRate}
        spo2={vitalSigns.spo2}
        pressure={vitalSigns.pressure}
      />
    </div>
  );
};

export default Index;
