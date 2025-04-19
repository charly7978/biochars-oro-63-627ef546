import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/heart-beat/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { Droplet } from "lucide-react";
import FeedbackService from "@/services/FeedbackService";
import { ProcessedSignal } from "@/types/signal";

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
  const minimumMeasurementTime = 10; // Segundos mínimos antes de mostrar resultados
  const optimalMeasurementTime = 30; // Tiempo óptimo para resultados más precisos
  const [lastArrhythmiaTimestamp, setLastArrhythmiaTimestamp] = useState<number | null>(null);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<any>(null);
  const [lastArrhythmiaStatus, setLastArrhythmiaStatus] = useState<string>("--");
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { 
    processSignal: processHeartBeat, 
    heartBeatResult,
    isArrhythmia,
    startProcessing: startHeartBeatMonitoring,
    stopProcessing: stopHeartBeatMonitoring,
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

  // Importante: Monitorear resultados válidos
  useEffect(() => {
    // Si hay resultados válidos y no estamos monitoreando, actualizar UI
    if (lastValidResults && !isMonitoring) {
      console.log("Resultados válidos disponibles:", lastValidResults);
      // Solo actualizar si son diferentes a los actuales
      if (JSON.stringify(lastValidResults) !== JSON.stringify(vitalSigns)) {
        setVitalSigns(lastValidResults);
        setShowResults(true);
      }
    }
  }, [lastValidResults, isMonitoring, vitalSigns]);

  // Monitor de señal PPG y procesamiento
  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      
      // Actualizar calidad de señal siempre
      setSignalQuality(lastSignal.quality);
      
      // Solo procesar si la señal tiene calidad aceptable y hay dedo detectado
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        // Procesar para ritmo cardíaco
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        
        if (heartBeatResult && heartBeatResult.confidence > 0.4) {
          // Actualizar UI con ritmo cardíaco
          if (heartBeatResult.bpm > 0) {
            console.log(`HR: ${heartBeatResult.bpm} BPM (confianza: ${heartBeatResult.confidence.toFixed(2)})`);
            setHeartRate(heartBeatResult.bpm);
          }
          
          // Enviar datos a procesador de signos vitales solo si la calidad es buena
          try {
            // Utilizar el procesamiento asíncrono
            processVitalSigns(lastSignal, heartBeatResult.rrData)
              .then(vitals => {
                // Solo actualizar si hay tiempo suficiente de medición para evitar valores iniciales inestables
                if (elapsedTime >= minimumMeasurementTime) {
                  console.log("Actualizando signos vitales:", vitals);
                  setVitalSigns(vitals);
                }
              })
              .catch(error => {
                console.error("Error procesando signos vitales:", error);
              });
          } catch (error) {
            console.error("Error procesando signos vitales:", error);
          }
        }
      } else {
        // Si no hay dedo detectado o la calidad es mala, resetear la frecuencia cardíaca
        if (!lastSignal.fingerDetected && heartRate > 0) {
          console.log("Dedo no detectado, reseteando frecuencia cardíaca");
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      // Cuando no se está monitoreando, señal debe ser 0
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, elapsedTime]);

  // Monitorear cambios en vitalSigns para detectar arritmia
  useEffect(() => {
    if (vitalSigns.arrhythmiaStatus && vitalSigns.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      setLastArrhythmiaTimestamp(Date.now());
      setLastArrhythmiaData(vitalSigns.lastArrhythmiaData);
      setLastArrhythmiaStatus(vitalSigns.arrhythmiaStatus);
    }
  }, [vitalSigns.arrhythmiaStatus, vitalSigns.lastArrhythmiaData]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      console.log("Iniciando monitoreo de signos vitales...");
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      FeedbackService.vibrate(100);
      FeedbackService.playSound('notification');
      
      startProcessing();
      startHeartBeatMonitoring();
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          if (newTime >= optimalMeasurementTime) {
            console.log("Tiempo óptimo de medición alcanzado.");
            finalizeMeasurement();
            return optimalMeasurementTime;
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
    
    FeedbackService.signalMeasurementComplete(signalQuality >= 70);
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    // Importante: guardar los resultados antes de resetear
    const savedResults = resetVitalSigns();
    if (savedResults) {
      console.log("Guardando resultados finales:", savedResults);
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setSignalQuality(0);
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
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
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
    let processingFps = 0;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
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
            console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
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

  const getHydrationColor = (hydration: number) => {
    if (hydration >= 80) return 'text-blue-500';
    if (hydration >= 65) return 'text-green-500';
    if (hydration >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // En el render, decidir qué status y data pasar a PPGSignalMeter
  const arrhythmiaActive = lastArrhythmiaTimestamp && (Date.now() - lastArrhythmiaTimestamp < 2000);
  const arrhythmiaStatusToShow = arrhythmiaActive ? lastArrhythmiaStatus : vitalSigns.arrhythmiaStatus;
  const arrhythmiaDataToShow = arrhythmiaActive ? lastArrhythmiaData : null;

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
              arrhythmiaStatus={arrhythmiaStatusToShow || "--"}
              rawArrhythmiaData={arrhythmiaDataToShow}
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
