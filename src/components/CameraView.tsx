
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';

interface CameraViewProps {
  onStreamReady: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  buttonPosition?: { x: number, y: number } | null;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [brightnessSamples, setBrightnessSamples] = useState<number[]>([]);
  const [avgBrightness, setAvgBrightness] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const brightnessSampleLimit = 10;

  const stopCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      });
      setStream(null);
      setTorchOn(false);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30 }, // Aumentado para mayor sensibilidad
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints = {
        video: baseVideoConstraints
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        console.log("CameraView: Camera capabilities", videoTrack.getCapabilities());
        
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints = [];
          
          // Intentar siempre activar la linterna
          if (capabilities.torch) {
            advancedConstraints.push({ torch: true });
            setTorchOn(true);
            console.log("CameraView: Torch enabled");
          } else {
            console.log("CameraView: Torch not available in capabilities");
          }
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'manual' }); // Mejor manual para PPG
            
            if (capabilities.exposureCompensation) {
              // Aumentar exposición para mejor detección
              const maxExposure = capabilities.exposureCompensation.max || 2;
              advancedConstraints.push({ exposureCompensation: maxExposure });
            }
          }
          
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
            
            // También aplicar restricciones directamente
            if (capabilities.torch) {
              await videoTrack.applyConstraints({ torch: true });
            }
          }
          
          // Verificar si la linterna se activó - corregir error de TypeScript
          const settings = videoTrack.getSettings();
          console.log("CameraView: Applied camera settings", settings);
          
          // Verificar linterna de manera segura usando capabilities en lugar de settings
          const torchEnabled = capabilities.torch ? true : false;
          setTorchOn(torchEnabled);

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
          
          // Intento alternativo de activar la linterna
          try {
            await videoTrack.applyConstraints({ torch: true });
            setTorchOn(true);
            console.log("CameraView: Torch enabled via second attempt");
          } catch (e) {
            console.log("CameraView: Failed to enable torch in second attempt", e);
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  };

  // Monitor camera brightness to help with finger detection verification
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 100;
    canvas.height = 100;

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 100, 100
        );
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let brightness = 0;
        let redChannel = 0;
        
        // Sample every 4th pixel to improve performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (r + g + b) / 3;
          redChannel += r;
        }
        
        brightness /= (data.length / 16);
        redChannel /= (data.length / 16);
        
        setBrightnessSamples(prev => {
          const newSamples = [...prev, brightness];
          if (newSamples.length > brightnessSampleLimit) {
            newSamples.shift();
          }
          return newSamples;
        });

        const avgBrightness = brightnessSamples.reduce((sum, val) => sum + val, 0) / 
                            Math.max(1, brightnessSamples.length);
        setAvgBrightness(avgBrightness);
        
        console.log("CameraView: Brightness check", { 
          currentBrightness: brightness.toFixed(1),
          redChannel: redChannel.toFixed(1),
          avgBrightness: avgBrightness.toFixed(1),
          fingerDetected: isFingerDetected,
          signalQuality,
          torchOn
        });
      } catch (err) {
        console.error("Error checking brightness:", err);
      }
    };

    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality, brightnessSamples, torchOn]);

  useEffect(() => {
    if (isMonitoring && !stream) {
      startCamera();
    } else if (!isMonitoring && stream) {
      stopCamera();
    }
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Determine actual finger status using both provided detection and brightness
  const actualFingerStatus = isFingerDetected && (
    avgBrightness < 70 || // Dark means finger is likely present
    signalQuality > 40    // Reduced threshold para mejor detección
  );

  // Loading indicator while camera is starting
  if (isMonitoring && !stream) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="text-white">Iniciando cámara...</div>
      </div>
    );
  }

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
          backfaceVisibility: 'hidden'
        }}
      />
      {isMonitoring && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !actualFingerStatus ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            actualFingerStatus ? 'text-green-500' : 'text-white'
          }`}>
            {actualFingerStatus ? "dedo detectado" : "ubique su dedo sobre la cámara y linterna"}
          </span>
          
          {!torchOn && (
            <span className="text-red-500 text-xs mt-1">
              ¡Atención! Linterna no activada
            </span>
          )}
        </div>
      )}
    </>
  );
};

export default CameraView;
