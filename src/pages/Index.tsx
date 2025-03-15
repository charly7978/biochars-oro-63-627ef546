
import React, { useEffect } from "react";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import AppTitle from "@/components/AppTitle";
import CameraHandler from "@/components/CameraHandler";
import VitalSignsDisplay from "@/components/VitalSignsDisplay";
import ControlButtons from "@/components/ControlButtons";
import StatusIndicators from "@/components/StatusIndicators";
import { useMonitoring } from "@/hooks/useMonitoring";
import { useSignalProcessing } from "@/hooks/useSignalProcessing";

const Index = () => {
  const {
    isMonitoring,
    isCameraOn,
    elapsedTime,
    showResults,
    setShowResults,
    startMonitoring,
    handleReset,
    handleToggleMonitoring
  } = useMonitoring();

  const {
    lastSignal,
    signalQuality,
    vitalSigns,
    heartRate,
    lastArrhythmiaData
  } = useSignalProcessing(isMonitoring);

  // Prevent scrolling and other touch events
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    document.body.addEventListener('scroll', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
      document.body.removeEventListener('scroll', preventScroll);
    };
  }, []);

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
        <CameraHandler
          isMonitoring={isMonitoring}
          isCameraOn={isCameraOn}
          lastSignal={lastSignal}
          signalQuality={signalQuality}
        />

        <div className="relative z-10 h-full flex flex-col">
          <StatusIndicators 
            signalQuality={signalQuality}
            lastSignal={lastSignal}
          />

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

          <VitalSignsDisplay 
            vitalSigns={vitalSigns}
            heartRate={heartRate}
            showResults={showResults}
          />

          <ControlButtons 
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
