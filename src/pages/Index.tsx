import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const measurementStartTimeRef = useRef<number | null>(null);
  const lastDiagnosticLogTime = useRef<number>(0);
  const minimumMeasurementTime = 10; // Segundos mínimos antes de mostrar resultados
  const optimalMeasurementTime = 30; // Tiempo óptimo para resultados más precisos
  const [lastArrhythmiaTimestamp, setLastArrhythmiaTimestamp] = useState<number | null>(null);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<any>(null);
  const [lastArrhythmiaStatus, setLastArrhythmiaStatus] = useState<string>("--");
  
  const { startProcessing, stopProcessing, lastSignal, processFrame, framesProcessed } = useSignalProcessor();
  const {
    heartBeatResult,
    isProcessing: isHeartProcessing,
    processSignal: processHeartBeat,
    reset,
    isArrhythmia,
    startMonitoring: startHeartRateMonitoring,
    stopMonitoring: stopHeartRateMonitoring,
    getCurrentHeartRate
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  const cameraStreamRef = useRef<MediaStream | null>(null);
  let imageCapture: ImageCapture | null = null;
  let tempCanvas: HTMLCanvasElement | null = null;
  let tempCtx: CanvasRenderingContext2D | null = null;

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
      const minQualityThreshold = 35; // Umbral de calidad mínimo para procesar HR
      
      setSignalQuality(lastSignal.quality);
      
      // Procesar HeartBeat solo si el dedo está detectado y la calidad es suficiente
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        // La señal ya se envió a HeartBeatProcessor dentro de useSignalProcessor
        // Ahora leemos el resultado actualizado del hook useHeartBeatProcessor
        const currentHeartRate = heartBeatResult.bpm;
        const currentConfidence = heartBeatResult.confidence;
        
        if (currentHeartRate > 0 && currentConfidence > 0.4) {
          // Solo actualizar si el BPM es válido y la confianza es razonable
          setHeartRate(currentHeartRate);
          console.log(`[Index.tsx] HR Actualizado: ${currentHeartRate} BPM (Confianza: ${currentConfidence.toFixed(2)})`);
          
          // Intentar procesar otros signos vitales si tenemos datos de HR
          if (heartBeatResult.rrData) {
            processVitalSigns(lastSignal, heartBeatResult.rrData)
              .then(vitals => {
                if (elapsedTime >= minimumMeasurementTime) {
                  console.log("[Index.tsx] Actualizando signos vitales:", vitals);
                  setVitalSigns(vitals);
                }
              })
              .catch(error => {
                console.error("[Index.tsx] Error procesando signos vitales:", error);
              });
          }
          
        } else if (currentHeartRate === 0 && framesProcessed > 5) {
            // Si después de unos frames no hay BPM, loguear
            console.log(`[Index.tsx] Recibido BPM 0 de useHeartBeatProcessor (Confianza: ${currentConfidence.toFixed(2)})`);
        }
      } else {
        // Si no se detecta dedo o la calidad es baja, resetear HR si ya había uno
        if (heartRate > 0) {
            console.log(`[Index.tsx] Dedo no detectado o calidad baja (${lastSignal.quality}). Reseteando HR.`);
            setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      // Resetear calidad si no se está monitoreando
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, heartBeatResult, processVitalSigns, elapsedTime, heartRate, framesProcessed]);

  useEffect(() => {
    if (vitalSigns.arrhythmiaStatus && vitalSigns.arrhythmiaStatus.includes("ARRITMIA DETECTADA")) {
      setLastArrhythmiaTimestamp(Date.now());
      setLastArrhythmiaData(vitalSigns.lastArrhythmiaData);
      setLastArrhythmiaStatus(vitalSigns.arrhythmiaStatus);
    }
  }, [vitalSigns.arrhythmiaStatus, vitalSigns.lastArrhythmiaData]);

  // Función para actualizar las métricas vitales
  const updateVitalSigns = useCallback((newValues: Partial<VitalSignsResult>) => {
    setVitalSigns(prev => ({
      ...prev,
      ...newValues
    }));
  }, []);

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
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
    }
    cameraStreamRef.current = stream;
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("No se pudo obtener la pista de video");
        return;
      }
      
      // Información importante para diagnóstico
      console.log("Información del track de video:", {
        settings: videoTrack.getSettings(),
        constraints: videoTrack.getConstraints(),
        capabilities: videoTrack.getCapabilities ? videoTrack.getCapabilities() : "No soportado"
      });
      
      // Inicializar captura de imágenes
      imageCapture = new ImageCapture(videoTrack);
      
      // Iniciar procesamiento si está monitoreando
      if (isCameraOn) {
        startProcessors();
        
        // Asegurar que tenemos un contexto válido para el canvas temporal
        tempCanvas = document.createElement('canvas');
        tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        
        // Iniciar bucle de procesamiento
        requestAnimationFrame(processImage);
        
        console.log("Procesamiento de frames iniciado");
      }
    } catch (error) {
      console.error("Error al inicializar la captura de imágenes:", error);
    }
  };

  const startProcessors = () => {
    console.log("Iniciando procesadores de señal");
    startProcessing();
    startHeartRateMonitoring();
    
    // Establecer el estado inicial
    setHeartRate(0);
    setElapsedTime(0);
    setSignalQuality(0);
    
    // Registrar el tiempo de inicio
    measurementStartTimeRef.current = Date.now();
    
    // Iniciar el temporizador de medición
    if (!measurementTimerRef.current) {
      measurementTimerRef.current = window.setInterval(() => {
        if (measurementStartTimeRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - measurementStartTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    }
  };

  const processImage = async () => {
    if (!isCameraOn || !imageCapture || !tempCanvas || !tempCtx) {
      console.log("No se puede procesar la imagen - falta configuración");
      return;
    }
    
    try {
      // Capturar frame de la cámara
      const frame = await imageCapture.grabFrame();
      
      // Configurar resolución óptima para el procesamiento
      // Usar resolución adaptativa basada en la calidad de la señal
      let targetWidth = 320;
      let targetHeight = 240;
      
      if (signalQuality > 70) {
        // Buena calidad - podemos reducir resolución para rendimiento
        targetWidth = 256;
        targetHeight = 192;
      } else if (signalQuality < 40) {
        // Baja calidad - aumentar resolución
        targetWidth = Math.min(400, frame.width);
        targetHeight = Math.min(300, frame.height);
      }
      
      // Configurar el canvas temporal
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      
      // Dibujar el frame en el canvas con el tamaño objetivo
      tempCtx.drawImage(
        frame,
        0, 0, frame.width, frame.height,
        0, 0, targetWidth, targetHeight
      );
      
      // Obtener los datos de la imagen del canvas
      const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
      
      // Procesar el frame actual con nuestro procesador de señal
      // Este es el paso clave que conecta la captura con el procesamiento
      processFrame(imageData);
      
      // Registrar métricas de diagnóstico periódicamente
      const now = Date.now();
      if (now - lastDiagnosticLogTime.current > 2000) {
        console.log("Diagnóstico de señal PPG:", {
          timestamp: new Date().toISOString(),
          frameProcessed: true,
          signalQuality,
          fingerDetected: lastSignal?.fingerDetected,
          heartRate,
          elapsedTime,
          lastSignalTimestamp: lastSignal?.timestamp,
          hasValidPpgSignal: lastSignal?.channelData?.red && lastSignal?.channelData?.green
        });
        
        lastDiagnosticLogTime.current = now;
      }
    } catch (error) {
      console.error("Error al procesar frame:", error);
    }
    
    // Continuar el ciclo de procesamiento si aún estamos monitoreando
    if (isCameraOn) {
      requestAnimationFrame(processImage);
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
                  icon={<Droplet className={`${getHydrationColor(vitalSigns.hydration)}`} />}
                  compact={false}
                />
              </div>
              {/* Añadir aquí los otros VitalSign si es necesario */}
            </div>
          </div>

          {/* Botones de Monitoreo y Reset */}
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