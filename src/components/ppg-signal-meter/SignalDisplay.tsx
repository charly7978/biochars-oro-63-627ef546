
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import React from 'react';
import { useSignalRenderer } from './useSignalRenderer';

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
