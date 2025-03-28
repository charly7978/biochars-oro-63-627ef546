
/**
 * Camera View Component
 * Displays the camera feed and finger detection status
 */

import React, { useRef, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';
import { useVitalSigns } from '@/context/VitalSignsContext';

interface CameraViewProps {
  onStreamReady: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  buttonPosition?: {
    x?: number;
    y?: number;
  };
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  buttonPosition = { x: 0, y: 0 }
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  /**
   * Start camera with optimal settings for PPG
   */
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported");
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

      if (videoTrack && isAndroid) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
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
          console.log("Could not apply some optimizations:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        if (isAndroid) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
    } catch (err) {
      console.error("Error starting camera:", err);
    }
  };

  /**
   * Stop all camera tracks and clean up
   */
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  };

  // Start/stop camera based on isMonitoring prop
  useEffect(() => {
    if (isMonitoring) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isMonitoring]);

  // Calculate button position styles
  const getFingerButtonStyle = () => {
    const defaultStyle = "absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center";
    
    if (!buttonPosition || (buttonPosition.x === undefined && buttonPosition.y === undefined)) {
      return defaultStyle;
    }
    
    // If custom position is provided, use it instead of default styling
    let customStyle = "absolute z-20 flex flex-col items-center";
    
    if (buttonPosition.x !== undefined) {
      customStyle += ` left-[${buttonPosition.x}px]`;
    } else {
      customStyle += " left-1/2 transform -translate-x-1/2";
    }
    
    if (buttonPosition.y !== undefined) {
      customStyle += ` bottom-[${buttonPosition.y}px]`;
    } else {
      customStyle += " bottom-24";
    }
    
    return customStyle;
  };

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
        <div className={getFingerButtonStyle()}>
          <Fingerprint
            size={48}
            className={`transition-colors duration-300 ${
              !isFingerDetected ? 'text-gray-400' :
              signalQuality > 75 ? 'text-green-500' :
              signalQuality > 50 ? 'text-yellow-500' :
              'text-red-500'
            }`}
          />
          <span className={`text-xs mt-2 transition-colors duration-300 ${
            isFingerDetected ? 'text-green-500' : 'text-gray-400'
          }`}>
            {isFingerDetected ? "finger detected" : "place your finger on the lens"}
          </span>
        </div>
      )}
    </>
  );
};

export default CameraView;
