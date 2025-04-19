
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useAdvancedSignalProcessor } from "@/hooks/useAdvancedSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import { useOptimizedFingerDetection } from "@/hooks/useOptimizedFingerDetection";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { Droplet, ActivitySquare, Zap } from "lucide-react";
import FeedbackService from "@/services/FeedbackService";
import { toast } from "@/hooks/use-toast";

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
  const [processingStats, setProcessingStats] = useState({ fps: 0 });
  const measurementTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Usar el detector de dedos optimizado
  const { 
    isFingerDetected, 
    processFrame: processFingerDetection, 
    getPerformanceStats: getFingerDetectionStats 
  } = useOptimizedFingerDetection({
    detectionInterval: 150, // ms
    detectionThreshold: 3
  });
  
  // Usar el procesador de señal avanzado
  const { 
    startProcessing, 
    stopProcessing, 
    lastSignal, 
    processFrame,
    processingStats: signalStats,
    isInitializing
  } = useAdvancedSignalProcessor({
    enableOpenCV: true,
    enableTensorFlow: true,
    fingerDetectionThreshold: 0.65,
    qualityThreshold: 40
  });
  
  const { 
    processSignal: processHeartBeat, 
    isArrhythmia,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
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
  
  // Procesamiento de frames de manera optimizada
  const processVideoFrame = () => {
    if (!isMonitoring || !videoRef.current || !canvasRef.current) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(processVideoFrame);
      return;
    }
    
    // Ajustar canvas al tamaño del video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    // Dibujar solo la región de interés (centro del video)
    const centerX = video.videoWidth / 2;
    const centerY = video.videoHeight / 2;
    const roiSize = Math.min(video.videoWidth, video.videoHeight) * 0.4; // 40% del tamaño
    
    // Posición desde donde capturar la imagen en el video
    const sx = centerX - roiSize / 2;
    const sy = centerY - roiSize / 2;
    
    // Usar drawImage con recorte para mejor rendimiento
    ctx.drawImage(
      video,
      sx, sy, roiSize, roiSize, // Región de origen (recorte del centro)
      0, 0, canvas.width, canvas.height // Región de destino (toda la canvas)
    );
    
    // Obtener los datos de la imagen del canvas
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Detección de dedo optimizada
      processFingerDetection(imageData).then(fingerDetected => {
        // Solo procesamos la señal si se detecta un dedo
        if (fingerDetected) {
          processFrame(imageData);
        }
      });
      
      // Actualizar estadísticas de procesamiento
      const fingerStats = getFingerDetectionStats();
      setProcessingStats(prev => ({
        ...prev,
        fingerProcessingTime: fingerStats.avgTime,
        fps: Math.round(1000 / (fingerStats.avgTime || 1))
      }));
      
    } catch (error) {
      console.error('Error al procesar frame:', error);
    }
    
    // Programar el siguiente frame
    animationRef.current = requestAnimationFrame(processVideoFrame);
  };
  
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    // Crear el canvas oculto para procesamiento
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      canvasRef.current = canvas;
    }

    // Notificar al usuario sobre la inicialización
    if (isInitializing) {
      toast({
        title: "Inicializando",
        description: "Cargando bibliotecas de procesamiento avanzado...",
        duration: 5000,
      });
    }

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
      
      // Limpiar el canvas
      if (canvasRef.current) {
        document.body.removeChild(canvasRef.current);
      }
      
      // Cancelar animación
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Limpiar temporizador
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
    };
  }, [isInitializing]);

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  // Procesar señal optimizada
  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      
      if (isFingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        
        if (heartBeatResult.confidence > 0.4) {
          setHeartRate(heartBeatResult.bpm);
          
          try {
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              setVitalSigns(vitals);
            }
          } catch (error) {
            console.error("Error processing vital signs:", error);
          }
        }
        
        setSignalQuality(lastSignal.quality);
      } else {
        setSignalQuality(lastSignal.quality);
        
        if (!isFingerDetected && heartRate > 0) {
          // No reiniciar el ritmo cardíaco inmediatamente para evitar parpadeo
          if (signalQuality > 0) {
            setSignalQuality(prev => Math.max(0, prev - 5));
          } else {
            setHeartRate(0);
          }
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, isFingerDetected, processHeartBeat, processVitalSigns, heartRate, signalQuality]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      FeedbackService.vibrate(100);
      FeedbackService.playSound('notification');
      
      startProcessing();
      startHeartBeatMonitoring();
      
      // Iniciar procesamiento de video
      animationRef.current = requestAnimationFrame(processVideoFrame);
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
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
      
      toast({
        title: "Medición iniciada",
        description: "Coloque su dedo sobre la cámara con la linterna encendida",
        duration: 3000,
      });
    }
  };

  const finalizeMeasurement = () => {
    console.log("Finalizando medición");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    
    // Cancelar animación
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
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
    setHeartRate(0);
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    
    // Cancelar animación
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
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
    
    // Guardar referencia al stream para procesar
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    } else {
      // Crear elemento video oculto si no existe
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.display = 'none';
      video.srcObject = stream;
      document.body.appendChild(video);
      videoRef.current = video;
      
      // Iniciar procesamiento cuando el video esté listo
      video.onloadeddata = () => {
        animationRef.current = requestAnimationFrame(processVideoFrame);
      };
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-900 to-gray-700 text-white overflow-hidden">
      {/* Capa de video (siempre detrás) */}
      {isCameraOn && (
        <CameraView 
          onStreamReady={handleStreamReady}
          isMonitoring={isMonitoring}
          isFingerDetected={isFingerDetected}
          signalQuality={signalQuality}
        />
      )}

      {/* App UI */}
      <div className="relative z-10 flex flex-col min-h-screen p-4">
        {/* Encabezado */}
        <AppTitle />
        
        {/* Visualización de señal PPG */}
        <div className="mt-2">
          <PPGSignalMeter
            signalValue={lastSignal?.filteredValue || 0}
            signalQuality={signalQuality}
            isFingerDetected={isFingerDetected}
            heartRate={heartRate}
            isArrhythmia={isArrhythmia}
          />
        </div>
        
        {/* Área principal: Mediciones o resultados */}
        <div className="flex-1 flex flex-col items-center justify-center mt-4">
          {isMonitoring ? (
            <>
              {/* Indicador de tiempo */}
              <div className="w-full max-w-md bg-black bg-opacity-50 rounded-lg p-3 mb-6 text-center">
                <span className="text-xl">Tiempo: {elapsedTime}s / 30s</span>
              </div>
              
              {/* Mediciones en curso */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <VitalSign 
                  icon={<ActivitySquare className="h-6 w-6" />}
                  label="Ritmo Cardíaco" 
                  value={heartRate > 0 ? `${heartRate} BPM` : "Midiendo..."}
                  isLoading={heartRate === 0}
                />
                <VitalSign 
                  icon={<Zap className="h-6 w-6" />}
                  label="SpO₂" 
                  value={vitalSigns.spo2 > 0 ? `${vitalSigns.spo2}%` : "Midiendo..."}
                  isLoading={vitalSigns.spo2 === 0}
                />
                <VitalSign 
                  label="Presión Arterial" 
                  value={vitalSigns.pressure !== "--/--" ? vitalSigns.pressure : "Midiendo..."}
                  isLoading={vitalSigns.pressure === "--/--"}
                />
                <VitalSign 
                  icon={<Droplet className="h-6 w-6" />}
                  label="Hidratación" 
                  value={vitalSigns.hydration > 0 ? `${vitalSigns.hydration}%` : "Midiendo..."}
                  isLoading={vitalSigns.hydration === 0}
                />
              </div>
            </>
          ) : showResults ? (
            // Mostrar resultados completos
            <div className="w-full max-w-md">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold mb-2">Resultados</h2>
                <p className="text-gray-300 text-sm">
                  Medición completada con éxito
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <VitalSign 
                  icon={<ActivitySquare className="h-6 w-6" />}
                  label="Ritmo Cardíaco" 
                  value={`${vitalSigns.heartRate || "--"} BPM`}
                  detail={vitalSigns.arrhythmiaStatus}
                />
                <VitalSign 
                  icon={<Zap className="h-6 w-6" />}
                  label="SpO₂" 
                  value={`${vitalSigns.spo2 || "--"}%`}
                />
                <VitalSign 
                  label="Presión Arterial" 
                  value={vitalSigns.pressure}
                />
                <VitalSign 
                  icon={<Droplet className="h-6 w-6" />}
                  label="Hidratación" 
                  value={`${vitalSigns.hydration || "--"}%`}
                />
                <VitalSign 
                  label="Hemoglobina" 
                  value={`${vitalSigns.hemoglobin || "--"} g/dL`}
                />
                <VitalSign 
                  label="Glucosa" 
                  value={`${vitalSigns.glucose || "--"} mg/dL`}
                />
                <VitalSign 
                  label="Colesterol" 
                  value={`${vitalSigns.lipids?.totalCholesterol || "--"} mg/dL`}
                />
                <VitalSign 
                  label="Triglicéridos" 
                  value={`${vitalSigns.lipids?.triglycerides || "--"} mg/dL`}
                />
              </div>
            </div>
          ) : (
            // Instrucciones iniciales
            <div className="text-center max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Medición de Signos Vitales</h2>
              <p className="mb-6 text-gray-300">
                Coloque su dedo sobre la cámara trasera cubriendo la linterna para comenzar a medir sus signos vitales.
              </p>
              <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
                <h3 className="font-bold mb-2">Advertencia legal:</h3>
                <p className="text-sm text-gray-300">
                  Esta app no reemplaza atención médica profesional. Es solo una herramienta de monitoreo orientativo.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Botones de acción */}
        <div className="mt-auto pt-4 flex justify-center">
          <MonitorButton 
            isMonitoring={isMonitoring}
            onClick={startMonitoring}
            onReset={handleReset}
            showReset={showResults}
          />
        </div>
        
        {/* Información de desarrollo */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-1 left-1 text-xs text-gray-400">
            FPS: {processingStats.fps} | Q: {signalQuality} | F: {isFingerDetected ? 'Sí' : 'No'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
