
import React, { forwardRef } from 'react';

interface CameraVideoElementProps {
  signalQuality?: number;
  isAndroid?: boolean;
}

export const CameraVideoElement = forwardRef<HTMLVideoElement, CameraVideoElementProps>(
  ({ signalQuality = 0, isAndroid = false }, ref) => {
    const targetFrameInterval = isAndroid ? 1000/10 : 
                               signalQuality > 70 ? 1000/30 : 1000/15;
    
    return (
      <video
        ref={ref}
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
    );
  }
);

CameraVideoElement.displayName = 'CameraVideoElement';
