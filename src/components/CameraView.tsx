
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
  
  // Add reference to track the video track for torch control
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  
  // Add timer interval reference to keep torch active
  const torchIntervalRef = useRef<number | null>(null);
  
  // Add reference to track last torch activation time
  const lastTorchTimeRef = useRef<number>(0);
  
  // Add reference to counter for persistent torch
  const torchActivationCountRef = useRef<number>(0);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    
    console.log("CameraView: Platform detected:", {
      userAgent,
      isAndroid: androidDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("CameraView: Stopping camera stream");
      
      // Clear torch interval if active
      if (torchIntervalRef.current) {
        window.clearInterval(torchIntervalRef.current);
        torchIntervalRef.current = null;
      }
      
      try {
        // Explicitly turn off torch before stopping tracks
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities()?.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: false }]
          });
          console.log("CameraView: Torch explicitly turned off before stopping camera");
        }
      } catch (err) {
        console.error("CameraView: Error turning off torch:", err);
      }
      
      // Stop all tracks
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error("CameraView: Error stopping track:", err);
        }
      });
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      videoTrackRef.current = null;
      torchActivationCountRef.current = 0;
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      // More permissive constraints for better finger detection
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      if (isAndroid) {
        console.log("CameraView: Configuring for Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("CameraView: Attempting to access camera with config:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Camera initialized successfully");
      
      const videoTrack = newStream.getVideoTracks()[0];
      videoTrackRef.current = videoTrack;

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("CameraView: Camera capabilities:", capabilities);
          
          setHasTorch(!!capabilities.torch);
          setDeviceInfo({
            label: videoTrack.label,
            settings: videoTrack.getSettings(),
            constraints: videoTrack.getConstraints()
          });
          
          // Apply camera optimizations
          try {
            if (capabilities.exposureMode) {
              await videoTrack.applyConstraints({
                advanced: [{ exposureMode: 'continuous' }]
              });
              console.log("CameraView: Exposure mode set to continuous");
            }
            
            if (capabilities.focusMode) {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              });
              console.log("CameraView: Focus mode set to continuous");
            }
            
            if (capabilities.whiteBalanceMode) {
              await videoTrack.applyConstraints({
                advanced: [{ whiteBalanceMode: 'continuous' }]
              });
              console.log("CameraView: White balance mode set to continuous");
            }
          } catch (err) {
            console.log("CameraView: Could not apply all optimizations:", err);
          }
        } catch (err) {
          console.log("CameraView: Error getting capabilities:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
      }

      setStream(newStream);
      setIsInitialDetection(true);
      torchActivationCountRef.current = 0;
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      // Show error message to user
      alert("Could not access camera. Please ensure you've granted camera permissions.");
    }
  };

  // Set up BETTER persistent torch monitoring - MÁS FRECUENTE Y ROBUSTO
  useEffect(() => {
    if (stream && hasTorch) {
      // Clear existing interval if any
      if (torchIntervalRef.current) {
        window.clearInterval(torchIntervalRef.current);
      }
      
      // Set up interval to ensure torch stays on if needed - INTERVALO MÁS FRECUENTE
      torchIntervalRef.current = window.setInterval(() => {
        const shouldBeTorchOn = isFingerDetected || isCalibrating;
        const now = Date.now();
        
        // Only update if we need to and not too frequently (max once per 500ms)
        if (shouldBeTorchOn !== torchEnabled && (now - lastTorchTimeRef.current > 500)) {
          console.log("CameraView: Torch refresh interval triggered", {
            shouldBeTorchOn,
            currentTorchState: torchEnabled,
            timeSinceLastChange: now - lastTorchTimeRef.current,
            activationCount: torchActivationCountRef.current
          });
          
          updateTorchState(shouldBeTorchOn);
        }
        
        // NUEVO: Reactivar periódicamente en Android para evitar apagado automático
        if (shouldBeTorchOn && isAndroid && torchEnabled && 
            (now - lastTorchTimeRef.current > 2000)) {
          // Incrementar contador
          torchActivationCountRef.current++;
          
          console.log("CameraView: Periodic torch refresh for Android", {
            activationCount: torchActivationCountRef.current
          });
          
          // Reactivar la linterna para evitar que se apague
          updateTorchState(true);
        }
      }, 1000); // Check every 1 second - reducido
      
      return () => {
        if (torchIntervalRef.current) {
          window.clearInterval(torchIntervalRef.current);
          torchIntervalRef.current = null;
        }
      };
    }
  }, [stream, hasTorch, isFingerDetected, isCalibrating, torchEnabled, isAndroid]);

  // Dedicated function to update torch state with improved error handling
  const updateTorchState = useCallback(async (enable: boolean) => {
    if (!videoTrackRef.current || !hasTorch) return;
    
    try {
      console.log(`CameraView: Setting torch to ${enable ? 'ON' : 'OFF'}`, {
        attempt: torchActivationCountRef.current + 1
      });
      
      // NUEVO: Aplicar dos veces para asegurar en Android
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: enable }]
      });
      
      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Segundo intento para asegurar en Android
      if (isAndroid && enable) {
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: enable }]
        });
      }
      
      setTorchEnabled(enable);
      lastTorchTimeRef.current = Date.now();
      
      if (enable) {
        torchActivationCountRef.current++;
      }
      
      console.log("CameraView: Torch state updated successfully", { 
        torchState: enable, 
        activationCount: torchActivationCountRef.current,
        timestamp: new Date().toISOString() 
      });
    } catch (err) {
      console.error("CameraView: Error controlling torch:", err);
      
      // NUEVO: Segundo intento con delay en caso de error
      try {
        if (videoTrackRef.current) {
          setTimeout(async () => {
            console.log("CameraView: Retry torch activation after error");
            await videoTrackRef.current?.applyConstraints({
              advanced: [{ torch: enable }]
            });
          }, 500);
        }
      } catch (retryErr) {
        console.error("CameraView: Retry failed:", retryErr);
      }
    }
  }, [hasTorch, isAndroid]);

  // Monitor brightness to help with finger detection - ALGORITMO MEJORADO
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
        
        // Capture from center of video (mejor para dedo)
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
        
        // Auto-detect finger and activate torch in initial detection - UMBRAL MÁS PERMISIVO
        if (isInitialDetection && avgBrightness > 0 && avgBrightness < 100) {
          console.log("CameraView: Initial brightness suggests finger present", {
            brightness: avgBrightness
          });
          
          // Turn on torch if we have it and brightness suggests finger
          if (hasTorch && videoTrackRef.current) {
            updateTorchState(true);
          }
          
          setIsInitialDetection(false);
        }
        
        // Log less frequently to avoid console flood
        if (Date.now() % 1000 < 100) {
          console.log("CameraView: Brightness check", { 
            avgBrightness,
            fingerDetected: isFingerDetected,
            signalQuality,
            hasTorch,
            torchEnabled,
            activationCount: torchActivationCountRef.current
          });
        }
      } catch (err) {
        console.error("CameraView: Error checking brightness:", err);
      }
    };
    
    const interval = setInterval(checkBrightness, 500);
    return () => clearInterval(interval);
  }, [stream, isMonitoring, hasTorch, isFingerDetected, isInitialDetection, updateTorchState]);

  // React to changes in finger detection - LÓGICA MÁS PERMISIVA
  useEffect(() => {
    if (!stream || !hasTorch) return;
    
    // Always attempt to maintain torch state based on finger detection or calibration
    // NUEVO: UMBRAL MÁS PERMISIVO PARA ACTIVACIÓN
    const shouldBeTorchOn = isFingerDetected || isCalibrating || 
                          (brightness > 0 && brightness < 100);
    
    if (shouldBeTorchOn !== torchEnabled) {
      console.log(`CameraView: Changing torch state to ${shouldBeTorchOn ? 'ON' : 'OFF'}`, {
        reason: isFingerDetected ? 'finger_detected' : 
                isCalibrating ? 'calibrating' : 
                'brightness_based',
        brightness
      });
      
      updateTorchState(shouldBeTorchOn);
    }
  }, [stream, hasTorch, isFingerDetected, isCalibrating, brightness, torchEnabled, updateTorchState]);

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

  // Determine actual finger status with more permissive conditions - MÁS PERMISIVO
  const actualFingerDetected = isFingerDetected || 
                              (brightness > 0 && brightness < 100 && signalQuality > 10);

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
              signalQuality > 60 ? 'text-green-500' :
              signalQuality > 30 ? 'text-yellow-500' :
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
