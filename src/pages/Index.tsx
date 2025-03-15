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
    const imageCapture = new ImageCapture(videoTrack);
    
    // Asegurar que la linterna esté encendida para mediciones de PPG
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    // Crear un canvas de tamaño óptimo para el procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Variables para controlar el rendimiento y la tasa de frames
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // Apuntar a 30 FPS para precisión
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    // Crearemos un contexto dedicado para el procesamiento de imagen
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;  // Tamaño óptimo para procesamiento PPG
    enhanceCanvas.height = 240;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Control de tasa de frames optimizado para balancear precisión y rendimiento
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          // Capturar frame 
          const frame = await imageCapture.grabFrame();
          
          // Configurar tamaño adecuado del canvas para procesamiento
          // Aumentamos ligeramente la resolución para mejor análisis de color
          const targetWidth = Math.min(400, frame.width); // Aumentado de 320 a 400 para mayor detalle
          const targetHeight = Math.min(300, frame.height); // Aumentado de 240 a 300
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Dibujar el frame en el canvas con alta calidad
          tempCtx.imageSmoothingEnabled = true;
          tempCtx.imageSmoothingQuality = 'high';
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          // Mejorar la imagen para detección PPG con técnicas avanzadas
          if (enhanceCtx) {
            // Resetear canvas
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Configurar calidad de procesamiento
            enhanceCtx.imageSmoothingEnabled = true;
            enhanceCtx.imageSmoothingQuality = 'high';
            
            // Dibujar en el canvas de mejora
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            // Mejora 1: Refuerzo adaptativo del canal rojo para mejorar señal PPG
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.08)';  // Refuerzo más intenso del canal rojo
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Mejora 2: Ajuste de contraste para mejorar detección de cambios sutiles
            enhanceCtx.globalCompositeOperation = 'multiply';
            enhanceCtx.fillStyle = 'rgba(100,100,100,0.05)';
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Restaurar modo normal
            enhanceCtx.globalCompositeOperation = 'source-over';
            
            // Mejora 3: Aplicar filtro de nitidez para detectar mejor los bordes y cambios
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            const sharpened = applySharpening(imageData, 0.3); // Factor de nitidez bajo para no amplificar ruido
            
            enhanceCtx.putImageData(sharpened, 0, 0);
            
            // Obtener datos de la imagen mejorada para procesamiento
            const finalImageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Procesar el frame mejorado
            processFrame(finalImageData);
          } else {
            // Fallback a procesamiento normal
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
          }
          
          // Actualizar contadores para monitoreo de rendimiento
          frameCount++;
          lastProcessTime = now;
          
          // Calcular FPS cada segundo
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
      
      // Programar el siguiente frame con optimización para móviles
      if (isMonitoring) {
        if (isMobile) {
          // En móviles usar intervalos más largos para ahorrar batería
          setTimeout(() => requestAnimationFrame(processImage), 5);
        } else {
          // En desktop usar animación directa para máxima fluidez
          requestAnimationFrame(processImage);
        }
      }
    };

    processImage();
  };

  // Función auxiliar para aplicar filtro de nitidez a imagen
  const applySharpening = (imageData: ImageData, factor: number): ImageData => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    // Kernel de nitidez simple
    // [  0, -1,  0 ]
    // [ -1,  5, -1 ]
    // [  0, -1,  0 ]
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = (y * width + x) * 4;
        const top = ((y - 1) * width + x) * 4;
        const bottom = ((y + 1) * width + x) * 4;
        const left = (y * width + (x - 1)) * 4;
        const right = (y * width + (x + 1)) * 4;
        
        for (let c = 0; c < 3; c++) {
          // Aplicar kernel de nitidez
          const val = 5 * data[center + c] - 
                      data[top + c] - 
                      data[bottom + c] - 
                      data[left + c] - 
                      data[right + c];
          
          // Mezcla entre valor original y valor con nitidez
          outputData[center + c] = Math.max(0, Math.min(255, 
            data[center + c] * (1 - factor) + val * factor));
        }
        
        // Preservar el canal alfa
        outputData[center + 3] = data[center + 3];
      }
    }
    
    // Copiar bordes sin procesar
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          const i = (y * width + x) * 4;
          outputData[i] = data[i];
          outputData[i + 1] = data[i + 1];
          outputData[i + 2] = data[i + 2];
          outputData[i + 3] = data[i + 3];
        }
      }
    }
    
    return output;
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

