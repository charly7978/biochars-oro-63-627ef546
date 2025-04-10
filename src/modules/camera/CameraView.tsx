
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { configureCameraForDevice, processFramesControlled } from './CameraFrameCapture';
import DeviceCapabilityDetector from './DeviceCapabilityDetector';

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
  const [isIOS, setIsIOS] = useState(false);
  const [deviceCapabilities, setDeviceCapabilities] = useState<any>(null);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const processingCallbackRef = useRef<((imageData: ImageData) => void) | null>(null);
  const frameProcessorRef = useRef<() => void | null>(null);

  useEffect(() => {
    processingCallbackRef.current = onFrameProcessed || null;
  }, [onFrameProcessed]);

  // Memo para evitar re-renderizados innecesarios
  const userAgentInfo = useMemo(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iosDetected = /ipad|iphone|ipod/i.test(userAgent);
    
    return {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iosDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    };
  }, []);

  useEffect(() => {
    console.log("Plataforma detectada:", userAgentInfo);
    
    setIsAndroid(userAgentInfo.isAndroid);
    setIsIOS(userAgentInfo.isIOS);
    
    // Inicializar detector de capacidades
    const initializeCapabilities = async () => {
      try {
        const detector = DeviceCapabilityDetector.getInstance();
        const capabilities = await detector.detectCapabilities();
        setDeviceCapabilities(capabilities);
        console.log("Capacidades del dispositivo detectadas:", capabilities);
      } catch (error) {
        console.error("Error detectando capacidades:", error);
      }
    };
    
    initializeCapabilities();
  }, [userAgentInfo]);

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

      // Obtener capacidades adaptativas del dispositivo
      const detector = DeviceCapabilityDetector.getInstance();
      const capabilities = detector.getCapabilities();
      
      // Usar configuración adaptativa basada en capacidades detectadas
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: capabilities.recommendedResolution.width },
        height: { ideal: capabilities.recommendedResolution.height },
        frameRate: { ideal: capabilities.maxFPS }
      };

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración adaptativa:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        await configureCameraForDevice(videoTrack, userAgentInfo.isAndroid, userAgentInfo.isIOS);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          // Aplicar optimizaciones de renderizado
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.imageRendering = capabilities.isLowEndDevice ? 'auto' : 'crisp-edges';
          videoRef.current.style.backfaceVisibility = 'hidden';
          videoRef.current.style.perspective = '1000px';
        }

        setStream(newStream);
        
        if (processingCallbackRef.current) {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          
          if (frameProcessorRef.current) {
            frameProcessorRef.current();
          }
          
          // Usar el frameRate adaptativo
          const adaptiveFrameRate = capabilities.maxFPS;
          console.log(`Usando tasa de frames adaptativa: ${adaptiveFrameRate} FPS`);
          
          frameProcessorRef.current = processFramesControlled(
            imageCapture,
            isMonitoring,
            adaptiveFrameRate,
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
        // Obtener frameRate adaptativo
        const adaptiveFrameRate = deviceCapabilities?.maxFPS || frameRate;
        
        frameProcessorRef.current = processFramesControlled(
          imageCapture,
          isMonitoring,
          adaptiveFrameRate,
          processingCallbackRef.current
        );
      }
    } else {
      console.warn("ImageCapture API not supported in this browser");
    }
    
    if (onStreamReady) {
      onStreamReady(newStream);
    }
  }, [isMonitoring, frameRate, onStreamReady, deviceCapabilities]);

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

  // Cálculo de la calidad visual según capacidades
  const videoQuality = useMemo(() => {
    if (!deviceCapabilities) return "auto";
    
    return deviceCapabilities.isLowEndDevice ? 'auto' : 
           deviceCapabilities.isMidRangeDevice ? 'pixelated' : 'crisp-edges';
  }, [deviceCapabilities]);

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
        imageRendering: videoQuality
      }}
    />
  );
};

export default CameraView;
