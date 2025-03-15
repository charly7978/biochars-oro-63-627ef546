
import React, { useState, useRef, useEffect } from "react";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MeasurementConfirmationDialog from "@/components/MeasurementConfirmationDialog";
import CameraProcessor from "@/components/CameraProcessor";
import VitalSignsPanel from "@/components/VitalSignsPanel";
import ControlPanel from "@/components/ControlPanel";
import ElapsedTimeIndicator from "@/components/ElapsedTimeIndicator";
import { 
  enterFullScreen, 
  lockOrientation, 
  setMaxResolution, 
  disableScrolling 
} from "@/utils/screenUtils";

const Index = () => {
  // Estados principales
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState({ 
    spo2: 0, 
    pressure: "--/--",
    arrhythmiaStatus: "--" 
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState("--");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Referencias
  const measurementTimerRef = useRef(null);
  
  // Hooks de procesamiento
  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { processSignal: processVitalSigns, reset: resetVitalSigns } = useVitalSignsProcessor();

  // Configuración de pantalla y orientación
  useEffect(() => {
    const cleanup = disableScrolling();
    lockOrientation();
    setMaxResolution();
    enterFullScreen();
    
    window.addEventListener('orientationchange', enterFullScreen);
    
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        setTimeout(enterFullScreen, 1000);
      }
    });

    return () => {
      cleanup();
      window.removeEventListener('orientationchange', enterFullScreen);
      document.removeEventListener('fullscreenchange', enterFullScreen);
    };
  }, []);

  // Iniciar monitorización
  const startMonitoring = () => {
    enterFullScreen();
    setIsMonitoring(true);
    setIsCameraOn(true);
    startProcessing();
    setElapsedTime(0);
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }
    
    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        if (prev >= 30) {
          stopMonitoring();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Mostrar confirmación de medición
  const showMeasurementConfirmation = () => {
    setShowConfirmDialog(true);
  };

  // Confirmar medición
  const confirmMeasurement = () => {
    setShowConfirmDialog(false);
    completeMonitoring();
  };

  // Cancelar medición
  const cancelMeasurement = () => {
    setShowConfirmDialog(false);
    stopMonitoring();
  };

  // Completar monitorización
  const completeMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    resetVitalSigns();
    resetStates();
  };

  // Detener monitorización
  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    resetVitalSigns();
    resetStates();
  };

  // Reiniciar todos los estados
  const resetStates = () => {
    setElapsedTime(0);
    setHeartRate(0);
    setVitalSigns({ 
      spo2: 0, 
      pressure: "--/--",
      arrhythmiaStatus: "--" 
    });
    setArrhythmiaCount("--");
    setSignalQuality(0);
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
  };

  // Procesar señales cuando hay nuevos datos
  useEffect(() => {
    if (lastSignal && isMonitoring) {
      if (lastSignal.fingerDetected) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
        setHeartRate(heartBeatResult.bpm);
        
        const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData, lastSignal.fingerDetected);
        if (vitals) {
          setVitalSigns(vitals);
          setArrhythmiaCount(vitals.arrhythmiaStatus.split('|')[1] || "--");
        }
        
        setSignalQuality(lastSignal.quality);
      } else {
        setHeartRate(0);
        const noSignalVitals = processVitalSigns(0, undefined, false);
        if (noSignalVitals) {
          setVitalSigns(noSignalVitals);
          setArrhythmiaCount("--");
        }
        setSignalQuality(0);
      }
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

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
      <div className="flex-1 relative">
        {/* Cámara y procesamiento de imagen */}
        <CameraProcessor
          isMonitoring={isCameraOn}
          signalQuality={signalQuality}
          isFingerDetected={lastSignal?.fingerDetected}
          onFrameProcess={processFrame}
        />

        <div className="relative z-10 h-full flex flex-col">
          {/* Medidor de señal PPG */}
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignal?.filteredValue || 0}
              quality={lastSignal?.quality || 0}
              isFingerDetected={lastSignal?.fingerDetected || false}
              onStartMeasurement={startMonitoring}
              onReset={stopMonitoring}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
            />
          </div>

          {/* Panel de signos vitales */}
          <VitalSignsPanel
            heartRate={heartRate}
            spo2={vitalSigns.spo2}
            pressure={vitalSigns.pressure}
            arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
          />

          {/* Indicador de tiempo transcurrido */}
          <ElapsedTimeIndicator 
            elapsedTime={elapsedTime} 
            isMonitoring={isMonitoring}
          />

          {/* Panel de control */}
          <ControlPanel
            onStart={startMonitoring}
            onReset={stopMonitoring}
          />
        </div>
      </div>

      {/* Diálogo de confirmación */}
      <MeasurementConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmMeasurement}
        onCancel={cancelMeasurement}
        measurementTime={elapsedTime}
        heartRate={heartRate}
        spo2={vitalSigns.spo2}
        pressure={vitalSigns.pressure}
      />
    </div>
  );
};

export default Index;
