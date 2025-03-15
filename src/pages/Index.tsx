
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/VitalSignsProcessor";
import { toast } from "sonner";

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
    }
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
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
    lastValidResults
  } = useVitalSignsProcessor();
  
  const imageProcessorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesProcessedRef = useRef<number>(0);
  const currentFrameTimeRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);

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
      
      framesProcessedRef.current = 0;
      currentFrameTimeRef.current = Date.now();
      
      // Iniciar temporizador para medición
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s, Frames procesados: ${framesProcessedRef.current}`);
          
          // Finalizar medición después de 30 segundos
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
          }
          return newTime;
        });
      }, 1000);
      
      toast.success("Acerca tu dedo a la cámara trasera", {
        duration: 3000,
      });
    }
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición: manteniendo resultados");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    // Limpiar el intervalo de procesamiento
    if (imageProcessorRef.current) {
      clearInterval(imageProcessorRef.current);
      imageProcessorRef.current = null;
    }
    
    // Guardar resultados
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setVitalSigns(savedResults);
      setShowResults(true);
    }
    
    setElapsedTime(0);
    setSignalQuality(0);
    streamRef.current = null;
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    if (imageProcessorRef.current) {
      clearInterval(imageProcessorRef.current);
      imageProcessorRef.current = null;
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
      }
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    setLastArrhythmiaData(null);
    streamRef.current = null;
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (!isMonitoring) return;
    
    // Guardar referencia al stream
    streamRef.current = stream;
    
    const videoTrack = stream.getVideoTracks()[0];
    
    try {
      // Asegurar que la linterna esté encendida para mediciones de PPG
      if (videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna para mejorar la señal PPG");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => console.error("Error activando linterna:", err));
      } else {
        console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
      }
      
      // Configurar capturas de imagen a intervalos regulares en lugar de usar requestAnimationFrame
      if (imageProcessorRef.current) {
        clearInterval(imageProcessorRef.current);
      }
      
      const processImageInterval = 50; // 20 FPS para mejor rendimiento y estabilidad
      
      imageProcessorRef.current = window.setInterval(() => {
        if (!isMonitoring || !streamRef.current) {
          if (imageProcessorRef.current) {
            clearInterval(imageProcessorRef.current);
            imageProcessorRef.current = null;
          }
          return;
        }
        
        captureAndProcessFrame();
      }, processImageInterval);
      
      // Mostrar notificación de éxito
      toast.success("Cámara lista. Coloca tu dedo sobre la lente trasera", {
        duration: 3000
      });
    } catch (error) {
      console.error("Error configurando la cámara:", error);
      toast.error("Error al inicializar la cámara. Intente de nuevo.");
    }
  };
  
  // Función separada para capturar y procesar frames
  const captureAndProcessFrame = async () => {
    if (!streamRef.current || !isMonitoring) return;
    
    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      
      // Verificar que el track sigue activo
      if (!videoTrack || videoTrack.readyState !== 'live') {
        console.log("Video track no está activo. Reconectando...");
        return;
      }
      
      const imageCapture = new ImageCapture(videoTrack);
      
      // Capturar frame
      const frame = await imageCapture.grabFrame();
      
      // Crear canvas temporal para procesamiento
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
      
      if (!tempCtx) {
        console.error("No se pudo obtener el contexto 2D");
        return;
      }
      
      // Ajustar tamaño de canvas
      const targetWidth = Math.min(320, frame.width);
      const targetHeight = Math.min(240, frame.height);
      
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      
      // Dibujar frame en canvas
      tempCtx.drawImage(
        frame, 
        0, 0, frame.width, frame.height, 
        0, 0, targetWidth, targetHeight
      );
      
      // Obtener datos de imagen
      const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
      
      // Procesar frame
      processFrame(imageData);
      
      // Incrementar contador de frames
      framesProcessedRef.current++;
      
      // Actualizar tiempo de frame
      currentFrameTimeRef.current = Date.now();
      
    } catch (error) {
      // Solo mostrar error si ha pasado tiempo desde el último
      const now = Date.now();
      const errorCooldown = 5000; // 5 segundos entre mensajes de error
      
      if (now - lastErrorTimeRef.current > errorCooldown) {
        console.error("Error capturando frame:", error);
        lastErrorTimeRef.current = now;
      }
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

          <AppTitle />

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
              <div></div> {/* Empty div to maintain grid layout */}
            </div>
          </div>

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
