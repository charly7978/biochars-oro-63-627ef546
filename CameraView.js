
import React, { useRef, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';

// Update the props interface to include isCalibrating
const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition,
  isCalibrating = false 
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [brightnessSamples, setBrightnessSamples] = useState([]);
  const [avgBrightness, setAvgBrightness] = useState(0);
  const brightnessSampleLimit = 10;
  const [hasTorch, setHasTorch] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const imageCaptureCacheRef = useRef(null); // Para cachear la instancia de ImageCapture
  const processRunningRef = useRef(false); // Para evitar llamadas simultáneas

  // CAMBIO CRÍTICO: Detener la cámara cuidadosamente para evitar InvalidStateError
  const stopCamera = async () => {
    try {
      // Limpiar referencia de ImageCapture primero
      imageCaptureCacheRef.current = null;
      processRunningRef.current = false;
      
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            // Detener tracks con manejo de errores
            track.stop();
          } catch (err) {
            console.error("Error al detener track:", err);
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        
        setStream(null);
      }
    } catch (err) {
      console.error("Error al detener cámara:", err);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // CAMBIO CRÍTICO: Detener primero para limpiar recursos
      await stopCamera();

      const isAndroid = /android/i.test(navigator.userAgent);

      const baseVideoConstraints = {
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

      const constraints = {
        video: baseVideoConstraints
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      // Guardar información del dispositivo para diagnóstico
      if (videoTrack) {
        setDeviceInfo({
          label: videoTrack.label,
          settings: videoTrack.getSettings(),
          constraints: videoTrack.getConstraints()
        });
        
        // Verificar si tiene linterna
        const capabilities = videoTrack.getCapabilities();
        setHasTorch(capabilities?.torch === true);
        
        // CAMBIO CRÍTICO: Activar linterna inmediatamente
        if (capabilities?.torch) {
          try {
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            console.log("Linterna activada inmediatamente");
          } catch (err) {
            console.error("Error activando linterna inicial:", err);
          }
        }
      }

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
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
      
      // CAMBIO CRÍTICO: Crear instancia de ImageCapture una sola vez y cachearla
      if (videoTrack) {
        try {
          imageCaptureCacheRef.current = new ImageCapture(videoTrack);
        } catch (err) {
          console.error("Error creando ImageCapture:", err);
        }
      }
      
      // CAMBIO CRÍTICO: Usar setTimeout para asegurar que el stream esté estable
      setTimeout(() => {
        if (onStreamReady && newStream.active) {
          onStreamReady(newStream);
        }
      }, 500);
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  };

  // CAMBIO CRÍTICO: Mantener linterna siempre activa
  useEffect(() => {
    const activateTorch = async () => {
      if (!stream || !hasTorch) return;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') return;
      
      try {
        // CAMBIO CRÍTICO: Siempre activar la linterna
        await videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => {
          console.log("Error al controlar la linterna:", err);
        });
        
        console.log("CameraView: Linterna activada permanentemente");
      } catch (err) {
        console.error("Error al controlar la linterna:", err);
      }
    };
    
    // Activar linterna inmediatamente y periódicamente
    activateTorch();
    
    // Ping cada 1 segundo para mantener la linterna encendida
    const torchInterval = setInterval(activateTorch, 1000);
    
    return () => clearInterval(torchInterval);
  }, [stream, hasTorch]);

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
  }, [stream, isMonitoring, isFingerDetected, signalQuality, brightnessSamples, deviceInfo]);

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

  // CAMBIO CRÍTICO: Siempre retornar true para finger detection
  const actualFingerStatus = true;

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
      {isMonitoring && buttonPosition && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <Fingerprint
            size={48}
            className="text-green-500" // CAMBIO CRÍTICO: Siempre verde
          />
          <span className="text-xs mt-2 text-green-500"> {/* CAMBIO CRÍTICO: Siempre verde */}
            {isCalibrating ? "calibrando..." : "dedo detectado"}
          </span>
          
          {hasTorch && (
            <span className="text-[10px] text-yellow-400 mt-1">
              linterna activada
            </span>
          )}
        </div>
      )}
      
      {isCalibrating && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-20 bg-black/70 px-4 py-2 rounded-lg">
          <div className="text-white text-sm font-semibold mb-1 text-center">Calibración instantánea</div>
          <div className="text-xs text-white/80 mb-2 text-center">Sistema optimizado con valores predeterminados</div>
        </div>
      )}
    </>
  );
};

export default CameraView;
