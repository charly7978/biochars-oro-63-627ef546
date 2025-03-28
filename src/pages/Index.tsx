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
import GraphGrid from "@/components/GraphGrid";

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

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        if (heartBeatResult.confidence > 0.4) {
          setHeartRate(heartBeatResult.bpm);
          const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
          if (vitals) {
            setVitalSigns(vitals);
          }
        }
        setSignalQuality(lastSignal.quality);
      } else {
        setSignalQuality(lastSignal.quality);
        if (!lastSignal.fingerDetected && heartRate > 0) {
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
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
    stopHeartBeatMonitoring();
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

  const getVitalSignStatus = (type: string, value: number | string): { text: string, color: string } => {
    if (type === "heartRate") {
      const numValue = Number(value);
      if (numValue < 60) return { text: "Bradicardia", color: "text-yellow-500" };
      if (numValue > 100) return { text: "Taquicardia", color: "text-red-500" };
      return { text: "Normal", color: "text-green-500" };
    }

    if (type === "spo2") {
      const numValue = Number(value);
      if (numValue < 90) return { text: "Hipoxia Crítica", color: "text-red-500" };
      if (numValue < 95) return { text: "Hipoxia Leve", color: "text-yellow-500" };
      return { text: "Normal", color: "text-green-500" };
    }

    if (type === "pressure") {
      if (value === "--/--") return { text: "--", color: "text-white" };
      
      const parts = String(value).split('/');
      const systolic = Number(parts[0]);
      const diastolic = Number(parts[1]);
      
      if (systolic > 140 || diastolic > 90) 
        return { text: "Hipertensión Leve", color: "text-orange-500" };
      if (systolic < 90 || diastolic < 60) 
        return { text: "Hipotensión", color: "text-yellow-500" };
      return { text: "Normal", color: "text-green-500" };
    }

    if (type === "glucose") {
      const numValue = Number(value);
      if (numValue > 140) return { text: "Hiperglicemia", color: "text-red-500" };
      if (numValue < 70) return { text: "Hipoglicemia", color: "text-yellow-500" };
      return { text: "Normal", color: "text-green-500" };
    }

    if (type === "lipids") {
      if (value === "--/--" || value === "--") return { text: "--", color: "text-white" };
      return { text: "--", color: "text-white" };
    }

    return { text: "--", color: "text-white" };
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
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <GraphGrid />
        </div>
        <div className="absolute inset-0 opacity-0">
          <CameraView 
            onStreamReady={handleStreamReady}
            isMonitoring={isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>
        <div className="absolute top-6 left-6 z-20">
          <div className="bg-gray-800/90 text-white px-4 py-2 rounded-md shadow-lg">
            {!lastSignal?.fingerDetected ? (
              <span>Sin señal 0%</span>
            ) : (
              <span>Calidad: {signalQuality}%</span>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-blue-900/90">
          <div className="grid grid-cols-3 divide-x divide-blue-800/80">
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">FRECUENCIA CARDÍACA</div>
              <div className="text-4xl font-bold">
                {heartRate ? (
                  <span className="text-green-500">{heartRate}</span>
                ) : (
                  <span className="text-green-500">-- BPM</span>
                )}
              </div>
              <div className={`text-sm mt-1 ${getVitalSignStatus("heartRate", heartRate).color}`}>
                {getVitalSignStatus("heartRate", heartRate).text}
              </div>
            </div>
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">SPO2</div>
              <div className="text-4xl font-bold">
                {vitalSigns.spo2 ? (
                  <span className="text-red-500">{vitalSigns.spo2} %</span>
                ) : (
                  <span className="text-green-500">-- %</span>
                )}
              </div>
              <div className={`text-sm mt-1 ${getVitalSignStatus("spo2", vitalSigns.spo2).color}`}>
                {getVitalSignStatus("spo2", vitalSigns.spo2).text}
              </div>
            </div>
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">PRESIÓN ARTERIAL</div>
              <div className="text-4xl font-bold">
                {vitalSigns.pressure !== "--/--" ? (
                  <span className="text-orange-500">{vitalSigns.pressure}</span>
                ) : (
                  <span className="text-green-500">--/--</span>
                )}
                <span className="text-sm ml-1">mmHg</span>
              </div>
              <div className={`text-sm mt-1 ${getVitalSignStatus("pressure", vitalSigns.pressure).color}`}>
                {getVitalSignStatus("pressure", vitalSigns.pressure).text}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-blue-800/80 border-t border-blue-800/80">
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">HEMOGLOBINA</div>
              <div className="text-4xl font-bold">
                <span className="text-orange-500">--</span>
                <span className="text-sm ml-1">g/dL</span>
              </div>
              <div className="text-sm mt-1 text-orange-500">--</div>
            </div>
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">GLUCOSA</div>
              <div className="text-4xl font-bold">
                {vitalSigns.glucose ? (
                  <span className="text-green-500">{vitalSigns.glucose}</span>
                ) : (
                  <span className="text-green-500">--</span>
                )}
                <span className="text-sm ml-1">mg/dL</span>
              </div>
              <div className={`text-sm mt-1 ${getVitalSignStatus("glucose", vitalSigns.glucose).color}`}>
                {getVitalSignStatus("glucose", vitalSigns.glucose).text}
              </div>
            </div>
            <div className="p-4 text-center flex flex-col items-center">
              <div className="text-blue-100 text-sm font-semibold mb-1">COLESTEROL/TRIGL.</div>
              <div className="text-4xl font-bold">
                <span className="text-white">--/--</span>
              </div>
              <div className="text-sm mt-1 text-white">--</div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 z-20">
          <button 
            onClick={handleToggleMonitoring}
            className={`py-4 px-6 text-white text-xl font-bold ${isMonitoring ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {isMonitoring ? "DETENER" : "INICIAR"}
          </button>
          <button 
            onClick={handleReset}
            className="bg-gray-700 hover:bg-gray-800 py-4 px-6 text-white text-xl font-bold"
          >
            RESETEAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
