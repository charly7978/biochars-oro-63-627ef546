
import React from 'react';
import { useSignalRenderer } from './useSignalRenderer';
import { VERTICAL_SCALE } from './constants';

interface SignalDisplayProps {
  value: number;
  isArrhythmia: boolean;
  isFingerDetected: boolean;
  preserveResults: boolean;
}

const SignalDisplay: React.FC<SignalDisplayProps> = ({
  value,
  isArrhythmia,
  isFingerDetected,
  preserveResults
}) => {
  const { canvasRef } = useSignalRenderer({
    value,
    isArrhythmia,
    isFingerDetected,
    preserveResults
  });

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={720}
      className="w-full h-full absolute inset-0 z-0 object-cover performance-boost"
      style={{
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        contain: 'paint layout size',
        imageRendering: 'crisp-edges'
      }}
    />
  );
};

export default SignalDisplay;
