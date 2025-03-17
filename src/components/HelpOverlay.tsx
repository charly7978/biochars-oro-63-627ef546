
import React from 'react';
import { X } from 'lucide-react';

interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpOverlay = ({ isOpen, onClose }: HelpOverlayProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 relative">
        <button 
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-4">Cómo usar esta aplicación</h2>
        
        <div className="space-y-4 text-gray-200">
          <div>
            <h3 className="font-semibold text-green-400">1. Coloque su dedo</h3>
            <p>Cubra completamente la lente de la cámara con la yema de su dedo índice.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400">2. Espere la calibración</h3>
            <p>La aplicación se calibra automáticamente en dos fases:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Calibración de dispositivo (30 segundos)</li>
              <li>Calibración de arritmias (10 segundos adicionales)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400">3. Permanezca quieto</h3>
            <p>Mantenga su dedo quieto durante todo el proceso para obtener mediciones precisas.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400">4. Resultados</h3>
            <p>Al finalizar, verá sus resultados de frecuencia cardíaca, SpO2, presión arterial y detección de arritmias.</p>
          </div>
        </div>
        
        <div className="mt-6 text-yellow-300 text-sm">
          <p>Nota: Esta aplicación utiliza la cámara de su dispositivo para analizar el flujo sanguíneo y detectar ritmo cardíaco y posibles arritmias.</p>
        </div>
        
        <button 
          onClick={onClose}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

export default HelpOverlay;
