
import React, { useState, useRef, useEffect } from "react";
import VitalSign from "@/components/VitalSign";
import CameraView from "@/components/CameraView";
import { useSignalProcessor } from "@/hooks/useSignalProcessor";
import { useHeartBeatProcessor } from "@/hooks/useHeartBeatProcessor";
import { useVitalSignsProcessor } from "@/hooks/useVitalSignsProcessor";
import { useHRVAnalysis } from "@/hooks/heart-beat/use-hrv-analysis";
import PPGSignalMeter from "@/components/PPGSignalMeter";
import MonitorButton from "@/components/MonitorButton";
import AppTitle from "@/components/AppTitle";
import ShareButton from "@/components/ShareButton";
import HeartRateVariabilityChart from "@/components/HeartRateVariabilityChart";
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
  const [showHRVChart, setShowHRVChart] = useState(false);
  const [rrIntervals, setRRIntervals] = useState<number[]>([]);
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

  const {
    hrvResult,
    addRRInterval,
    analyzeHRV,
    reset: resetHRVAnalysis
  } = useHRVAnalysis();

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

  // Analyze HRV when we have enough data points
  useEffect(() => {
    if (rrIntervals.length > 15 && isMonitoring) {
      analyzeHRV().then(() => {
        // Show HRV chart after we have valid data
        setShowHRVChart(true);
      });
    }
  }, [rrIntervals, isMonitoring, analyzeHRV]);

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
          
          // Capture RR intervals for HRV analysis
          if (heartBeatResult.rrData && heartBeatResult.rrData.intervals.length > 0) {
            // Add new RR intervals to the collection
            heartBeatResult.rrData.intervals.forEach(interval => {
              addRRInterval(interval);
              setRRIntervals(prev => [...prev, interval]);
            });
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
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate, addRRInterval]);

  const startMonitoring = () => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      setRRIntervals([]);
      setShowHRVChart(false);
      resetHRVAnalysis();
      
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

    // Final HRV analysis at the end of measurement
    if (rrIntervals.length > 10) {
      analyzeHRV().then(() => {
        setShowHRVChart(true);
      });
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
    setShowHRVChart(false);
    stopProcessing();
    stopHeartBeatMonitoring();
    resetHeartBeatProcessor();
    resetHRVAnalysis();
    setRRIntervals([]);
    
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
          <div className="px-4 py-2 flex justify-between items-center bg-black/20">
            <div className="text-white text-lg">
              Calidad: {signalQuality}
            </div>
            <div className="flex items-center gap-2">
              <ShareButton />
              <div className="text-white text-lg">
                {lastSignal?.fingerDetected ? "Huella Detectada" : "Huella No Detectada"}
              </div>
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
            
            {/* HRV Chart Overlay - Only shows when there's data and after measurement */}
            {showHRVChart && hrvResult && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in rounded-lg overflow-hidden">
                <div className="absolute top-2 right-2 z-10">
                  <button 
                    onClick={() => setShowHRVChart(false)}
                    className="bg-white/10 hover:bg-white/20 p-1 rounded-full text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="text-white font-semibold mb-2">
                  Análisis de Variabilidad del Ritmo Cardíaco (HRV)
                </div>
                <HeartRateVariabilityChart 
                  data={rrIntervals}
                  hrvResult={hrvResult}
                  width={320}
                  height={180}
                  lineColor="#0EA5E9"
                  showGrid={true}
                  showMetrics={true}
                />
                {hrvResult && (
                  <div className="mt-2 grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white/10 p-2 rounded">
                      <div className="text-xs text-gray-300">SDNN</div>
                      <div className="text-lg text-white font-semibold">{hrvResult.sdnn.toFixed(1)}</div>
                      <div className="text-xs text-gray-400">ms</div>
                    </div>
                    <div className="bg-white/10 p-2 rounded">
                      <div className="text-xs text-gray-300">RMSSD</div>
                      <div className="text-lg text-white font-semibold">{hrvResult.rmssd.toFixed(1)}</div>
                      <div className="text-xs text-gray-400">ms</div>
                    </div>
                    <div className="bg-white/10 p-2 rounded">
                      <div className="text-xs text-gray-300">pNN50</div>
                      <div className="text-lg text-white font-semibold">{hrvResult.pnn50.toFixed(1)}</div>
                      <div className="text-xs text-gray-400">%</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
            <div className="w-1/3">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleToggleMonitoring} 
                variant="monitor"
              />
            </div>
            <div className="w-1/3">
              <MonitorButton 
                isMonitoring={isMonitoring} 
                onToggle={handleReset} 
                variant="reset"
              />
            </div>
            <div className="w-1/3">
              <button 
                onClick={() => {
                  if (rrIntervals.length > 10) {
                    analyzeHRV().then(() => setShowHRVChart(true));
                  }
                }}
                disabled={rrIntervals.length < 10}
                className={`w-full h-14 rounded-lg text-white font-semibold ${
                  rrIntervals.length >= 10 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' 
                    : 'bg-gray-700 opacity-50'
                }`}
              >
                VER HRV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
