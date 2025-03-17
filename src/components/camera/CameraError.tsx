
import React from 'react';
import { Button } from "@/components/ui/button";

interface CameraErrorProps {
  errorMessage: string;
  onRetry: () => void;
}

const CameraError = ({ errorMessage, onRetry }: CameraErrorProps) => {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-4 z-10">
      <div className="max-w-md text-center">
        <h3 className="text-xl font-bold mb-2">Error de cámara</h3>
        <p>{errorMessage}</p>
        <Button 
          onClick={onRetry}
          className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
        >
          Reintentar
        </Button>
      </div>
    </div>
  );
};

export default CameraError;
