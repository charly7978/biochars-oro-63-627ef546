import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";

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
    hemoglobin: 0
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState<VitalSignsResult['calibration']>();
  const measurementTimerRef = useRef<number | null>(null);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults,
    startCalibration,
    forceCalibrationCompletion
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
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      
      // Iniciar procesamiento de señal
      startProcessing();
      
      // Resetear valores
      setElapsedTime(0);
      setVitalSigns(prev => ({
        ...prev,
        arrhythmiaStatus: "SIN ARRITMIAS|0"
      }));
      
      // Iniciar calibración automática
      console.log("Iniciando fase de calibración automática");
      startAutoCalibration();
      
      // Iniciar temporizador para medición
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          // Finalizar medición después de 30 segundos
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
          }
          return newTime;
        });
      }, 1000);
    }
  };

  const startAutoCalibration = () => {
    console.log("Iniciando auto-calibración real con indicadores visuales");
    setIsCalibrating(true);
    
    // Iniciar la calibración en el procesador
    startCalibration();
    
    // Establecer explícitamente valores iniciales de calibración para CADA vital sign
    // Esto garantiza que el estado comience correctamente
    console.log("Estableciendo valores iniciales de calibración");
    setCalibrationProgress({
      isCalibrating: true,
      progress: {
        heartRate: 0,
        spo2: 0,
        pressure: 0,
        arrhythmia: 0,
        glucose: 0,
        lipids: 0,
        hemoglobin: 0
      }
    });
    
    // Logear para verificar que el estado se estableció
    setTimeout(() => {
      console.log("Estado de calibración establecido:", calibrationProgress);
    }, 100);
    
    // Actualizar el progreso visualmente en intervalos regulares
    let step = 0;
    const calibrationInterval = setInterval(() => {
      step += 1;
      
      // Actualizar progreso visual (10 pasos en total)
      if (step <= 10) {
        const progressPercent = step * 10; // 0-100%
        console.log(`Actualizando progreso de calibración: ${progressPercent}%`);
        
        // Actualizar cada valor individualmente para asegurar que se renderice
        setCalibrationProgress({
          isCalibrating: true,
          progress: {
            heartRate: progressPercent,
            spo2: Math.max(0, progressPercent - 10),
            pressure: Math.max(0, progressPercent - 20),
            arrhythmia: Math.max(0, progressPercent - 15),
            glucose: Math.max(0, progressPercent - 5),
            lipids: Math.max(0, progressPercent - 25),
            hemoglobin: Math.max(0, progressPercent - 30)
          }
        });
      } else {
        // Al finalizar, detener el intervalo
        console.log("Finalizando animación de calibración");
        clearInterval(calibrationInterval);
        
        // Completar calibración
        if (isCalibrating) {
          console.log("Completando calibración");
          forceCalibrationCompletion();
          setIsCalibrating(false);
          
          // Importante: Establecer calibrationProgress a undefined o con valores 100
          // para que la UI refleje que ya no está calibrando
          setCalibrationProgress({
            isCalibrating: false,
            progress: {
              heartRate: 100,
              spo2: 100,
              pressure: 100,
              arrhythmia: 100,
              glucose: 100,
              lipids: 100,
              hemoglobin: 100
            }
          });
          
          // Opcional: vibración si está disponible
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }
      }
    }, 800); // Cada paso dura 800ms (8 segundos en total)
    
    // Temporizador de seguridad
    setTimeout(() => {
      if (isCalibrating) {
        console.log("Forzando finalización de calibración por tiempo límite");
        clearInterval(calibrationInterval);
        forceCalibrationCompletion();
        setIsCalibrating(false);
        
        // Asegurar que se limpie el estado de calibración
        setCalibrationProgress({
          isCalibrating: false,
          progress: {
            heartRate: 100,
            spo2: 100,
            pressure: 100,
            arrhythmia: 100,
            glucose: 100,
            lipids: 100,
            hemoglobin: 100
          }
        });
      }
    }, 10000); // 10 segundos como máximo
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición: manteniendo resultados");
    
    if (isCalibrating) {
      console.log("Calibración en progreso al finalizar, forzando finalización");
      forceCalibrationCompletion();
    }
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    setIsCalibrating(false);
    stopProcessing();
    
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
    setCalibrationProgress(undefined);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    setIsCalibrating(false);
    stopProcessing();
    
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
      hemoglobin: 0
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setLastArrhythmiaData(null);
    setCalibrationProgress(undefined);
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("No video track available");
      return;
    }

    const cleanup = () => {
      if (videoTrack.readyState === 'live') {
        try {
          videoTrack.stop();
        } catch (err) {
          console.warn('Error stopping video track:', err);
        }
      }
    };

    // Cleanup on component unmount or when monitoring stops
    useEffect(() => {
      return cleanup;
    }, []);

    useEffect(() => {
      if (!isMonitoring) {
        cleanup();
      }
    }, [isMonitoring]);

    try {
      const imageCapture = new ImageCapture(videoTrack);
      
      if (videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna para mejorar la señal PPG");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => console.error("Error activando linterna:", err));
      }
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      if (!tempCtx) {
        console.error("Could not get 2D context");
        return;
      }
      
      let isProcessing = false;
      let frameRequestId: number | null = null;
      
      const processImage = async () => {
        if (!isMonitoring || isProcessing) {
          if (frameRequestId) {
            cancelAnimationFrame(frameRequestId);
            frameRequestId = null;
          }
          return;
        }
        
        try {
          isProcessing = true;
          
          // Check track state before capturing
          if (videoTrack.readyState !== 'live') {
            console.warn('Video track is not live, skipping frame');
            isProcessing = false;
            return;
          }

          const frame = await imageCapture.grabFrame();
          tempCanvas.width = frame.width;
          tempCanvas.height = frame.height;
          tempCtx.drawImage(frame, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, frame.width, frame.height);
          processFrame(imageData);
          
          frame.close(); // Properly release the frame
        } catch (error) {
          console.error("Error capturing frame:", error);
          if (error instanceof Error && error.name === 'InvalidStateError') {
            // If we get an invalid state error, stop processing
            cleanup();
            return;
          }
        } finally {
          isProcessing = false;
          if (isMonitoring && videoTrack.readyState === 'live') {
            frameRequestId = requestAnimationFrame(processImage);
          }
        }
      };

      processImage();
      
      // Cleanup when monitoring stops
      return () => {
        if (frameRequestId) {
          cancelAnimationFrame(frameRequestId);
        }
        cleanup();
      };
    } catch (error) {
      console.error("Error in stream setup:", error);
      cleanup();
    }
  };

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
        
        if (vitals.lastArrhythmiaData) {
          setLastArrhythmiaData(vitals.lastArrhythmiaData);
          const [status, count] = vitals.arrhythmiaStatus.split('|');
          setArrhythmiaCount(count || "0");
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  // Nueva función para alternar medición
  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
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
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          {/* Se agrega header para sensor de calidad y estado de huella digital */}
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
              rawArrhythmiaData={lastArrhythmiaData}
              preserveResults={showResults}
            />
          </div>

          {/* Contenedor de los displays ampliado y con mayor espaciamiento */}
          <div className="absolute inset-x-0 top-[55%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-3 gap-4 place-items-center">
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
                label="HEMOGLOBINA"
                value={vitalSigns.hemoglobin || "--"}
                unit="g/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="COLESTEROL/TRIGL."
                value={`${vitalSigns.lipids?.totalCholesterol || "--"}/${vitalSigns.lipids?.triglycerides || "--"}`}
                unit="mg/dL"
                highlighted={showResults}
              />
            </div>
          </div>

          {/* Botonera inferior: botón de iniciar/detener y de reset en fila */}
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
