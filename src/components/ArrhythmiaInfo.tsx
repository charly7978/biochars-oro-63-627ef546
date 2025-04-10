
import React from 'react';
import { Heart, Info } from 'lucide-react';

const ArrhythmiaInfo: React.FC = () => {
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 max-w-md">
      <div className="flex items-center mb-2">
        <Info className="h-4 w-4 mr-1 text-gray-400" />
        <span className="font-medium text-gray-200">Información sobre arritmias</span>
      </div>
      <ul className="space-y-1.5 list-disc list-inside pl-1">
        <li>Las arritmias son alteraciones en el ritmo cardíaco normal</li>
        <li>Patrones irregulares pueden indicar problemas cardíacos</li>
        <li>Un corazón sano mantiene una cadencia regular</li>
        <li>Consulte a un médico si detecta arritmias frecuentes</li>
      </ul>
      <div className="mt-2 flex items-center justify-center">
        <Heart className="h-4 w-4 text-red-400 mr-1" />
        <span className="text-gray-400 italic text-xs">Esta información es solo orientativa</span>
      </div>
    </div>
  );
};

export default ArrhythmiaInfo;
