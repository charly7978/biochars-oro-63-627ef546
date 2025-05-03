import React, { useState, useRef, useEffect, useCallback } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import AppTitle from "@/components/AppTitle";
import { VitalSignsResult } from "@/modules/vital-signs/types/vital-signs-result";
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';
import { registerGlobalCleanup } from '@/utils/cleanup-utils';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import HeartRateService from '@/services/HeartRateService';
import MonitorButton from "@/components/MonitorButton";
import { Droplet } from "lucide-react";
import { HeartBeatConfig } from "@/modules/heart-beat/config";
import { VitalSignsProcessor } from "@/modules/vital-signs/VitalSignsProcessor";

const Index = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [vitalSigns, setVitalSigns] = useState<Omit<VitalSignsResult, 'heartRate' | 'arrhythmiaStatus' | 'lastArrhythmiaData'>>({
      spo2: NaN,
      pressure: "--/--",
      glucose: NaN,
      glucoseConfidence: 0,
      overallConfidence: 0
  });
  const [heartRate, setHeartRate] = useState<number | string>("--");
  const [hrConfidence, setHrConfidence] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const measurementTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSignalValueRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef(HeartRateService.getInstance());
  const vitalSignsProcessorRef = useRef(new VitalSignsProcessor());

  useEffect(() => {
    registerGlobalCleanup();
    const currentProcessor = processorRef.current;
    const currentVitalsProcessor = vitalSignsProcessorRef.current;
    return () => {
        currentProcessor?.reset();
        currentVitalsProcessor?.fullReset();
    };
  }, []);

  const processPPGData = useCallback(() => {
    if (!isMonitoring) return;

    const ppgValue = lastSignalValueRef.current;
    
    const hrResult = processorRef.current.processSignal(ppgValue);
    setHeartRate(hrResult.bpm > 0 ? hrResult.bpm : "--");
    setHrConfidence(hrResult.confidence);
    if (hrResult.rrData) {
        ArrhythmiaDetectionService.updateRRIntervals(hrResult.rrData.intervals);
    }
    setIsArrhythmia(ArrhythmiaDetectionService.isArrhythmia());
    
    const otherVitals = vitalSignsProcessorRef.current.processSignal(hrResult.filteredValue);
    setVitalSigns(otherVitals);
    
    setSignalQuality(Math.round(hrResult.confidence * 100)); 

    if (isMonitoring) {
        animationFrameRef.current = requestAnimationFrame(processPPGData);
    }
  }, [isMonitoring]);

  const startMonitoring = () => {
    console.log("Starting monitoring...");
    setVitalSigns({ spo2: NaN, pressure: "--/--", glucose: NaN, glucoseConfidence: 0, overallConfidence: 0});
    setShowResults(false);
    setIsArrhythmia(false);
    setHeartRate("--");
    setHrConfidence(0);
    setSignalQuality(0);
    processorRef.current.reset();
    vitalSignsProcessorRef.current.fullReset();
    ArrhythmiaDetectionService.reset();
    setIsCameraOn(true);
    setIsMonitoring(true);
    
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
    measurementTimer.current = setTimeout(() => {
      console.log("30 second measurement timer elapsed.");
      finalizeMeasurement();
    }, 30000);
  };

  const finalizeMeasurement = () => {
    if (!isMonitoring) return;
    console.log("Finalizing measurement...");
    const finalVitals = vitalSignsProcessorRef.current.getLastValidResult();
    const finalHr = processorRef.current.getFinalBPM ? processorRef.current.getFinalBPM() : heartRate;
    setVitalSigns(prev => ({ ...prev, ...finalVitals }));
    setHeartRate(finalHr > 0 ? finalHr : "--");
    setShowResults(true);
    stopMonitoring();
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    setIsCameraOn(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (measurementTimer.current) {
      clearTimeout(measurementTimer.current);
      measurementTimer.current = null;
    }
    console.log("Monitoring stopped.");
  };

  const handleReset = () => {
    console.log("Resetting application state...");
    stopMonitoring();
    processorRef.current.reset();
    vitalSignsProcessorRef.current.fullReset();
    ArrhythmiaDetectionService.reset();
    setVitalSigns({ spo2: NaN, pressure: "--/--", glucose: NaN, glucoseConfidence: 0, overallConfidence: 0 });
    setHeartRate("--");
    setHrConfidence(0);
    setSignalQuality(0);
    setIsArrhythmia(false);
    setShowResults(false);
    if (measurementTimer.current) clearTimeout(measurementTimer.current);
  };

  const handleStreamReady = useCallback((mediaStream: MediaStream) => {
    if (!isMonitoring) {
        mediaStream.getTracks().forEach(track => track.stop());
        return; 
    } 
    setStream(mediaStream);
    processorRef.current.setMonitoring(true);
    
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack) {
        console.error("No video track found in the stream.");
        stopMonitoring();
        return;
    }
    const imageCapture = new ImageCapture(videoTrack);
    
    const capabilities = videoTrack.getCapabilities();
    if (capabilities?.torch) {
      console.log("Activating torch...");
      videoTrack.applyConstraints({ advanced: [{ torch: true }] })
        .catch(err => console.error("Error activating torch:", err));
    } else {
      console.warn("Torch not available on this camera.");
    }
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) {
      console.error("Failed to get 2D context for frame processing.");
      stopMonitoring();
      return;
    }
    
    let lastProcessTime = 0;
    const targetFrameInterval = 1000 / HeartBeatConfig.SAMPLE_RATE;
    
    const captureAndProcess = async () => {
        if (!isMonitoring || !mediaStream.active || videoTrack.readyState !== 'live') {
            console.log("Stopping capture loop.");
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
            return; 
        }

        const now = performance.now();
        if (now - lastProcessTime >= targetFrameInterval) {
            lastProcessTime = now;
            try {
                const imageBitmap = await imageCapture.grabFrame();
                tempCanvas.width = imageBitmap.width;
                tempCanvas.height = imageBitmap.height;
                tempCtx.drawImage(imageBitmap, 0, 0);
                imageBitmap.close();
                const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                
                const data = imageData.data;
                let sumR = 0;
                for (let i = 0; i < data.length; i += 4) {
                    sumR += data[i];
                }
                lastSignalValueRef.current = data.length > 0 ? (sumR / (data.length / 4)) : 0;

                if (animationFrameRef.current === null) {
                    console.log("Starting processPPGData loop");
                    processPPGData();
                }

            } catch (error) {
                console.error("Error grabbing or processing frame:", error);
            }
        }
        if (isMonitoring) {
           requestAnimationFrame(captureAndProcess);
        }
    };

    requestAnimationFrame(captureAndProcess);

  }, [isMonitoring, processPPGData]);

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  };

  const getHydrationColor = (hydration: number): string => {
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
            isFingerDetected={signalQuality > 10}
            signalQuality={signalQuality} 
          />
        </div>
        <div className="relative z-10 h-full flex flex-col">
          <div className="px-4 py-2 flex justify-around items-center bg-black/20">
            <div className="text-white text-sm">Calidad: {signalQuality}</div>
            <div className="text-white text-sm">{signalQuality > 10 ? "Huella Detectada" : "Huella No Detectada"}</div>
          </div>
          <div className="flex-1">
            <PPGSignalMeter 
              value={lastSignalValueRef.current}
              quality={signalQuality} 
              isFingerDetected={signalQuality > 10}
              onStartMeasurement={startMonitoring} 
              onReset={handleReset} 
              arrhythmiaStatus={ArrhythmiaDetectionService.getArrhythmiaStatus().statusMessage || "--"} 
              preserveResults={showResults} 
              isArrhythmia={isArrhythmia}
              arrhythmiaWindows={ArrhythmiaDetectionService.getArrhythmiaWindows()}
            />
          </div>
          <AppTitle />
          <div className="absolute inset-x-0 bottom-[40px] h-[40%] px-2 py-2">
            <div className="grid grid-cols-2 h-full gap-2">
              <div className="col-span-2 grid grid-cols-2 gap-2 mb-2">
                <VitalSign label="FRECUENCIA CARDÍACA" value={typeof heartRate === 'number' && heartRate > 0 ? heartRate : "--"} unit="BPM" highlighted={showResults} compact={false} />
                <VitalSign label="SPO2" value={vitalSigns.spo2 && !isNaN(vitalSigns.spo2) && vitalSigns.spo2 > 0 ? vitalSigns.spo2 : "--"} unit="%" highlighted={showResults} compact={false} />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <VitalSign label="PRESIÓN" value={vitalSigns.pressure || "--/--"} unit="mmHg" highlighted={showResults} compact={false} />
                <VitalSign label="GLUCOSA" value={vitalSigns.glucose && !isNaN(vitalSigns.glucose) && vitalSigns.glucose > 0 ? vitalSigns.glucose : "--"} unit="mg/dL" highlighted={showResults} compact={false} />
              </div>
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
