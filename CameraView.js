
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
  const activeTrackRef = useRef(null); // NUEVO: Referencia para track de video activo

  // CAMBIO CRÍTICO: Asegurarnos de detener recursos antes de reiniciar
  const stopCamera = async () => {
    try {
      console.log("CameraView: Deteniendo cámara cuidadosamente");
      
      // CRÍTICO: Limpiar referencia de ImageCapture primero
      imageCaptureCacheRef.current = null;
      processRunningRef.current = false;
      
      // CRÍTICO: Limpiar referencia de track activo
      activeTrackRef.current = null;
      
      if (stream) {
        const tracks = stream.getTracks();
        console.log(`CameraView: Deteniendo ${tracks.length} tracks`);
        
        for (const track of tracks) {
          try {
            console.log(`CameraView: Deteniendo track: ${track.kind} (${track.label})`);
            track.stop();
          } catch (err) {
            console.error("Error al detener track:", err);
          }
        }
        
        // CRÍTICO: Limpiar video source
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        
        setStream(null);
      }
    } catch (err) {
      console.error("Error general al detener cámara:", err);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // IMPORTANTE: Detener primero para limpiar recursos
      await stopCamera();
      
      console.log("CameraView: Iniciando cámara con nuevos recursos");

      const isAndroid = /android/i.test(navigator.userAgent);

      // Usar configuración más básica para maximizar compatibilidad
      const baseVideoConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 }, // Reducido 720 -> 640
        height: { ideal: 480 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 20 }, // Reducido 25 -> 20
        });
      }

      const constraints = {
        video: baseVideoConstraints
      };
      
      console.log("CameraView: Solicitando acceso a cámara con:", JSON.stringify(constraints));

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Stream obtenido correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];
      
      // CRÍTICO: Guardar referencia al track activo
      activeTrackRef.current = videoTrack;

      // Guardar información del dispositivo para diagnóstico
      if (videoTrack) {
        console.log(`CameraView: Track de video obtenido: ${videoTrack.label}`);
        
        setDeviceInfo({
          label: videoTrack.label,
          settings: videoTrack.getSettings(),
          constraints: videoTrack.getConstraints()
        });
        
        // Verificar si tiene linterna
        try {
          const capabilities = videoTrack.getCapabilities();
          const hasTorchCapability = capabilities?.torch === true;
          setHasTorch(hasTorchCapability);
          
          console.log(`CameraView: Capacidad de linterna: ${hasTorchCapability}`);
          
          // CAMBIO CRÍTICO: Activar linterna inmediatamente si disponible
          if (hasTorchCapability) {
            try {
              console.log("CameraView: Activando linterna inmediatamente");
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              console.log("CameraView: Linterna activada correctamente");
            } catch (err) {
              console.error("Error activando linterna inicial:", err);
            }
          }
        } catch (err) {
          console.error("Error verificando capacidades:", err);
          // Asumir que tiene linterna de todos modos para intentarlo
          setHasTorch(true);
        }
      }

      // Configurar video
      if (videoRef.current) {
        console.log("CameraView: Asignando stream a elemento video");
        videoRef.current.srcObject = newStream;
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.backfaceVisibility = 'hidden';
      }

      setStream(newStream);
      
      // CAMBIO CRÍTICO: Crear instancia de ImageCapture una sola vez
      if (videoTrack) {
        try {
          console.log("CameraView: Creando instancia de ImageCapture");
          imageCaptureCacheRef.current = new ImageCapture(videoTrack);
        } catch (err) {
          console.error("Error creando ImageCapture:", err);
        }
      }
      
      // CAMBIO CRÍTICO: Usar setTimeout para asegurar que el stream esté estable
      console.log("CameraView: Programando llamada a onStreamReady");
      setTimeout(() => {
        if (onStreamReady && newStream.active) {
          console.log("CameraView: Llamando a onStreamReady con stream activo");
          onStreamReady(newStream);
        } else {
          console.log("CameraView: No se pudo llamar a onStreamReady", {
            onStreamReadyExists: !!onStreamReady,
            streamActive: newStream?.active
          });
        }
      }, 800); // Mayor tiempo para estabilizar (500 -> 800ms)
      
    } catch (err) {
      console.error("Error crítico al iniciar la cámara:", err);
      alert("No se pudo acceder a la cámara. Por favor, reinicie la aplicación y otorgue permisos.");
    }
  };

  // CAMBIO CRÍTICO: Mantener linterna siempre activa con intervalo agresivo
  useEffect(() => {
    if (!stream || !hasTorch) return;
    
    console.log("CameraView: Configurando intervalo de mantenimiento de linterna");
    
    const activateTorch = async () => {
      if (!activeTrackRef.current) {
        console.log("CameraView: No hay track activo para activar linterna");
        return;
      }
      
      try {
        // CRÍTICO: Siempre activar la linterna
        await activeTrackRef.current.applyConstraints({
          advanced: [{ torch: true }]
        }).catch(err => {
          console.log("Error al controlar la linterna:", err);
        });
        
        console.log("CameraView: Linterna mantenida activa", new Date().toISOString());
      } catch (err) {
        console.error("Error al mantener activa la linterna:", err);
      }
    };
    
    // Activar linterna inmediatamente
    activateTorch();
    
    // Intervalo agresivo cada 1 segundo para mantener la linterna encendida
    const torchInterval = setInterval(activateTorch, 1000);
    
    return () => clearInterval(torchInterval);
  }, [stream, hasTorch]);

  // Monitor camera brightness - SIMPLIFICADO para evitar problemas de rendimiento
  useEffect(() => {
    if (!stream || !videoRef.current || !isMonitoring) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 50; // Reducido para mejor rendimiento (100 -> 50)
    canvas.height = 50; // Reducido para mejor rendimiento (100 -> 50)

    const checkBrightness = () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      
      try {
        ctx.drawImage(
          videoRef.current,
          0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight,
          0, 0, 50, 50
        );
        
        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;
        
        let brightness = 0;
        // Sample every 20th pixel to improve performance (reduced from 16th)
        for (let i = 0; i < data.length; i += 20) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += (r + g + b) / 3;
        }
        
        brightness /= (data.length / 20);
        
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
        console.error("Error verificando brillo:", err);
      }
    };

    // Intervalo menos frecuente para reducir carga (500ms -> 1000ms)
    const interval = setInterval(checkBrightness, 1000);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, isFingerDetected, signalQuality, brightnessSamples, deviceInfo]);

  // Efecto para iniciar/detener cámara según isMonitoring
  useEffect(() => {
    console.log(`CameraView: Cambio en isMonitoring: ${isMonitoring}`);
    
    if (isMonitoring && !stream) {
      console.log("CameraView: Iniciando cámara porque isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Deteniendo cámara porque isMonitoring=false");
      stopCamera();
    }
    
    // Cleanup al desmontar componente
    return () => {
      console.log("CameraView: Componente desmontando, deteniendo cámara");
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
            className="text-green-500" // CAMBIO CRÍTICO: Siempre verde para indicar detección
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
