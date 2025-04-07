
import React, { useRef, useEffect, useState } from 'react';
import CameraView from '@/components/CameraView';
import HeartRateDisplay from '@/components/HeartRateDisplay';
import MonitorButton from '@/components/MonitorButton';
import { useHeartBeatProcessor } from '@/hooks/heart-beat/useHeartBeatProcessor';
import GraphGrid from '@/components/GraphGrid';
import VitalSign from '@/components/VitalSign';
import { Button } from '@/components/ui/button';
import PPGResultDialog from '@/components/PPGResultDialog';

const Index = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [lastFrame, setLastFrame] = useState<ImageData | null>(null);
  
  const {
    heartBeatResult,
    isProcessing,
    startProcessing,
    stopProcessing,
    processSignal,
    signalQuality: heartBeatSignalQuality,
    artifactDetected,
    stressLevel,
    isCalibrating,
    startCalibration,
    endCalibration,
    calibrationProgress,
    calibrateProcessors,
    reset,
    arrhythmiaStatus,
    hrvData,
    ppgData
  } = useHeartBeatProcessor();

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      stopProcessing();
      reset();
    } else {
      setIsMonitoring(true);
      startProcessing();
      startCalibration();
    }
  };

  const handleStreamReady = (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const processFrame = () => {
    if (!isMonitoring || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data from canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    setLastFrame(imageData);
    
    // Process the frame for PPG signal
    if (isProcessing && heartBeatResult) {
      const result = processSignal(0); // Simplified for now
      setSignalQuality(result.confidence * 100);
      setFingerDetected(!artifactDetected);
    }
    
    // Request next frame
    requestAnimationFrame(processFrame);
  };

  // Start processing frames when monitoring begins
  useEffect(() => {
    if (isMonitoring) {
      requestAnimationFrame(processFrame);
    }
  }, [isMonitoring]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-hidden">
        {/* Camera view container */}
        <div className="h-full w-full max-w-md mx-auto relative">
          <CameraView
            onStreamReady={handleStreamReady}
            isMonitoring={isMonitoring}
            isFingerDetected={fingerDetected}
            signalQuality={Math.round(signalQuality)}
          />
          
          {/* Hidden canvas for processing */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Controls overlay */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center">
            <MonitorButton
              isMonitoring={isMonitoring}
              onToggle={handleToggleMonitoring}
            />
          </div>
          
          {/* Heart rate display if monitoring */}
          {isMonitoring && (
            <div className="absolute top-4 left-0 right-0 flex justify-center">
              <HeartRateDisplay 
                heartRate={heartBeatResult?.bpm || 0}
                confidence={heartBeatResult?.confidence || 0}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results dialog */}
      <PPGResultDialog
        open={isResultModalOpen}
        onOpenChange={setIsResultModalOpen}
        heartRate={heartBeatResult?.bpm || 0}
        arrhythmiaStatus={arrhythmiaStatus}
        stressLevel={stressLevel}
        hrvData={hrvData}
      />
    </div>
  );
};

export default Index;
