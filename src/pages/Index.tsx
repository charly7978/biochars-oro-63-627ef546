
/**
 * Main application page
 * Displays vital signs monitor with camera and results
 */

import React, { useState, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { useVitalSigns } from "@/context/VitalSignsContext";
import { measurementManager } from "@/modules/results/MeasurementManager";
import { vitalSignsProcessor } from "@/modules/vital-signs/VitalSignsProcessor";
import { VitalSignsResult } from "@/modules/types/signal";
import { toast } from "@/hooks/use-toast";

// Component that uses the context
const VitalSignsMonitor = () => {
  const { 
    heartbeatData,
    isCameraActive,
    isProcessing,
    startMonitoring,
    stopMonitoring
  } = useVitalSigns();
  
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  
  // Get measurement state directly from manager
  const {
    isMonitoring,
    isCameraOn,
    signalQuality,
    heartRate,
    elapsedTime,
    showResults,
    lastSignal
  } = measurementManager.getState();
  
  // Get vital signs from manager
  const vitalSigns: VitalSignsResult = measurementManager.getVitalSigns();
  
  // Flag for arrhythmia detection
  const isArrhythmia = vitalSigns.arrhythmiaStatus?.includes("ARRITMIA DETECTADA") || false;

  const handleToggleMonitoring = useCallback(() => {
    setIsButtonDisabled(true);
    
    try {
      if (isMonitoring) {
        stopMonitoring();
        toast({
          title: "Monitoreo detenido",
          description: "El monitoreo de signos vitales ha sido detenido",
          variant: "default",
        });
      } else {
        // Inicializar el procesador antes de iniciar el monitoreo
        vitalSignsProcessor.initialize();
        startMonitoring();
        toast({
          title: "Monitoreo iniciado",
          description: "Coloque su dedo sobre la cámara para comenzar la medición",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error al cambiar estado de monitoreo:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al cambiar el estado de monitoreo",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsButtonDisabled(false), 500);
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);
  
  const resetAll = useCallback(() => {
    setIsButtonDisabled(true);
    
    try {
      measurementManager.reset();
      vitalSignsProcessor.fullReset();
      toast({
        title: "Reiniciado",
        description: "Todos los datos han sido reiniciados",
        variant: "default",
      });
    } catch (error) {
      console.error("Error al reiniciar:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al reiniciar",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsButtonDisabled(false), 500);
    }
  }, []);
  
  const handleStreamReady = useCallback((stream: MediaStream) => {
    measurementManager.handleStreamReady(stream);
  }, []);

  // Transform arrhythmia data to match expected format if needed
  const getArrhythmiaData = () => {
    if (!vitalSigns.arrhythmiaData) return undefined;
    
    return {
      timestamp: vitalSigns.arrhythmiaData.timestamp || Date.now(),
      rmssd: vitalSigns.arrhythmiaData.rmssd || 0,
      rrVariation: vitalSigns.arrhythmiaData.rrVariation || 0,
      windows: vitalSigns.arrhythmiaData.windows || [],
      detected: vitalSigns.arrhythmiaData.detected || false
    };
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
              onReset={resetAll}
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus}
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
              rawArrhythmiaData={getArrhythmiaData()}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 top-[55%] bottom-[60px] bg-black/10 px-4 py-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 place-items-center">
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
                disabled={isButtonDisabled}
              />
            </div>
            <div className="w-1/2">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={resetAll} 
                variant="reset"
                disabled={isButtonDisabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component that provides the context
const Index = () => {
  return <VitalSignsMonitor />;
};

export default Index;
