
import React, { useCallback, useEffect } from 'react';
import CameraView from '@/components/CameraView';

interface CameraProcessorProps {
  isMonitoring: boolean;
  signalQuality: number;
  isFingerDetected?: boolean;
  onFrameProcess: (imageData: ImageData) => void;
}

const CameraProcessor: React.FC<CameraProcessorProps> = ({
  isMonitoring,
  signalQuality,
  isFingerDetected = false,
  onFrameProcess,
}) => {
  const handleStreamReady = useCallback((stream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    // Configurar cámara para optimizar la captura PPG
    const capabilities = videoTrack.getCapabilities();
    if (capabilities.width && capabilities.height) {
      const maxWidth = capabilities.width.max;
      const maxHeight = capabilities.height.max;
      
      videoTrack.applyConstraints({
        width: { ideal: maxWidth },
        height: { ideal: maxHeight },
        torch: true
      }).catch(err => console.error("Error aplicando configuración de alta resolución:", err));
    } else if (videoTrack.getCapabilities()?.torch) {
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    }
    
    // Canvas para procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Variables para control de rendimiento
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // 30 FPS
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          const frame = await imageCapture.grabFrame();
          tempCanvas.width = frame.width;
          tempCanvas.height = frame.height;
          tempCtx.drawImage(frame, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, frame.width, frame.height);
          onFrameProcess(imageData);
          
          lastProcessTime = now;
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };

    processImage();
  }, [isMonitoring, onFrameProcess]);

  return (
    <div className="absolute inset-0">
      <CameraView 
        onStreamReady={handleStreamReady}
        isMonitoring={isMonitoring}
        isFingerDetected={isFingerDetected}
        signalQuality={signalQuality}
      />
    </div>
  );
};

export default CameraProcessor;
