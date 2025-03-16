
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Fingerprint } from 'lucide-react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  buttonPosition?: boolean;
  isCalibrating?: boolean;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition,
  isCalibrating = false,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const [hasTorch, setHasTorch] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const brightnessHistoryRef = useRef<number[]>([]);
  
  // New: track last torch state change time to prevent rapid changes
  const lastTorchChangeRef = useRef<number>(0);
  const torchDebounceTime = 500; // ms

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("CameraView: Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(windowsDetected);
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("CameraView: Stopping camera stream and turning off torch");
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
      const isWindows = /windows nt/i.test(navigator.userAgent);

      // More permissive constraints for better finger detection
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      if (isAndroid) {
        console.log("CameraView: Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
        });
      } else if (isIOS) {
        console.log("CameraView: Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
        });
      } else if (isWindows) {
        console.log("CameraView: Configurando para Windows");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
        });
      } else {
        console.log("CameraView: Configurando para escritorio");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Capacidades de la cámara:", capabilities);
          
          setHasTorch(!!capabilities.torch);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Apply lower-level constraints first for compatibility
          try {
            await videoTrack.applyConstraints({
              advanced: [{ exposureMode: 'continuous' }]
            });
            console.log("CameraView: Exposure mode set to continuous");
          } catch (err) {
            console.log("CameraView: Could not set exposure mode", err);
          }
          
          try {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
            console.log("CameraView: Focus mode set to continuous");
          } catch (err) {
            console.log("CameraView: Could not set focus mode", err);
          }
          
          // Don't activate torch immediately, wait for finger detection
          console.log("CameraView: Torch capability:", capabilities.torch ? "Available" : "Not available");
          
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
        } catch (err) {
          console.log("CameraView: No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.imageRendering = 'crisp-edges';
        
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.perspective = '1000px';
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("CameraView: Error al iniciar la cámara:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`CameraView: Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`CameraView: Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };

  // Check brightness to help with finger detection
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;
    
    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        canvas.width = 100;
        canvas.height = 100;
        
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 100, 100
        );
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let brightnessSum = 0;
        // Sample red channel for better finger detection
        for (let i = 0; i < data.length; i += 16) {
          brightnessSum += data[i]; // Red channel
        }
        
        const currentBrightness = brightnessSum / (data.length / 16);
        
        // Track brightness history
        brightnessHistoryRef.current.push(currentBrightness);
        if (brightnessHistoryRef.current.length > 10) {
          brightnessHistoryRef.current.shift();
        }
        
        // Average the last few readings for stability
        const avgBrightness = brightnessHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                             brightnessHistoryRef.current.length;
                             
        setBrightness(avgBrightness);
        
        console.log("CameraView: Brightness check", { 
          currentBrightness,
          avgBrightness,
          fingerDetected: isFingerDetected,
          signalQuality,
          hasTorch,
          torchEnabled
        });
      } catch (err) {
        console.error("CameraView: Error checking brightness:", err);
      }
    };
    
    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality, hasTorch, torchEnabled]);

  // Improved torch control with debounce and more permissive conditions
  useEffect(() => {
    if (!stream || !hasTorch) return;
    
    const now = Date.now();
    if (now - lastTorchChangeRef.current < torchDebounceTime) {
      return; // Prevent rapid torch changes
    }
    
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    try {
      // Activate torch when finger is detected OR during calibration
      // Also activate torch if brightness is low (possible finger present)
      const shouldEnableTorch = isFingerDetected || isCalibrating || 
                              (brightness > 0 && brightness < 100);
      
      if (shouldEnableTorch !== torchEnabled) {
        console.log(`CameraView: Cambiando estado de linterna a ${shouldEnableTorch ? 'ON' : 'OFF'}`, {
          reason: isFingerDetected ? 'finger_detected' : 
                  isCalibrating ? 'calibrating' : 
                  'brightness_based',
          brightness,
          signalQuality
        });
        
        videoTrack.applyConstraints({
          advanced: [{ torch: shouldEnableTorch }]
        }).then(() => {
          setTorchEnabled(shouldEnableTorch);
          lastTorchChangeRef.current = Date.now();
        }).catch(err => {
          console.error("CameraView: Error al controlar la linterna:", err);
        });
      }
    } catch (err) {
      console.error("CameraView: Error al controlar la linterna:", err);
    }
  }, [stream, hasTorch, isFingerDetected, isCalibrating, brightness, torchEnabled]);

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
          console.log("CameraView: Auto-enfoque refrescado con éxito");
        } catch (err) {
          console.error("CameraView: Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      }
    }
  }, [stream, isFocusing, isAndroid]);

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Refresh autofocus periodically when finger detected
  useEffect(() => {
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [isFingerDetected, refreshAutoFocus, isAndroid]);

  // Determine actual finger status with more permissive conditions
  const actualFingerDetected = isFingerDetected || 
                              (brightness > 0 && brightness < 100 && signalQuality > 20);

  return (
    <>
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
      
      {isMonitoring && buttonPosition && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !actualFingerDetected ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 40 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            actualFingerDetected ? "text-green-500" : "text-gray-400"
          }`}>
            {isCalibrating ? "calibrando..." : actualFingerDetected ? "dedo detectado" : "ubique su dedo en el lente"}
          </span>
          
          {hasTorch && (
            <span className="text-[10px] text-yellow-400 mt-1">
              {torchEnabled ? "linterna activada" : ""}
            </span>
          )}
        </div>
      )}
      
      {isCalibrating && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-20 bg-black/70 px-4 py-2 rounded-lg">
          <div className="text-white text-sm font-semibold mb-1 text-center">Calibrando sistema</div>
          <div className="text-xs text-white/80 mb-2 text-center">Mantenga el dispositivo estable</div>
        </div>
      )}
    </>
  );
};

export default CameraView;
