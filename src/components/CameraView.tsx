
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Fingerprint, Camera, Activity } from 'lucide-react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  confidence?: number;
  isArrhythmia?: boolean;
  buttonPosition?: string;
  showDetailedIndicators?: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  confidence = 0,
  isArrhythmia = false,
  buttonPosition,
  showDetailedIndicators = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [brightnessSamples, setBrightnessSamples] = useState<number[]>([]);
  const [avgBrightness, setAvgBrightness] = useState(0);
  const [cameraInfo, setCameraInfo] = useState<any>(null);
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
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 720 },
        height: { ideal: 480 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 25 },
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];
      
      // Guardar información de la cámara
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        const capabilities = videoTrack.getCapabilities();
        setCameraInfo({
          label: videoTrack.label,
          settings,
          capabilities,
          isFlashAvailable: capabilities?.torch || false
        });
      }

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet);
          }
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' } as MediaTrackConstraintSet);
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' } as MediaTrackConstraintSet);
          }

          if (advancedConstraints.length > 0) {
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
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
        // Sample every 4th pixel to improve performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (r + g + b) / 3;
        }
        
        brightness /= (data.length / 16);
        
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
      } catch (err) {
        console.error("Error checking brightness:", err);
      }
    };

    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality, brightnessSamples]);

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
  const actualFingerStatus = useMemo(() => {
    return isFingerDetected && (
      avgBrightness < 60 || // Dark means finger is likely present
      signalQuality > 50    // Good quality signal confirms finger
    );
  }, [isFingerDetected, avgBrightness, signalQuality]);

  // Determinar la clasificación de calidad
  const qualityClassification = useMemo(() => {
    if (signalQuality >= 75) return 'Óptima';
    if (signalQuality >= 50) return 'Buena';
    if (signalQuality >= 25) return 'Regular';
    return 'Baja';
  }, [signalQuality]);

  // Determine text color based on quality
  const qualityTextColor = useMemo(() => {
    if (signalQuality >= 75) return 'text-green-500';
    if (signalQuality >= 50) return 'text-yellow-500';
    if (signalQuality >= 25) return 'text-orange-500';
    return 'text-red-500';
  }, [signalQuality]);

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
        <>
          {/* Indicador detallado de calidad */}
          {showDetailedIndicators && (
            <div className="absolute top-4 right-4 z-20">
              {/* We'll comment this out until SignalQualityIndicator is implemented */}
              {/* <SignalQualityIndicator
                quality={signalQuality}
                confidence={confidence || 0.5}
                isFingerDetected={actualFingerStatus}
                hasArrhythmia={isArrhythmia}
                showDetailed={true}
                className="w-64"
              /> */}
            </div>
          )}
          
          {/* Indicador simplificado para posición personalizada */}
          {buttonPosition && (
            <div className={`absolute ${buttonPosition} z-20 flex flex-col items-center`}>
              <div className="bg-black/20 backdrop-blur-sm rounded-full p-3">
                <Fingerprint
                  size={48}
                  className={`transition-colors duration-300 ${
                    !actualFingerStatus ? 'text-gray-400' :
                    signalQuality > 75 ? 'text-green-500' :
                    signalQuality > 50 ? 'text-yellow-500' :
                    'text-red-500'
                  }`}
                />
              </div>
              <div className="mt-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  actualFingerStatus ? qualityTextColor : 'text-gray-400'
                }`}>
                  {actualFingerStatus 
                    ? `Calidad: ${qualityClassification} (${signalQuality}%)` 
                    : "Ubique su dedo en el lente"}
                </span>
              </div>
              
              {isArrhythmia && (
                <div className="mt-1 bg-red-500/20 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">Arritmia detectada</span>
                </div>
              )}
            </div>
          )}
          
          {/* Indicadores de estado de la cámara */}
          {cameraInfo && (
            <div className="absolute bottom-4 left-4 z-20 bg-black/30 backdrop-blur-sm rounded-lg p-2 text-xs text-white/70">
              <div className="flex items-center gap-1">
                <Camera className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{cameraInfo.label || 'Cámara trasera'}</span>
              </div>
              {cameraInfo.isFlashAvailable && (
                <div className="flex items-center gap-1 mt-1">
                  <span>Flash: {stream?.getVideoTracks()[0]?.getConstraints()?.advanced?.[0]?.torch ? 'Activo' : 'Inactivo'}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default CameraView;
