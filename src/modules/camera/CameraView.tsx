import React, { useRef, useEffect, useState, useCallback } from 'react';
import { configureCameraForDevice, processFramesControlled } from './CameraFrameCapture';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onFrameProcessed?: (imageData: ImageData) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  frameRate?: number;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onStreamReady, 
  onFrameProcessed,
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  frameRate = 30
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const processingCallbackRef = useRef<((imageData: ImageData) => void) | null>(null);
  const frameProcessorRef = useRef<() => void | null>(null);

  useEffect(() => {
    processingCallbackRef.current = onFrameProcessed || null;
  }, [onFrameProcessed]);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iosDetected = /ipad|iphone|ipod/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iosDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(iosDetected);
  }, []);

  const stopCamera = async () => {
    if (frameProcessorRef.current) {
      frameProcessorRef.current();
      frameProcessorRef.current = null;
    }
    
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          track.stop();
        } catch (err) {
          console.error("Error al detener track:", err);
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      retryAttemptsRef.current = 0;
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      };

      if (isAndroid) {
        console.log("Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isIOS) {
        console.log("Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      } else {
        console.log("Configurando para escritorio con máxima resolución");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        await configureCameraForDevice(videoTrack, isAndroid, isIOS);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.imageRendering = 'crisp-edges';
          videoRef.current.style.backfaceVisibility = 'hidden';
          videoRef.current.style.perspective = '1000px';
        }

        setStream(newStream);
        
        if (processingCallbackRef.current) {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          
          if (frameProcessorRef.current) {
            frameProcessorRef.current();
          }
          
          frameProcessorRef.current = processFramesControlled(
            imageCapture,
            isMonitoring,
            frameRate,
            processingCallbackRef.current
          );
        }
        
        if (onStreamReady) {
          onStreamReady(newStream);
        }
        
        retryAttemptsRef.current = 0;
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };

  const refreshAutoFocus = useCallback(async () => {
    if (stream && !isFocusing && !isAndroid) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        try {
          setIsFocusing(true);
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'manual' }]
          });
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          console.log("Auto-enfoque refrescado con éxito");
        } catch (err) {
          console.error("Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      }
    }
  }, [stream, isFocusing, isAndroid]);

  const handleStreamReady = useCallback((newStream: MediaStream) => {
    if (!isMonitoring) return;
    
    const videoTrack = newStream.getVideoTracks()[0];
    
    if (typeof window !== 'undefined' && 'ImageCapture' in window) {
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      
      if (frameProcessorRef.current) {
        frameProcessorRef.current();
      }
      
      if (processingCallbackRef.current) {
        frameProcessorRef.current = processFramesControlled(
          imageCapture,
          isMonitoring,
          frameRate,
          processingCallbackRef.current
        );
      }
    } else {
      console.warn("ImageCapture API not supported in this browser");
    }
    
    if (onStreamReady) {
      onStreamReady(newStream);
    }
  }, [isMonitoring, frameRate, onStreamReady]);

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring, stream]);

  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
    
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        imageRendering: 'crisp-edges'
      }}
    />
  );
};

export default CameraView;
