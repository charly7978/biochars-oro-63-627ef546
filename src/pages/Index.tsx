
import React, { useState, useEffect } from 'react';
import CameraView from '../components/CameraView';
import HeartRateDisplay from '../components/HeartRateDisplay';
import PPGSignalMeter from '../components/PPGSignalMeter';
import { Button } from "../components/ui/button";
import AppTitle from '../components/AppTitle';
import { useFingerDetection } from '@/hooks/useFingerDetection';

const Index = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [heartRate, setHeartRate] = useState(0);
  const [signalConfidence, setSignalConfidence] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  
  const { 
    isFingerDetected, 
    detectionQuality, 
    updateDetection 
  } = useFingerDetection();

  const handleStreamReady = (newStream: MediaStream) => {
    setStream(newStream);
  };

  const handleSignalUpdate = (value: number, quality: number) => {
    // Update quality for finger detection
    updateDetection(quality > 30, quality);
    setSignalQuality(quality);
  };

  const handleToggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
  };

  const handleStartMeasurement = () => {
    console.log("Iniciando medición...");
    // Measurement logic would go here
  };

  const handleReset = () => {
    setHeartRate(0);
    setSignalConfidence(0);
  };

  useEffect(() => {
    // Simulate heart rate readings when finger is detected
    if (isFingerDetected) {
      const interval = setInterval(() => {
        setHeartRate(prev => {
          const direction = Math.random() > 0.5 ? 1 : -1;
          const change = Math.random() * 2;
          const newRate = prev === 0 ? 
            75 + Math.random() * 10 : 
            prev + direction * change;
          return Math.round(Math.max(65, Math.min(85, newRate)));
        });
        setSignalConfidence(detectionQuality / 100);
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setHeartRate(0);
      setSignalConfidence(0);
    }
  }, [isFingerDetected, detectionQuality]);

  return (
    <div className="w-full h-screen relative bg-gray-900 text-white overflow-hidden">
      {isMonitoring && (
        <CameraView 
          onStreamReady={handleStreamReady} 
          isMonitoring={isMonitoring} 
          signalQuality={signalQuality}
        />
      )}
      
      <div className="absolute inset-0 flex flex-col z-10">
        <header className="p-3 flex justify-between items-center">
          <AppTitle />
        </header>
        
        <main className="flex-1 flex flex-col p-4">
          {isMonitoring ? (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-1 gap-3 mb-4">
                <HeartRateDisplay 
                  bpm={heartRate} 
                  confidence={signalConfidence}
                />
              </div>
              
              <div className="mt-auto">
                <Button 
                  onClick={handleToggleMonitoring}
                  className="w-full"
                  variant="destructive"
                >
                  Detener Monitor
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold mb-2">Monitor de Signos Vitales</h1>
                <p className="text-gray-400 max-w-xs mx-auto">
                  Coloque su dedo sobre la cámara para monitorear su frecuencia cardíaca
                </p>
              </div>
              
              <Button 
                onClick={handleToggleMonitoring}
                className="w-full max-w-xs"
              >
                Iniciar Monitor
              </Button>
            </div>
          )}
        </main>
      </div>
      
      {isMonitoring && isFingerDetected && heartRate > 0 && (
        <PPGSignalMeter 
          value={Math.sin(Date.now() / 500) * 0.5 + 0.5} 
          quality={detectionQuality}
          onStartMeasurement={handleStartMeasurement}
          onReset={handleReset}
          currentBPM={heartRate}
        />
      )}
    </div>
  );
};

export default Index;
