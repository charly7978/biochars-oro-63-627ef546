import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useHeartBeatProcessor } from "@/hooks/heart-beat/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { ProcessedSignal, ProcessingError, HeartBeatResult, RRIntervalData } from "@/core/types";
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { Droplet, Settings as SettingsIcon } from "lucide-react";
import HeartRateDisplay from "@/components/HeartRateDisplay";
import MeasurementConfirmationDialog from "@/components/MeasurementConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import VitalsHistoryDialog from "@/components/VitalsHistoryDialog";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { PPGProcessor } from '@/core/signal/PPGProcessor';
import { Link } from "react-router-dom";

const MEASUREMENT_DURATION = 30000;

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const heartBeat = useHeartBeatProcessor();
  const vitalSigns = useVitalSignsProcessor();

  const { toast } = useToast();

  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [lastProcessedSignal, setLastProcessedSignal] = useState<ProcessedSignal | null>(null);

  const [measurements, setMeasurements] = useState({
    heartRate: 0,
    confidence: 0,
    spo2: 0,
    pressure: "--/--",
    glucose: 0,
    lipids: { totalCholesterol: 0, triglycerides: 0 },
    hemoglobin: 0,
    hydration: 0,
    arrhythmiaStatus: "Normal",
    arrhythmiaCount: 0,
  });
  const [lastVitalSigns, setLastVitalSigns] = useState<VitalSignsResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<ImageCapture | null>(null);
  const ppgProcessorRef = useRef<PPGProcessor | null>(null);

  const [isClient, setIsClient] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [measurementProgress, setMeasurementProgress] = useState(0);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historicalMeasurements, setHistoricalMeasurements] = useState<TablesInsert<'measurements'>[]>([]);

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } catch (err) {
      console.error('Error al entrar en pantalla completa:', err);
      setIsFullScreen(false);
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
    if (heartBeat.lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      
      const lastSignal = heartBeat.lastSignal;
      if (typeof lastSignal === 'object' && 
          lastSignal &&
          'fingerDetected' in lastSignal &&
          'quality' in lastSignal &&
          'filteredValue' in lastSignal) {
      
        const signal = lastSignal as ProcessedSignal;
        
        if (signal.fingerDetected && signal.quality >= minQualityThreshold) {
          const heartBeatResult = heartBeat.processSignal(signal.filteredValue);
          
          if (heartBeatResult.confidence > 0.4) {
            setHeartRate(heartBeatResult.bpm);
            
            try {
              const vitals = vitalSigns.processSignal(signal.filteredValue, heartBeatResult.rrData);
              if (vitals) {
                setMeasurements(prev => ({
                  ...prev,
                  heartRate: heartBeatResult.bpm,
                  confidence: heartBeatResult.confidence,
                  spo2: vitals.spo2,
                  pressure: vitals.pressure,
                  glucose: vitals.glucose,
                  lipids: vitals.lipids,
                  hemoglobin: vitals.hemoglobin,
                  hydration: vitals.hydration,
                  arrhythmiaStatus: vitals.arrhythmiaStatus,
                  arrhythmiaCount: vitalSigns.arrhythmiaCounter,
                }));
                setLastVitalSigns(vitals);
              }
            } catch (error) {
              console.error("Error processing vital signs:", error);
            }
          }
          
          setSignalQuality(signal.quality);
        } else {
          setSignalQuality(signal.quality);
          
          if (!signal.fingerDetected && heartRate > 0) {
            setHeartRate(0);
          }
        }
      } else {
        console.warn("Invalid signal format or finger not detected", lastSignal);
        if (heartRate > 0) {
          setHeartRate(0);
        }
        setSignalQuality(0);
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [heartBeat.lastSignal, isMonitoring, heartBeat.processSignal, vitalSigns.processSignal, heartRate]);

  useEffect(() => {
    setIsClient(true);
    if (!ppgProcessorRef.current) {
      ppgProcessorRef.current = new PPGProcessor(handleSignalReady, handleProcessingError);
      ppgProcessorRef.current.initialize()
        .then(() => console.log("PPG Processor Initialized"))
        .catch(err => console.error("PPG Processor Init Error:", err));
    }
    loadHistory();

    return () => {
      stopMonitoringCleanup();
    };
  }, []);

  const startMonitoring = () => {
    console.log("Attempting to start monitoring...");
    if (!ppgProcessorRef.current) {
      console.error("PPG Processor not initialized yet.");
      toast({ title: "Error", description: "El procesador de señal no está listo.", variant: "destructive" });
      return;
    }
    setIsMonitoring(true);
    heartBeat.startMonitoring();
    vitalSigns.reset();
    ppgProcessorRef.current.start();
    setMeasurementProgress(0);
    setIsCameraOn(true);
    console.log("Monitoring started. Measurement timer initiated.");

    measurementTimerRef.current = setTimeout(() => {
      console.log("Measurement timer finished.");
      finalizeMeasurement();
    }, MEASUREMENT_DURATION);

    if (animationFrameRef.current === null) {
      processImage();
      console.log("processImage loop started.");
    }
    if (!isFullScreen) {
      enterFullScreen();
    }
  };

  const finalizeMeasurement = () => {
    console.log("Finalizing measurement...");
    setIsMonitoring(false);
    setIsCameraOn(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("processImage loop stopped.");
    }
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
      measurementTimerRef.current = null;
      console.log("Measurement timer cleared.");
    }
    heartBeat.stopMonitoring();
    ppgProcessorRef.current?.stop();

    const finalBPM = heartBeat.currentBPM;
    const finalVitals = vitalSigns.lastValidResults;
    if (finalBPM > 0 && finalVitals && finalVitals.spo2 > 0) {
      console.log("Valid results obtained, showing confirmation dialog.");
      setMeasurements(prev => ({
        ...prev,
        heartRate: finalBPM,
        confidence: heartBeat.confidence,
        spo2: finalVitals.spo2,
        pressure: finalVitals.pressure,
        glucose: finalVitals.glucose,
        lipids: finalVitals.lipids,
        hemoglobin: finalVitals.hemoglobin,
        hydration: finalVitals.hydration,
        arrhythmiaStatus: finalVitals.arrhythmiaStatus,
        arrhythmiaCount: vitalSigns.arrhythmiaCounter,
      }));
      setLastVitalSigns(finalVitals);
      setShowConfirmationDialog(true);
    } else {
      console.warn("Measurement finalized without valid results. BPM:", finalBPM, "Vitals:", finalVitals);
      toast({ title: "Medición Incompleta", description: "No se pudieron obtener resultados válidos. Asegure buena señal.", variant: "destructive" });
      handleReset();
    }
  };

  const handleMeasurementConfirm = async () => {
    setShowConfirmationDialog(false);
    toast({ title: "Guardando Medición...", description: "Los resultados se están guardando." });
    console.log("Measurement confirmed. Saving data:", measurements);

    const measurementData: TablesInsert<'measurements'> = {
      user_id: "placeholder-user-id",
      measured_at: new Date().toISOString(),
      heart_rate: Math.round(measurements.heartRate),
      quality: Math.round(measurements.confidence * 100),
      spo2: Math.round(measurements.spo2),
      systolic: parseInt(measurements.pressure.split('/')[0], 10) || 0,
      diastolic: parseInt(measurements.pressure.split('/')[1], 10) || 0,
      arrhythmia_count: Math.round(measurements.arrhythmiaCount),
    };

    try {
      const { error } = await supabase.from('measurements').insert(measurementData);
      if (error) throw error;
      toast({ title: "Medición Guardada", description: "Resultados almacenados." });
      await loadHistory();
    } catch (error: any) {
      console.error("Error saving measurement:", error);
      toast({ title: "Error al Guardar", description: `No se pudo guardar: ${error.message}`, variant: "destructive" });
    } finally {
      handleReset();
    }
  };

  const handleMeasurementCancel = () => {
    setShowConfirmationDialog(false);
    toast({ title: "Medición Cancelada", description: "Resultados no guardados." });
    handleReset();
  };

  const handleReset = () => {
    console.log("Resetting application state...");
    setIsMonitoring(false);
    setIsCameraOn(false);
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    heartBeat.reset();
    vitalSigns.fullReset();
    ppgProcessorRef.current?.reset();
    setIsFingerDetected(false);
    setSignalQuality(0);
    setMeasurementProgress(0);
    setMeasurements({
      heartRate: 0, confidence: 0, spo2: 0, pressure: "--/--", glucose: 0,
      lipids: { totalCholesterol: 0, triglycerides: 0 }, hemoglobin: 0, hydration: 0,
      arrhythmiaStatus: "Normal", arrhythmiaCount: 0,
    });
    setLastVitalSigns(null);
    setLastProcessedSignal(null);
    setShowConfirmationDialog(false);
    console.log("Application state reset.");
  };

  const handleSignalReady = useCallback((signal: ProcessedSignal) => {
    setIsFingerDetected(signal.fingerDetected);
    setSignalQuality(signal.quality);
    setLastProcessedSignal(signal);

    if (signal.fingerDetected && signal.quality > 30) {
      const hbResult = heartBeat.processSignal(signal.filteredValue);
      const rrDataForVitals: RRIntervalData | undefined = hbResult.rrData && hbResult.rrData.intervals ? hbResult.rrData : undefined;
      const vsResult = vitalSigns.processSignal(signal.filteredValue, rrDataForVitals);

      setMeasurements(prev => ({
        ...prev,
        heartRate: hbResult.bpm,
        confidence: hbResult.confidence,
        spo2: vsResult.spo2,
        pressure: vsResult.pressure,
        glucose: vsResult.glucose,
        lipids: vsResult.lipids,
        hemoglobin: vsResult.hemoglobin,
        hydration: vsResult.hydration,
        arrhythmiaStatus: vsResult.arrhythmiaStatus,
        arrhythmiaCount: vitalSigns.arrhythmiaCounter,
      }));
      setLastVitalSigns(vsResult);

      if (isMonitoring && measurementTimerRef.current) {
        const elapsed = MEASUREMENT_DURATION - (measurementTimerRef.current as any)._idleTimeout;
        setMeasurementProgress(Math.min(100, (elapsed / MEASUREMENT_DURATION) * 100));
      }
    }
  }, [isMonitoring, heartBeat, vitalSigns]);

  const handleProcessingError = useCallback((error: ProcessingError) => {
    console.error("PPG Processing Error:", error.code, error.message);
    toast({ title: `Error (${error.code})`, description: error.message, variant: "destructive" });
  }, [toast]);

  const processImage = useCallback(async () => {
    if (!isMonitoring || !imageCaptureRef.current || !ppgProcessorRef.current) {
      animationFrameRef.current = null;
      return;
    }

    try {
      const imageBitmap = await imageCaptureRef.current.grabFrame();
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(imageBitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        ppgProcessorRef.current.processFrame(imageData);

        const currentLastSignal = lastProcessedSignal;
        if (currentLastSignal && currentLastSignal.fingerDetected && currentLastSignal.quality > 30) {
          const hbResult: HeartBeatResult = heartBeat.processSignal(currentLastSignal.filteredValue);
          const rrDataForVitals: RRIntervalData | undefined = hbResult.rrData && hbResult.rrData.intervals ? hbResult.rrData : undefined;
          const vsResult: VitalSignsResult = vitalSigns.processSignal(currentLastSignal.filteredValue, rrDataForVitals);

          setMeasurements(prev => ({
            ...prev,
            heartRate: hbResult.bpm,
            confidence: hbResult.confidence,
            spo2: vsResult.spo2,
            pressure: vsResult.pressure,
            glucose: vsResult.glucose,
            lipids: vsResult.lipids,
            hemoglobin: vsResult.hemoglobin,
            hydration: vsResult.hydration,
            arrhythmiaStatus: vsResult.arrhythmiaStatus,
            arrhythmiaCount: vitalSigns.arrhythmiaCounter,
          }));
          setLastVitalSigns(vsResult);

          if (isMonitoring && measurementTimerRef.current) {
            const elapsed = MEASUREMENT_DURATION - (measurementTimerRef.current as any)._idleTimeout;
            setMeasurementProgress(Math.min(100, (elapsed / MEASUREMENT_DURATION) * 100));
          }
        }
      }
      imageBitmap.close();

    } catch (error) {
      console.error("Error processing frame:", error);
    }

    if (isMonitoring) {
      animationFrameRef.current = requestAnimationFrame(processImage);
    } else {
      animationFrameRef.current = null;
    }
  }, [isMonitoring, heartBeat, vitalSigns, lastProcessedSignal]);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error("Video play error:", err);
        toast({ 
          title: "Error de Reproducción", 
          description: "No se pudo iniciar la reproducción de video de la cámara.",
          variant: "destructive"
        });
      });
      
      streamRef.current = stream;
      
      try {
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            imageCaptureRef.current = new ImageCapture(track);
            console.log("ImageCapture initialized.");
            applyCameraSettings(track).catch(err => {
              console.warn("Could not apply optimal camera settings, continuing with defaults:", err);
            });
          } catch (e) {
            console.error("Error initializing ImageCapture:", e);
            toast({ 
              title: "Advertencia", 
              description: "Funcionalidad limitada: No se pudo inicializar la captura de imagen avanzada.",
              variant: "destructive"
            });
            
            // Try to continue with fallback if possible
            console.log("ImageCapture not available, attempting to continue with limited functionality");
          }
        } else {
          const errorMsg = "No video track found in the stream.";
          console.error(errorMsg);
          toast({ 
            title: "Error de Cámara", 
            description: "No se encontró pista de video. Por favor, intente de nuevo.",
            variant: "destructive"
          });
          throw new Error(errorMsg);
        }
      } catch (e) {
        console.error("Error in stream handling:", e);
        toast({ 
          title: "Error de Cámara", 
          description: "Ocurrió un error al configurar la cámara. Intentando continuar con funcionalidad limitada.",
          variant: "destructive"
        });
        
        // Reset and attempt fallback if possible
        if (handleReset) {
          setTimeout(() => {
            handleReset();
            toast({ 
              title: "Reiniciando", 
              description: "Intentando reiniciar el sistema de captura...",
              variant: "default"
            });
          }, 3000);
        }
      }
    } else {
      console.error("Video element reference is null");
      toast({ 
        title: "Error de Inicialización", 
        description: "Elemento de video no disponible. Intente recargar la página.",
        variant: "destructive"
      });
    }
  }, [toast, handleReset]);

  const applyCameraSettings = async (track: MediaStreamTrack) => {
    try {
      const capabilities = track.getCapabilities();
      const constraints: MediaTrackConstraintSet = {};
      
      if (capabilities.focusMode?.includes('manual')) {
        constraints.focusMode = 'manual';
      } else if (capabilities.focusMode?.includes('continuous')) {
        constraints.focusMode = 'continuous';
      }
      
      if (capabilities.exposureMode?.includes('manual')) {
        constraints.exposureMode = 'manual';
      } else if (capabilities.exposureMode?.includes('continuous')) {
        constraints.exposureMode = 'continuous';
      }
      
      if (capabilities.whiteBalanceMode?.includes('manual')) {
        constraints.whiteBalanceMode = 'manual';
      } else if (capabilities.whiteBalanceMode?.includes('continuous')) {
        constraints.whiteBalanceMode = 'continuous';
      }

      if (capabilities.torch) {
        constraints.torch = true;
        console.log("Attempting to enable torch...");
      }

      if (Object.keys(constraints).length > 0) {
        console.log("Applying constraints:", JSON.stringify(constraints));
        await track.applyConstraints(constraints);
        console.log("Camera constraints applied.");
      }

    } catch (error) {
      console.warn("Could not apply desired camera settings:", error);
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
    if (hydration < 50) return "text-red-500";
    if (hydration < 65) return "text-yellow-500";
    return "text-green-500";
  };

  const stopMonitoringCleanup = () => {
    console.log("Cleaning up monitoring resources...");
    setIsMonitoring(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (measurementTimerRef.current) {
      clearTimeout(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      console.log("Camera stream stopped.");
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    imageCaptureRef.current = null;
    ppgProcessorRef.current?.stop();
  };

  const loadHistory = async () => {
    console.log("Loading measurement history...");
    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('id, measured_at, heart_rate, spo2, systolic, diastolic, arrhythmia_count, quality')
        .order('measured_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        console.log("Measurement history loaded:", data.length, "records");
        const formattedData = data.map(m => ({
          id: m.id,
          timestamp: new Date(m.measured_at).getTime(),
          heartRate: m.heart_rate,
          spo2: m.spo2,
          systolic: m.systolic,
          diastolic: m.diastolic,
          arrhythmiaStatus: m.arrhythmia_count > 0 ? `Possible (${m.arrhythmia_count})` : 'Normal',
        }));
        setHistoricalMeasurements(formattedData as any);
      }
    } catch (error) {
      console.error("Error loading measurement history:", error);
      toast({ title: "Error", description: "No se pudo cargar el historial.", variant: "destructive" });
    }
  };

  // Add event listener for camera permission errors
  useEffect(() => {
    const handleCameraPermissionError = (event: CustomEvent) => {
      console.error("Camera permission error:", event.detail);
      toast({ 
        title: "Error de Cámara", 
        description: event.detail.message || "No se pudo acceder a la cámara. Por favor, permita el acceso en la configuración del navegador.",
        variant: "destructive"
      });

      // Reset measurements since they can't be taken without camera
      handleReset();
    };

    const handleMaxRetriesReached = (event: CustomEvent) => {
      console.error("Camera max retries reached:", event.detail);
      toast({ 
        title: "Cámara No Disponible", 
        description: "No se pudo inicializar la cámara después de varios intentos. Por favor, intente de nuevo o use otro dispositivo.",
        variant: "destructive"
      });

      // Reset measurements since they can't be taken without camera
      handleReset();
    };

    // Add event listeners
    window.addEventListener('cameraPermissionError', handleCameraPermissionError as EventListener);
    window.addEventListener('cameraMaxRetriesReached', handleMaxRetriesReached as EventListener);

    // Clean up event listeners on component unmount
    return () => {
      window.removeEventListener('cameraPermissionError', handleCameraPermissionError as EventListener);
      window.removeEventListener('cameraMaxRetriesReached', handleMaxRetriesReached as EventListener);
    };
  }, [toast]);

  if (!isClient) {
    return null;
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
            isFingerDetected={isFingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-sm">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-sm">
              {isFingerDetected ? "Huella Detectada" : "Huella No Detectada"}
            </div>
          </div>

          <div className="flex-1">
            <PPGSignalMeter 
              value={lastProcessedSignal?.filteredValue ?? 0}
              quality={signalQuality}
              isFingerDetected={isFingerDetected}
              arrhythmiaStatus={lastVitalSigns?.arrhythmiaStatus ?? "Normal"}
              rawArrhythmiaData={lastVitalSigns?.lastArrhythmiaData ?? null}
              isArrhythmia={lastVitalSigns?.arrhythmiaStatus !== "Normal"}
              onStartMeasurement={startMonitoring}
              onReset={handleReset}
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
                  value={measurements.spo2 || "--"}
                  unit="%"
                  highlighted={showResults}
                  compact={false}
                />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <VitalSign 
                  label="PRESIÓN"
                  value={measurements.pressure || "--/--"}
                  unit="mmHg"
                  highlighted={showResults}
                  compact={false}
                />
                <VitalSign 
                  label="HIDRATACIÓN"
                  value={measurements.hydration || "--"}
                  unit="%"
                  highlighted={showResults}
                  icon={<Droplet className={`h-4 w-4 ${getHydrationColor(measurements.hydration)}`} />}
                  compact={false}
                />
              </div>
              <VitalSign 
                label="GLUCOSA"
                value={measurements.glucose || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="COLESTEROL"
                value={measurements.lipids?.totalCholesterol || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="TRIGLICÉRIDOS"
                value={measurements.lipids?.triglycerides || "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={Math.round(measurements.hemoglobin) || "--"}
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

          <div className="absolute top-2 right-2 z-10">
            <Link to="/settings">
              <button
                className="bg-black/30 hover:bg-black/50 text-white p-2 rounded-full"
                aria-label="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      <MeasurementConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        onConfirm={handleMeasurementConfirm}
        onCancel={handleMeasurementCancel}
        measurementTime={MEASUREMENT_DURATION / 1000}
        heartRate={measurements.heartRate.toFixed(0)}
        spo2={measurements.spo2.toFixed(0)}
        pressure={measurements.pressure}
      />

      <VitalsHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        measurements={historicalMeasurements as any}
      />
    </div>
  );
};

export default Index;
