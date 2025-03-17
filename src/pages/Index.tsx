
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  const stableQualityHistoryRef = useRef<number[]>([]);
  const consecutiveGoodSignalsRef = useRef<number>(0);
  const REQUIRED_STABLE_FRAMES = 15; // Alto requisito de estabilidad
  const QUALITY_THRESHOLD_FOR_PROCESSING = 65; // Umbral mucho más alto de calidad
  
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
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

  // Process signal only if we have excellent quality and robust finger detection
  useEffect(() => {
    if (lastSignal && isMonitoring) {
      // Actualizar historial de calidad para validación
      stableQualityHistoryRef.current.push(lastSignal.quality);
      if (stableQualityHistoryRef.current.length > 8) {
        stableQualityHistoryRef.current.shift();
      }
      
      // Calcular calidad promedio
      const avgQuality = stableQualityHistoryRef.current.reduce((sum, q) => sum + q, 0) / 
                        Math.max(1, stableQualityHistoryRef.current.length);
      
      // Verificar varianza para evitar señales falsas
      const qualityVariance = calculateVariance(stableQualityHistoryRef.current);
      
      // Only process if the quality is sufficient, stable, and the finger is robustly detected
      const hasHighQuality = avgQuality >= QUALITY_THRESHOLD_FOR_PROCESSING;
      const isQualityStable = qualityVariance < 200; // Permitir cierta variación natural
      
      if (lastSignal.fingerDetected && hasHighQuality && isQualityStable) {
        // Incrementar contador de señales buenas consecutivas
        consecutiveGoodSignalsRef.current++;
        
        // Solo procesar si tenemos suficientes señales buenas consecutivas
        if (consecutiveGoodSignalsRef.current >= REQUIRED_STABLE_FRAMES) {
          const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
          
          // Only update heart rate if confidence is very high
          if (heartBeatResult.confidence > 0.6) { // Significantly increased confidence threshold
            setHeartRate(heartBeatResult.bpm);
            
            // Validar intervalos RR para verificar plausibilidad fisiológica
            const hasValidRRData = heartBeatResult.rrData && 
                                  heartBeatResult.rrData.intervals.length >= 3 &&
                                  validateRRIntervals(heartBeatResult.rrData.intervals);
            
            if (hasValidRRData) {
              const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
              if (vitals && vitals.spo2 > 0) { // Verificar que los valores sean válidos
                setVitalSigns(vitals);
              }
            }
          }
          
          setSignalQuality(lastSignal.quality);
        } else {
          // No procesamos aún, pero mantenemos la calidad
          setSignalQuality(lastSignal.quality);
        }
      } else {
        // When no quality signal, update signal quality but not values
        setSignalQuality(lastSignal.quality);
        consecutiveGoodSignalsRef.current = 0;
        
        // If finger not detected for a while, reset heart rate to zero
        if (!lastSignal.fingerDetected && heartRate > 0) {
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      // If not monitoring, maintain zero values
      setSignalQuality(0);
      consecutiveGoodSignalsRef.current = 0;
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate]);

  // Función para validar intervalos RR para plausibilidad fisiológica
  const validateRRIntervals = (intervals: number[]): boolean => {
    if (!intervals || intervals.length < 3) return false;
    
    // Verificar valores en rango fisiológico válido (40-180 BPM)
    const isInRange = intervals.every(i => i >= 333 && i <= 1500);
    if (!isInRange) return false;
    
    // Verificar que no hay cambios súbitos implausibles
    const maxInterval = Math.max(...intervals);
    const minInterval = Math.min(...intervals);
    const ratio = maxInterval / minInterval;
    
    // Un cambio de más de 2.5x entre latidos es implausible sin ejercicio
    if (ratio > 2.5) return false;
    
    // Verificar estabilidad
    const variance = calculateVariance(intervals);
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variationPercent = (Math.sqrt(variance) / mean) * 100;
    
    // Variabilidad natural entre 3-20% en estado de reposo
    return variationPercent >= 3 && variationPercent <= 20;
  };
  
  // Función para calcular varianza
  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0); // Reset heart rate explicitly
      
      // Resetear contadores de estabilidad
      stableQualityHistoryRef.current = [];
      consecutiveGoodSignalsRef.current = 0;
      
      startProcessing();
      startHeartBeatMonitoring(); // Update the processor state
      
      setElapsedTime(0);
      
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
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
    stopHeartBeatMonitoring(); // Stop monitoring to prevent beeps
    
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
    setHeartRate(0); // Reset heart rate explicitly
    stableQualityHistoryRef.current = [];
    consecutiveGoodSignalsRef.current = 0;
  };

  const handleReset = () => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    
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
      }
    });
    setSignalQuality(0);
    stableQualityHistoryRef.current = [];
    consecutiveGoodSignalsRef.current = 0;
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
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 top-[45%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 place-items-center h-full overflow-y-auto pb-4">
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
                label="COLESTEROL"
                value={vitalSigns.lipids?.totalCholesterol || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
              <VitalSign 
                label="TRIGLICÉRIDOS"
                value={vitalSigns.lipids?.triglycerides || "--"}
                unit="mg/dL"
                highlighted={showResults}
              />
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
