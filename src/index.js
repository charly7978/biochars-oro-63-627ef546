import React, { useState, useRef, useEffect } from "react";
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
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const measurementTimerRef = useRef(null);
  const frameProcessorRef = useRef(null);
  const cameraStabilizationTimerRef = useRef(null);
  
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
    };
  }, []);

  const startMonitoring = () => {
    console.log("Index: Iniciando monitoreo");
    enterFullScreen();
    setIsMonitoring(true);
    setIsCameraOn(true);
    startProcessing();
    setElapsedTime(0);
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    if (cameraStabilizationTimerRef.current) {
      clearTimeout(cameraStabilizationTimerRef.current);
    }
    
    // Toast informando al usuario
    toast.info("Sitúa tu dedo sobre la cámara", {
      description: "Cubre completamente la lente para una mejor señal",
      duration: 5000
    });
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        if (prev >= 30) {
          showMeasurementConfirmation();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const showMeasurementConfirmation = () => {
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    setShowConfirmDialog(true);
  };

  const confirmMeasurement = () => {
    toast.success("Medición guardada correctamente", {
      description: "Los resultados han sido registrados con éxito",
      duration: 3000,
    });
    setShowConfirmDialog(false);
    completeMonitoring();
  };

  const cancelMeasurement = () => {
    setShowConfirmDialog(false);
    startMonitoring();
  };

  const completeMonitoring = () => {
    cleanupMonitoring();
  };

  const stopMonitoring = () => {
    cleanupMonitoring();
  };
  
  const cleanupMonitoring = () => {
    console.log("Index: Limpiando monitoreo");
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
    setIsProcessingFrame(false);
    
    if (frameProcessorRef.current) {
      cancelAnimationFrame(frameProcessorRef.current);
      frameProcessorRef.current = null;
    }
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (cameraStabilizationTimerRef.current) {
      clearTimeout(cameraStabilizationTimerRef.current);
      cameraStabilizationTimerRef.current = null;
    }
  };

  const handleStreamReady = (stream) => {
    console.log("Index: Stream lista recibida");
    if (!isMonitoring) {
      console.log("Index: No estamos monitoreando, ignorando stream");
      return;
    }
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("No video track available");
      toast.error("Error de cámara", {
        description: "No se pudo acceder a la cámara correctamente",
        duration: 3000
      });
      return;
    }

    // Esperamos un tiempo para que la cámara se estabilice completamente
    if (cameraStabilizationTimerRef.current) {
      clearTimeout(cameraStabilizationTimerRef.current);
    }
    
    cameraStabilizationTimerRef.current = setTimeout(async () => {
      try {
        console.log("Index: Iniciando procesamiento después de estabilización");
        
        if (!isMonitoring) {
          console.log("Index: Ya no estamos monitoreando después de estabilización");
          return;
        }
        
        // Verificar que el track sigue activo
        if (videoTrack.readyState !== 'live') {
          console.error("Video track no está activo después de estabilización");
          return;
        }
        
        const imageCapture = new ImageCapture(videoTrack);
        
        try {
          // Activar la linterna si está disponible
          if (videoTrack.getCapabilities()?.torch) {
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            }).catch(err => console.error("Error activando linterna:", err));
            console.log("Linterna activada");
          } else {
            console.log("La linterna no está disponible en este dispositivo");
          }
          
          // Configurar alta resolución
          const capabilities = videoTrack.getCapabilities();
          if (capabilities?.width && capabilities?.height) {
            const maxWidth = capabilities.width.max;
            const maxHeight = capabilities.height.max;
            
            await videoTrack.applyConstraints({
              width: { ideal: maxWidth },
              height: { ideal: maxHeight }
            }).catch(err => console.error("Error applying high resolution config:", err));
            console.log(`Resolución configurada a ${maxWidth}x${maxHeight}`);
          }
        } catch (constraintError) {
          console.error("Error al aplicar configuraciones avanzadas:", constraintError);
          // Continuamos de todos modos
        }
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          console.error("Could not get 2D context");
          return;
        }
        
        // Umbrales ajustados para mejor detección
        const DETECTION_THRESHOLD = 50;  // Valor mínimo para detección de dedo (más bajo = más sensible)
        const MIN_RED_DIFF = 15;         // Diferencia mínima entre canales rojo y otros
        
        const processImage = async () => {
          if (!isMonitoring) {
            console.log("Index: Deteniendo procesamiento de frames");
            return;
          }
          
          if (isProcessingFrame) {
            frameProcessorRef.current = requestAnimationFrame(processImage);
            return;
          }
          
          try {
            setIsProcessingFrame(true);
            
            // Verificar que el track sigue activo antes de cada captura
            if (videoTrack.readyState !== 'live') {
              console.error("Video track no está activo durante processImage");
              setIsProcessingFrame(false);
              return;
            }
            
            const frame = await imageCapture.grabFrame();
            tempCanvas.width = frame.width;
            tempCanvas.height = frame.height;
            tempCtx.drawImage(frame, 0, 0);
            
            // Región central de la imagen (donde suele estar el dedo)
            const centerX = Math.floor(frame.width / 2);
            const centerY = Math.floor(frame.height / 2);
            const regionSize = Math.min(100, Math.floor(frame.width / 4));
            
            // Analizar la región central para determinar si hay un dedo
            const centerRegion = tempCtx.getImageData(
              centerX - regionSize/2, 
              centerY - regionSize/2,
              regionSize, 
              regionSize
            );
            
            const imageData = tempCtx.getImageData(0, 0, frame.width, frame.height);
            
            // Verificación básica de presencia de dedo (canal rojo elevado)
            let totalRed = 0;
            let totalGreen = 0;
            let totalBlue = 0;
            
            for (let i = 0; i < centerRegion.data.length; i += 4) {
              totalRed += centerRegion.data[i];
              totalGreen += centerRegion.data[i+1];
              totalBlue += centerRegion.data[i+2];
            }
            
            const pixelCount = centerRegion.data.length / 4;
            const avgRed = totalRed / pixelCount;
            const avgGreen = totalGreen / pixelCount;
            const avgBlue = totalBlue / pixelCount;
            
            const brightness = (avgRed + avgGreen + avgBlue) / 3;
            const redDiff = avgRed - ((avgGreen + avgBlue) / 2);
            
            // Mejor algoritmo de detección de dedo
            const fingerDetected = 
              brightness > DETECTION_THRESHOLD && // Hay suficiente luz
              redDiff > MIN_RED_DIFF &&           // Canal rojo dominante (característica de la piel/sangre)
              avgRed > Math.max(avgGreen, avgBlue); // Rojo es el canal más fuerte
            
            if (fingerDetected) {
              console.log("Dedo detectado en frame, procesando señal", { 
                brightness, 
                redDiff,
                avgRed,
                avgGreen, 
                avgBlue
              });
            }
            
            // Procesar frame con el algoritmo PPG
            processFrame(imageData, fingerDetected);
          } catch (error) {
            console.error("Error capturando frame:", error);
          } finally {
            setIsProcessingFrame(false);
            if (isMonitoring) {
              frameProcessorRef.current = requestAnimationFrame(processImage);
            }
          }
        };

        // Iniciar el procesamiento de frames
        processImage();
      } catch (error) {
        console.error("Error en configuración de stream:", error);
        toast.error("Error de procesamiento", {
          description: "No se pudo iniciar el procesamiento de imagen",
          duration: 3000
        });
      }
    }, 3000); // Esperar 3 segundos para estabilización completa
  };

  useEffect(() => {
    if (lastSignal) {
      // Procesar aunque fingerDetected sea false para mejor detección
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      // Solo actualizar si tenemos un BPM válido
      if (heartBeatResult.bpm > 0) {
        setHeartRate(heartBeatResult.bpm);
        
        const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
        if (vitals) {
          setVitalSigns(vitals);
          setArrhythmiaCount(vitals.arrhythmiaStatus.split('|')[1] || "--");
        }
      }
      
      // Actualizar calidad de señal independientemente
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, processHeartBeat, processVitalSigns]);

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
              preserveResults={true}
            />
          </div>

          <div className="absolute bottom-[200px] left-0 right-0 px-4">
            <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl p-4">
              <div className="grid grid-cols-4 gap-2">
                <VitalSign 
                  label="FRECUENCIA CARDÍACA"
                  value={heartRate || "--"}
                  unit="BPM"
                  calibrationProgress={vitalSigns.calibration?.progress.heartRate}
                />
                <VitalSign 
                  label="SPO2"
                  value={vitalSigns.spo2 || "--"}
                  unit="%"
                  calibrationProgress={vitalSigns.calibration?.progress.spo2}
                />
                <VitalSign 
                  label="PRESIÓN ARTERIAL"
                  value={vitalSigns.pressure}
                  unit="mmHg"
                  calibrationProgress={vitalSigns.calibration?.progress.pressure}
                />
                <VitalSign 
                  label="ARRITMIAS"
                  value={vitalSigns.arrhythmiaStatus}
                  calibrationProgress={vitalSigns.calibration?.progress.arrhythmia}
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
