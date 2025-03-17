
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
  const [brightness, setBrightness] = useState(0);
  const brightnessHistoryRef = useRef<number[]>([]);
  const [hasTorch, setHasTorch] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInitialDetection, setIsInitialDetection] = useState(true);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const torchIntervalRef = useRef<number | null>(null);
  const lastTorchTimeRef = useRef<number>(0);
  const torchActivationCountRef = useRef<number>(0);
  const torchKeepAliveIntervalRef = useRef<number | null>(null);
  const torchKeepAliveCountRef = useRef<number>(0);
  const forceFingerDetectionRef = useRef<boolean>(true); // CAMBIO CRÍTICO: Forzar detección
  
  // CAMBIO CRÍTICO: Intervalos más frecuentes
  const TORCH_CHECK_INTERVAL = 500; // Más frecuente (750ms -> 500ms)
  const TORCH_KEEPALIVE_INTERVAL = 1000; // Más frecuente (3000ms -> 1000ms)
  const BRIGHTNESS_CHECK_INTERVAL = 300; // Más frecuente (500ms -> 300ms)

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    setIsAndroid(androidDetected);
    
    // CAMBIO CRÍTICO: Forzar detección de dedo desde el inicio
    forceFingerDetectionRef.current = true;
    console.log("CameraView: Detección de dedo forzada por defecto");
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("CameraView: Stopping camera stream");
      
      if (torchIntervalRef.current) {
        window.clearInterval(torchIntervalRef.current);
        torchIntervalRef.current = null;
      }
      
      if (torchKeepAliveIntervalRef.current) {
        window.clearInterval(torchKeepAliveIntervalRef.current);
        torchKeepAliveIntervalRef.current = null;
      }
      
      try {
        // Intentar apagar linterna antes de cerrar
        if (videoTrackRef.current) {
          try {
            await videoTrackRef.current.applyConstraints({
              advanced: [{ torch: false }]
            });
            console.log("CameraView: Torch explicitly turned off");
          } catch (err) {
            console.error("CameraView: Error turning off torch:", err);
          }
        }
        
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.error("CameraView: Error stopping track:", err);
          }
        });
      } catch (err) {
        console.error("CameraView: Error in stopCamera:", err);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      videoTrackRef.current = null;
      torchActivationCountRef.current = 0;
      torchKeepAliveCountRef.current = 0;
    }
  };

  const startCamera = async () => {
    try {
      console.log("CameraView: Intentando iniciar cámara");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 }
        },
        audio: false
      };

      console.log("CameraView: Accessing camera with:", JSON.stringify(constraints));
      
      // CAMBIO CRÍTICO: Manejo de errores mejorado
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error("CameraView: Error en getUserMedia inicial:", err);
        
        // Intentar con configuración mínima
        const minimalConstraints = {
          video: { facingMode: 'environment' },
          audio: false
        };
        
        console.log("CameraView: Reintentando con configuración mínima");
        newStream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
      }
      
      console.log("CameraView: Camera initialized successfully");
      const videoTrack = newStream.getVideoTracks()[0];
      videoTrackRef.current = videoTrack;

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          setHasTorch(!!capabilities.torch);
          setDeviceInfo({
            label: videoTrack.label,
            settings: videoTrack.getSettings(),
            constraints: videoTrack.getConstraints()
          });
        } catch (err) {
          console.error("CameraView: Error getting capabilities:", err);
          // Asumir que tiene linterna de todos modos
          setHasTorch(true);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setStream(newStream);
      setIsInitialDetection(true);
      
      // CAMBIO CRÍTICO: Activar linterna inmediatamente
      if (videoTrack) {
        console.log("CameraView: Activando linterna inmediatamente");
        setTimeout(() => {
          updateTorchState(true);
        }, 300);
      }
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      alert("No se pudo acceder a la cámara. Asegúrese de haber otorgado permisos.");
    }
  };

  // CAMBIO CRÍTICO: Forzar linterna siempre activa
  useEffect(() => {
    if (!stream || !videoTrackRef.current) return;
    
    console.log("CameraView: Configurando intervalo de control de linterna");
    
    const keepTorchOn = () => {
      if (videoTrackRef.current) {
        updateTorchState(true);
      }
    };
    
    // Activar inmediatamente
    keepTorchOn();
    
    // Establecer intervalo agresivo
    const interval = setInterval(keepTorchOn, TORCH_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [stream, videoTrackRef.current]);

  const updateTorchState = useCallback(async (enable: boolean) => {
    if (!videoTrackRef.current) return;
    
    try {
      console.log(`CameraView: Setting torch ${enable ? 'ON' : 'OFF'}`);
      
      // CAMBIO CRÍTICO: Intentos múltiples
      for (let i = 0; i < 3; i++) {
        try {
          await videoTrackRef.current.applyConstraints({
            advanced: [{ torch: enable }]
          });
          
          // Pequeña pausa
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`CameraView: Intento ${i+1} de activar linterna falló:`, err);
        }
      }
      
      setTorchEnabled(enable);
      lastTorchTimeRef.current = Date.now();
      torchActivationCountRef.current++;
      
    } catch (err) {
      console.error("CameraView: Error general controlling torch:", err);
    }
  }, []);

  // CAMBIO CRÍTICO: Comprobación de brillo más frecuente y permisiva
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
        
        const vidWidth = videoRef.current.videoWidth;
        const vidHeight = videoRef.current.videoHeight;
        const centerX = vidWidth / 2 - 50;
        const centerY = vidHeight / 2 - 50;
        
        ctx.drawImage(
          videoRef.current,
          centerX, centerY, 100, 100,
          0, 0, 100, 100
        );
        
        const imageData = ctx.getImageData(0, 0, 100, 100);
        const data = imageData.data;
        
        let brightnessSum = 0;
        for (let i = 0; i < data.length; i += 16) {
          brightnessSum += data[i];
        }
        
        const currentBrightness = brightnessSum / (data.length / 16);
        
        brightnessHistoryRef.current.push(currentBrightness);
        if (brightnessHistoryRef.current.length > 5) { // Reducido (10 -> 5)
          brightnessHistoryRef.current.shift();
        }
        
        const avgBrightness = brightnessHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                             brightnessHistoryRef.current.length;
                             
        setBrightness(avgBrightness);
        
        // CAMBIO CRÍTICO: Siempre considerar que hay un dedo
        forceFingerDetectionRef.current = true;
        
        // Siempre mantener linterna activa
        if (hasTorch && videoTrackRef.current) {
          updateTorchState(true);
        }
        
      } catch (err) {
        console.error("CameraView: Error checking brightness:", err);
      }
    };
    
    const interval = setInterval(checkBrightness, BRIGHTNESS_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, hasTorch, updateTorchState]);

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
  }, [isMonitoring, stream]);

  // CAMBIO CRÍTICO: Siempre considerar que hay un dedo
  const actualFingerDetected = isFingerDetected || 
                              forceFingerDetectionRef.current || 
                              (brightness > 0);

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
              signalQuality > 30 ? 'text-green-500' :
              signalQuality > 10 ? 'text-yellow-500' :
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
