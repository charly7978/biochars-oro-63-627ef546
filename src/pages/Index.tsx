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
    heartBeatResult,
    isProcessing: isHeartProcessing,
    processSignal: processHeartBeat,
    reset,
    isArrhythmia,
    startMonitoring: startHeartRateMonitoring,
    stopMonitoring: stopHeartRateMonitoring,
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

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      console.log("Resultados válidos disponibles:", lastValidResults);
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
            console.log(`HR: ${heartBeatResult.bpm} BPM (confianza: ${heartBeatResult.confidence})`);
            setHeartRate(heartBeatResult.bpm);
          }
          
          try {
            processVitalSigns(lastSignal, heartBeatResult.rrData)
              .then(vitals => {
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
        if (!lastSignal.fingerDetected && heartRate > 0) {
          console.log("Dedo no detectado, reseteando frecuencia cardíaca");
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, elapsedTime]);

  useEffect(() => {
    if (vitalSigns.arrhythmiaStatus && vitalSigns.arrhythmiaStatus.includes("ARRITMIA DETECTADA")) {
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
      startHeartRateMonitoring();
      
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
    stopHeartRateMonitoring();
    
    FeedbackService.signalMeasurementComplete(signalQuality >= 70);
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
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
    stopHeartRateMonitoring();
    reset();
    
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
    
    // Optimización 1: Configuración avanzada de la cámara
    const applyOptimalCameraSettings = async () => {
      try {
        const capabilities = videoTrack.getCapabilities();
        console.log("Capacidades de cámara:", capabilities);
        
        // Crear objeto de restricciones
        const constraints: MediaTrackConstraints = {};
        
        // Configuración óptima para captura PPG
        if (capabilities) {
          // Activar linterna si está disponible
          if (capabilities.torch) {
            constraints.advanced = [{ torch: true }];
          }
          
          // Optimizar exposición para mejor detección de pulsaciones
          if (capabilities.exposureMode) {
            constraints.exposureMode = 'continuous';
          }
          
          // Optimizar balance de blancos para mejor detección de rojos
          if (capabilities.whiteBalanceMode) {
            constraints.whiteBalanceMode = 'continuous';
          }
          
          // Configurar focus para que no cambie constantemente
          if (capabilities.focusMode) {
            constraints.focusMode = 'fixed';
          }
          
          // Maximizar framerate para mejor detección
          if (capabilities.frameRate && capabilities.frameRate.max) {
            constraints.frameRate = {
              ideal: Math.min(30, capabilities.frameRate.max)
            };
          }
        }
        
        await videoTrack.applyConstraints(constraints);
        console.log("Configuración óptima de cámara aplicada");
      } catch (err) {
        console.error("Error optimizando configuración de cámara:", err);
      }
    };
    
    applyOptimalCameraSettings();
    
    // Optimización 2: Memoria de rendimiento para ajuste adaptativo
    const performanceMetrics = {
      lastFPSUpdateTime: Date.now(),
      frameCount: 0,
      processingFPS: 0,
      averageProcessingTime: 0,
      processingTimes: [] as number[],
      maxSamples: 10
    };
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    let lastProcessTime = 0;
    const baseFrameInterval = 1000/30; // Objetivo: 30 FPS
    
    // Optimización 3: Procesamiento adaptativo basado en calidad y rendimiento
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      
      // Ajuste adaptativo del intervalo de captura según:
      // 1. Calidad de señal (calidad alta = podemos reducir frecuencia)
      // 2. Rendimiento del dispositivo (FPS bajo = aumentar intervalo)
      let adaptiveInterval = baseFrameInterval;
      
      // Con buena calidad de señal podemos reducir la frecuencia de muestreo
      if (signalQuality > 80) {
        adaptiveInterval *= 1.2; // 25 FPS
      } else if (signalQuality < 40) {
        adaptiveInterval *= 0.9; // 33 FPS
      }
      
      // Si el rendimiento es bajo, reducir la frecuencia
      if (performanceMetrics.processingFPS < 20 && performanceMetrics.processingFPS > 0) {
        adaptiveInterval *= 1.1;
      }
      
      const timeSinceLastProcess = now - lastProcessTime;
      
      if (timeSinceLastProcess >= adaptiveInterval) {
        const processStart = performance.now();
        
        try {
          const frame = await imageCapture.grabFrame();
          
          // Resolución adaptativa: con buena señal podemos reducir resolución
          let targetWidth = 320;
          let targetHeight = 240;
          
          // Con calidad alta, reducir resolución para mejorar rendimiento
          if (signalQuality > 75) {
            targetWidth = 256;
            targetHeight = 192;
          } else if (signalQuality < 30) {
            // Con calidad baja, aumentar resolución para mejorar detección
            targetWidth = Math.min(400, frame.width);
            targetHeight = Math.min(300, frame.height);
          }
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
          
          // Optimización 4: Pre-procesamiento de imagen para mejorar detección
          if (signalQuality < 50) {
            // Aplicar pre-procesamiento para imágenes problemáticas
            enhanceImageForPPG(imageData, tempCtx);
          }
          
          // Procesar frame con nuestro optimizador de señal
          processFrame(imageData);
          
          // Actualizar métricas de rendimiento
          performanceMetrics.frameCount++;
          const processingTime = performance.now() - processStart;
          
          // Guardar tiempo de procesamiento para análisis
          performanceMetrics.processingTimes.push(processingTime);
          if (performanceMetrics.processingTimes.length > performanceMetrics.maxSamples) {
            performanceMetrics.processingTimes.shift();
          }
          
          // Calcular tiempo promedio de procesamiento
          performanceMetrics.averageProcessingTime = 
            performanceMetrics.processingTimes.reduce((sum, time) => sum + time, 0) / 
            performanceMetrics.processingTimes.length;
          
          lastProcessTime = now;
          
          if (now - performanceMetrics.lastFPSUpdateTime > 1000) {
            performanceMetrics.processingFPS = performanceMetrics.frameCount;
            performanceMetrics.frameCount = 0;
            performanceMetrics.lastFPSUpdateTime = now;
            
            console.log(
              `Rendimiento: ${performanceMetrics.processingFPS} FPS | ` +
              `Tiempo promedio: ${performanceMetrics.averageProcessingTime.toFixed(1)}ms | ` +
              `Calidad: ${signalQuality} | ` +
              `Dedo: ${lastSignal?.fingerDetected ? 'Sí' : 'No'}`
            );
          }
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };
    
    // Optimización 5: Mejora de imagen para PPG
    const enhanceImageForPPG = (imageData: ImageData, ctx: CanvasRenderingContext2D) => {
      // Esta función realiza ajustes para mejorar la detección de señal PPG
      const { data, width, height } = imageData;
      
      // Aplicar mejoras directamente en los datos de la imagen
      for (let i = 0; i < data.length; i += 4) {
        // Aumentar sensibilidad en el canal rojo
        data[i] = Math.min(255, data[i] * 1.2);
        
        // Opcional: reducir otros canales para aumentar contraste
        if (data[i] > data[i+1] * 1.1 && data[i] > data[i+2] * 1.1) {
          // Si el píxel ya tiene dominancia roja, aumentarla
          data[i+1] = Math.max(0, data[i+1] * 0.9);
          data[i+2] = Math.max(0, data[i+2] * 0.9);
        }
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
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
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
