
import React from "react";
import CameraView from "@/components/CameraView";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import AppTitle from "@/components/AppTitle";
import { useSignalProcessing } from "./index/hooks/useSignalProcessing";
import { useCameraProcessor } from "./index/hooks/useCameraProcessor";
import { useScrollPrevention } from "./index/hooks/useScrollPrevention";
import { useMeasurementTimer } from "./index/hooks/useMeasurementTimer";
import StatusBar from "./index/components/StatusBar";
import VitalSignsDisplay from "./index/components/VitalSignsDisplay";
import MonitoringTimer from "./index/components/MonitoringTimer";
import ActionButtons from "./index/components/ActionButtons";

const Index = () => {
  console.log("DEBUG: Index component - Initialization start");
  
  useScrollPrevention();
  
  const {
    isMonitoring,
    isCameraOn,
    signalQuality,
    vitalSigns,
    heartRate,
    lastSignal,
    showResults,
    isArrhythmia,
    processFrame,
    startMonitoring,
    finalizeMeasurement,
    handleReset,
    handleToggleMonitoring
  } = useSignalProcessing();
  
  const { handleStreamReady } = useCameraProcessor({
    isMonitoring,
    processFrame
  });
  
  const { elapsedTime, startTimer, stopTimer } = useMeasurementTimer({
    onMeasurementComplete: finalizeMeasurement
  });
  
  // Start or stop the timer based on monitoring state
  React.useEffect(() => {
    if (isMonitoring) {
      startTimer();
    } else {
      stopTimer();
    }
  }, [isMonitoring, startTimer, stopTimer]);

  console.log("DEBUG: Index component - Rendering component", {
    isMonitoring,
    isCameraOn,
    signalQuality,
    showResults
  });

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
          <StatusBar 
            signalQuality={signalQuality}
            isFingerDetected={!!lastSignal?.fingerDetected}
          />

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

          <VitalSignsDisplay 
            heartRate={heartRate}
            vitalSigns={vitalSigns}
            showResults={showResults}
          />

          <MonitoringTimer 
            elapsedTime={elapsedTime}
            isMonitoring={isMonitoring}
          />

          <ActionButtons 
            isMonitoring={isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
