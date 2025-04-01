
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import { toast } from "@/components/ui/use-toast";

/**
 * Página optimizada con la misma funcionalidad pero estructura mejorada
 * Esta página mantiene la funcionalidad original pero con mejor organización
 */
const Optimized = () => {
  // Estado centralizado
  const [measurement, setMeasurement] = useState({
    isMonitoring: false,
    isCameraOn: false,
    signalQuality: 0,
    heartRate: 0,
    elapsedTime: 0,
    arrhythmiaCount: "--",
    showConfirmDialog: false,
    vitalSigns: { 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--" 
    }
  });
  
  // Referencias
  const measurementTimerRef = useRef(null);
  
  // Hooks para procesamiento de señales
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();

  // Funciones auxiliares
  const updateMeasurement = (updates) => {
    setMeasurement(prev => ({ ...prev, ...updates }));
  };

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  // Efectos
  useEffect(() => {
    const preventScroll = (e) => e.preventDefault();
    
    // Inicialización
    enterFullScreen();
    
    // Event listeners
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });
    
    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

  // Procesar señales cuando haya nuevos datos
  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && measurement.isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      
      updateMeasurement({
        heartRate: heartBeatResult.bpm,
        signalQuality: lastSignal.quality
      });
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        updateMeasurement({
          vitalSigns: vitals,
          arrhythmiaCount: vitals.arrhythmiaStatus.split('|')[1] || "--"
        });
      }
    }
  }, [lastSignal, measurement.isMonitoring, processHeartBeat, processVitalSigns]);

  // Operaciones principales
  const startMonitoring = () => {
    enterFullScreen();
    updateMeasurement({
      isMonitoring: true,
      isCameraOn: true,
      elapsedTime: 0
    });
    
    startProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setMeasurement(prev => {
        if (prev.elapsedTime >= 30) {
          stopMonitoring();
          return { ...prev, elapsedTime: 30 };
        }
        return { ...prev, elapsedTime: prev.elapsedTime + 1 };
      });
    }, 1000);
  };

  const stopMonitoring = () => {
    updateMeasurement({
      isMonitoring: false,
      isCameraOn: false,
      elapsedTime: 0,
      heartRate: 0,
      signalQuality: 0,
      vitalSigns: { 
        spo2: 0, 
        pressure: "--/--",
        arrhythmiaStatus: "--" 
      },
      arrhythmiaCount: "--"
    });
    
    stopProcessing();
    resetVitalSigns();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
  };

  const handleStreamReady = (stream) => {
    if (!measurement.isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    // Aplicar configuraciones óptimas a la cámara
    if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    }
    
    // Configurar canvas para procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Procesamiento de frames optimizado
    let lastProcessTime = 0;
    const targetFrameRate = 30; // 30 FPS objetivo
    const frameInterval = 1000 / targetFrameRate;
    
    const processImage = async () => {
      if (!measurement.isMonitoring) return;
      
      const now = Date.now();
      if (now - lastProcessTime >= frameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          
          // Reducir tamaño para optimizar rendimiento
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
          
          lastProcessTime = now;
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      if (measurement.isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };

    processImage();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-black" 
      style={{ 
        height: '100%',
        width: '100%',
        maxWidth: '100vw',
        maxHeight: '100vh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        touchAction: 'none',
        userSelect: 'none',
      }}>
      {/* Banner que muestra que es la versión optimizada */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-green-600 text-white text-center py-2">
        Versión Optimizada - <Link to="/" className="underline">Volver a Original</Link>
      </div>
      
      <div className="flex-1 relative mt-10">
        <div className="absolute inset-0">
          <CameraView 
            onStreamReady={handleStreamReady}
            isMonitoring={measurement.isCameraOn}
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={measurement.signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={stopMonitoring}
              arrhythmiaStatus={measurement.vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={measurement.vitalSigns.lastArrhythmiaData}
            />
          </div>

          <div className="absolute bottom-[200px] left-0 right-0 px-4">
            <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl p-4">
              <div className="grid grid-cols-4 gap-2">
                <VitalSign 
                  label="FRECUENCIA CARDÍACA"
                  value={measurement.heartRate || "--"}
                  unit="BPM"
                />
                <VitalSign 
                  label="SPO2"
                  value={measurement.vitalSigns.spo2 || "--"}
                  unit="%"
                />
                <VitalSign 
                  label="PRESIÓN ARTERIAL"
                  value={measurement.vitalSigns.pressure}
                  unit="mmHg"
                />
                <VitalSign 
                  label="ARRITMIAS"
                  value={measurement.vitalSigns.arrhythmiaStatus}
                />
              </div>
            </div>
          </div>

          {measurement.isMonitoring && (
            <div className="absolute bottom-40 left-0 right-0 text-center">
              <span className="text-xl font-medium text-gray-300">{measurement.elapsedTime}s / 30s</span>
            </div>
          )}

          <div className="h-[80px] grid grid-cols-2 gap-px bg-gray-900 mt-auto">
            <button 
              onClick={startMonitoring}
              className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
            >
              INICIAR
            </button>
            <button 
              onClick={stopMonitoring}
              className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
            >
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* Documentación de la optimización */}
      <div className="fixed top-0 right-0 p-4 z-50">
        <button 
          onClick={() => toast({
            title: "Optimizaciones Realizadas",
            description: "Estado centralizado, procesamiento de frames optimizado, reducción de resolución, y más.",
            duration: 5000
          })}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg"
        >
          Info
        </button>
      </div>
    </div>
  );
};

export default Optimized;
