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
  const torchActivationCountRef = useRef<number>(10);
  const torchKeepAliveIntervalRef = useRef<number | null>(null);
  const torchKeepAliveCountRef = useRef<number>(0);

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
      
      if (torchIntervalRef.current) {
        window.clearInterval(torchIntervalRef.current);
        torchIntervalRef.current = null;
      }
      
      if (torchKeepAliveIntervalRef.current) {
        window.clearInterval(torchKeepAliveIntervalRef.current);
        torchKeepAliveIntervalRef.current = null;
      }
      
      try {
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
      
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error("CameraView: Error stopping track:", err);
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
      videoTrackRef.current = null;
      torchActivationCountRef.current = 10;
      torchKeepAliveCountRef.current = 0;
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

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
      torchActivationCountRef.current = 10;
      
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("CameraView: Activando linterna inmediatamente para mejorar detección");
        setTimeout(() => {
          updateTorchState(true);
        }, 500);
      }
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
    } catch (err) {
      console.error("CameraView: Error starting camera:", err);
      alert("Could not access camera. Please ensure you've granted camera permissions.");
    }
  };

  useEffect(() => {
    if (stream && hasTorch) {
      if (torchIntervalRef.current) {
        window.clearInterval(torchIntervalRef.current);
      }
      
      if (torchKeepAliveIntervalRef.current) {
        window.clearInterval(torchKeepAliveIntervalRef.current);
      }
      
      torchIntervalRef.current = window.setInterval(() => {
        const shouldBeTorchOn = isFingerDetected || isCalibrating || true;
        const now = Date.now();
        
        if (torchKeepAliveCountRef.current % 5 === 0) {
          console.log("CameraView: Torch status check", {
            shouldBeTorchOn,
            currentTorchState: torchEnabled,
            timeSinceLastChange: now - lastTorchTimeRef.current,
            activationCount: torchActivationCountRef.current,
            keepAliveCount: torchKeepAliveCountRef.current
          });
        }
        
        if (shouldBeTorchOn !== torchEnabled) {
          updateTorchState(shouldBeTorchOn);
        }
        
        torchKeepAliveCountRef.current++;
      }, 750);
      
      torchKeepAliveIntervalRef.current = window.setInterval(() => {
        if (isAndroid) {
          console.log("CameraView: Android torch keep-alive refresh");
          if (videoTrackRef.current) {
            try {
              videoTrackRef.current.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
              torchActivationCountRef.current++;
            } catch (err) {
              console.error("CameraView: Error en torch keep-alive:", err);
            }
          }
        } else if (torchEnabled) {
          console.log("CameraView: General torch keep-alive refresh");
          updateTorchState(true);
        }
      }, 3000);
      
      return () => {
        if (torchIntervalRef.current) {
          window.clearInterval(torchIntervalRef.current);
          torchIntervalRef.current = null;
        }
        
        if (torchKeepAliveIntervalRef.current) {
          window.clearInterval(torchKeepAliveIntervalRef.current);
          torchKeepAliveIntervalRef.current = null;
        }
      };
    }
  }, [stream, hasTorch, isFingerDetected, isCalibrating, torchEnabled, isAndroid]);

  const updateTorchState = useCallback(async (enable: boolean) => {
    if (!videoTrackRef.current || !hasTorch) return;
    
    try {
      console.log(`CameraView: Setting torch to ${enable ? 'ON' : 'OFF'}`, {
        attempt: torchActivationCountRef.current + 1
      });
      
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: enable }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: enable }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
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
      
      if (videoTrackRef.current) {
        for (let i = 0; i < 3; i++) {
          setTimeout(async () => {
            try {
              console.log(`CameraView: Retry torch activation after error (attempt ${i+1})`);
              await videoTrackRef.current?.applyConstraints({
                advanced: [{ torch: enable }]
              });
            } catch (retryErr) {
              console.error(`CameraView: Retry ${i+1} failed:`, retryErr);
            }
          }, 500 * (i+1));
        }
      }
    }
  }, [hasTorch, isAndroid]);

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
        if (brightnessHistoryRef.current.length > 10) {
          brightnessHistoryRef.current.shift();
        }
        
        const avgBrightness = brightnessHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                             brightnessHistoryRef.current.length;
                             
        setBrightness(avgBrightness);
        
        if (isInitialDetection && avgBrightness > 0 && avgBrightness < 100) {
          console.log("CameraView: Initial brightness suggests finger present", {
            brightness: avgBrightness
          });
          
          if (hasTorch && videoTrackRef.current) {
            updateTorchState(true);
          }
          
          setIsInitialDetection(false);
        }
        
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

  useEffect(() => {
    if (!stream || !hasTorch) return;
    
    const shouldBeTorchOn = true;
    
    if (shouldBeTorchOn !== torchEnabled) {
      console.log(`CameraView: Changing torch state to ${shouldBeTorchOn ? 'ON' : 'OFF'}`, {
        reason: 'forced_always_on',
        brightness
      });
      
      updateTorchState(shouldBeTorchOn);
    }
  }, [stream, hasTorch, brightness, torchEnabled, updateTorchState]);

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

  const actualFingerDetected = isFingerDetected || 
                              (brightness > 0 && brightness < 200) || 
                              signalQuality > 5;

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
