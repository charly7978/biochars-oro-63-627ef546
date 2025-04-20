
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import { Droplet } from "lucide-react";
import FeedbackService from "@/services/FeedbackService";

interface VitalSignsState {
  spo2: number | null;
  pressure: string | null;
  arrhythmiaStatus: string | null;
  glucose: number | null;
  lipids: {
    totalCholesterol: number | null;
    triglycerides: number | null;
  };
  hemoglobin: number | null;
  hydration: number | null;
  lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null;
}

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsState>({
    spo2: null,
    pressure: null,
    arrhythmiaStatus: null,
    glucose: null,
    lipids: {
      totalCholesterol: null,
      triglycerides: null
    },
    hemoglobin: null,
    hydration: null,
    lastArrhythmiaData: null
  });
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  const minimumMeasurementTime = 10;
  const optimalMeasurementTime = 30;
  const [lastArrhythmiaTimestamp, setLastArrhythmiaTimestamp] = useState<number | null>(null);
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<any>(null);
  const [lastArrhythmiaStatus, setLastArrhythmiaStatus] = useState<string | null>(null);

  const { startProcessing, stopProcessing, lastSignal, processFrame } = useSignalProcessor();

  const {
    currentBPM,
    confidence,
    processSignal: processHeartBeat,
    reset,
    isArrhythmia,
    arrhythmiaPhase,
    beats,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
  } = useHeartBeatProcessor();

  const {
    processSignal: processVitalSigns,
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  const handleStreamReady = (stream: MediaStream) => {
    console.log("Camera stream is ready", stream);
  };

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      const safeResults = {
        ...lastValidResults,
        lastArrhythmiaData: lastValidResults.lastArrhythmiaData ?? null
      };
      if (JSON.stringify(safeResults) !== JSON.stringify(vitalSigns)) {
        setVitalSigns(safeResults);
        setShowResults(true);
      }
    }
  }, [lastValidResults, isMonitoring, vitalSigns]);

  useEffect(() => {
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;

      setSignalQuality(lastSignal.quality);

      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        const heartBeatResult = processHeartBeat(lastSignal.filteredValue);

        if (heartBeatResult && heartBeatResult.confidence > 0.4) {
          if (heartBeatResult.bpm > 0) {
            setHeartRate(heartBeatResult.bpm);
          }

          try {
            processVitalSigns(lastSignal, heartBeatResult.rrData)
              .then(vitals => {
                if (elapsedTime >= minimumMeasurementTime) {
                  setVitalSigns(vitals);
                }
              });
          } catch (error) {
            console.error("Error procesando signos vitales:", error);
          }
        }
      } else {
        if (!lastSignal.fingerDetected && heartRate && heartRate > 0) {
          setHeartRate(null);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, elapsedTime]);

  useEffect(() => {
    if (vitalSigns.arrhythmiaStatus && vitalSigns.arrhythmiaStatus.toLowerCase().includes("arritmia")) {
      setLastArrhythmiaTimestamp(Date.now());
      setLastArrhythmiaData(vitalSigns.lastArrhythmiaData ?? null);
      setLastArrhythmiaStatus(vitalSigns.arrhythmiaStatus);
    }
  }, [vitalSigns.arrhythmiaStatus, vitalSigns.lastArrhythmiaData]);

  const startMonitoring = () => {
    setIsMonitoring(true);
    setIsCameraOn(true);
    setShowResults(false);
    setHeartRate(null);

    FeedbackService.vibrate(100);
    FeedbackService.playSound('notification');

    startProcessing();
    startHeartBeatMonitoring();

    setElapsedTime(0);

    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
    }

    measurementTimerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;

        if (newTime >= optimalMeasurementTime) {
          finalizeMeasurement();
          return optimalMeasurementTime;
        }
        return newTime;
      });
    }, 1000);
  };

  const finalizeMeasurement = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    stopHeartBeatMonitoring();

    FeedbackService.signalMeasurementComplete(signalQuality >= 70);

    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }

    const savedResults = resetVitalSigns();
    if (savedResults) {
      const safeResults = {
        ...savedResults,
        lastArrhythmiaData: savedResults.lastArrhythmiaData ?? null
      };
      setVitalSigns(safeResults);
      setShowResults(true);
    }

    setElapsedTime(0);
    setSignalQuality(0);
  };

  const handleReset = () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    reset();

    FeedbackService.vibrate([50, 30, 50]);

    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }

    fullResetVitalSigns();

    setElapsedTime(0);
    setHeartRate(null);
    setVitalSigns({
      spo2: null,
      pressure: null,
      arrhythmiaStatus: null,
      glucose: null,
      lipids: {
        totalCholesterol: null,
        triglycerides: null
      },
      hemoglobin: null,
      hydration: null,
      lastArrhythmiaData: null
    });
    setSignalQuality(0);
  };

  const getHydrationColor = (hydration: number | null) => {
    if (hydration === null) return 'text-gray-300';
    if (hydration >= 80) return 'text-blue-500';
    if (hydration >= 65) return 'text-green-500';
    if (hydration >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

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
            isFingerDetected={lastSignal?.fingerDetected}
            signalQuality={signalQuality}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-sm">
              Calidad: {signalQuality}
            </div>
            <div className="text-white text-sm">
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
              arrhythmiaStatus={vitalSigns.arrhythmiaStatus || ""}
              rawArrhythmiaData={vitalSigns.lastArrhythmiaData}
              preserveResults={showResults}
              isArrhythmia={isArrhythmia}
              beats={beats}
              arrhythmiaPhase={arrhythmiaPhase}
            />
          </div>

          <AppTitle />

          <div className="absolute inset-x-0 bottom-[40px] h-[40%] px-2 py-2">
            <div className="grid grid-cols-2 h-full gap-2">
              <div className="col-span-2 grid grid-cols-2 gap-2 mb-2">
                <VitalSign 
                  label="FRECUENCIA CARDÍACA"
                  value={heartRate ?? "--"}
                  unit="BPM"
                  highlighted={showResults}
                  compact={false}
                />
                <VitalSign 
                  label="SPO2"
                  value={vitalSigns.spo2 ?? "--"}
                  unit="%"
                  highlighted={showResults}
                  compact={false}
                />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <VitalSign 
                  label="PRESIÓN"
                  value={vitalSigns.pressure ?? "--/--"}
                  unit="mmHg"
                  highlighted={showResults}
                  compact={false}
                />
                <VitalSign 
                  label="HIDRATACIÓN"
                  value={vitalSigns.hydration ?? "--"}
                  unit="%"
                  highlighted={showResults}
                  icon={<Droplet className={`h-4 w-4 ${getHydrationColor(vitalSigns.hydration)}`} />}
                  compact={false}
                />
              </div>
              <VitalSign 
                label="GLUCOSA"
                value={vitalSigns.glucose ?? "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="COLESTEROL"
                value={vitalSigns.lipids?.totalCholesterol ?? "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="TRIGLICÉRIDOS"
                value={vitalSigns.lipids?.triglycerides ?? "--"}
                unit="mg/dL"
                highlighted={showResults}
                compact={false}
              />
              <VitalSign 
                label="HEMOGLOBINA"
                value={vitalSigns.hemoglobin !== null ? Math.round(vitalSigns.hemoglobin) : "--"}
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
        </div>
      </div>
    </div>
  );
};

export default Index;

