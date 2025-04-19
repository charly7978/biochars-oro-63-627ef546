
// Corrección de la desestructuración de useEnginesReady para evitar error de propiedad 'retry' inexistente

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
import { useEnginesReady } from '@/hooks/useEnginesReady';
import { useTensorFlowModel } from '@/hooks/useTensorFlowModel';

const Index = () => {
  // Motores: OpenCV y TensorFlow
  const { isOpenCVReady, isTensorFlowReady, error: enginesError, retryOpenCV, retryTensorFlowModels } = useEnginesReady();

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

  // Si tensorflow está listo, mostrar mensaje
  useEffect(() => {
    if (isTensorFlowReady) {
      console.log("✅ TensorFlow inicializado correctamente para procesamiento PPG");
    }
  }, [isTensorFlowReady]);

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
    if (lastValidResults && !isMonitoring) {
      if (JSON.stringify(lastValidResults) !== JSON.stringify(vitalSigns)) {
        setVitalSigns(lastValidResults);
        setShowResults(true);
      }
    }
  }, [lastValidResults, isMonitoring, vitalSigns]);

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      setSignalQuality(lastSignal.quality);
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        if (heartBeatResult && heartBeatResult.confidence > 0.4) {
          if (heartBeatResult.bpm > 0) {
            setHeartRate(heartBeatResult.bpm);
          }
          try {
            processVitalSigns(lastSignal, heartBeatResult.rrData)
              .then(vitals => {
                if (elapsedTime >= minimumMeasurementTime) {
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
        if (!lastSignal.fingerDetected && heartRate > 0) {
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, elapsedTime]);

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
          if (newTime >= optimalMeasurementTime) {
            finalizeMeasurement();
            return optimalMeasurementTime;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const finalizeMeasurement = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    FeedbackService.signalMeasurementComplete(signalQuality >= 70);
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
  };

  const handleReset = () => {
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
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => {});
    }
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) return;
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
          }
        } catch (error) {}
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

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  // BLOQUEO Y MENSAJES DE MOTORES
  if (!isOpenCVReady || !isTensorFlowReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-2xl font-bold mb-4 text-yellow-600">Cargando motores...</h2>
        <p className="mb-2 text-lg">Esperando a que OpenCV y TensorFlow estén listos para medición real.</p>
        <p className="mb-4 text-sm text-muted-foreground">
          Estado actual:<br/>
          <span className={isOpenCVReady ? 'text-green-600' : 'text-red-600'}>OpenCV: {isOpenCVReady ? 'Listo' : 'No inicializado'}</span><br/>
          <span className={isTensorFlowReady ? 'text-green-600' : 'text-red-600'}>TensorFlow: {isTensorFlowReady ? 'Listo' : 'No inicializado'}</span>
        </p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Por favor, espera a que ambos motores estén listos o recarga la página si el problema persiste.</p>
      </div>
    );
  }
  if (enginesError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Error al inicializar motores</h2>
        <p className="mb-2 text-lg">{enginesError}</p>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => window.location.reload()}
        >
          Recargar página
        </button>
        <p className="text-sm text-muted-foreground mt-4">Si el problema persiste, revisa la consola del navegador o contacta soporte.</p>
      </div>
    );
  }

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
            <div className="text-white text-sm">
              {isTensorFlowReady ? "TF ✓" : "TF ✗"}
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

