
import React from 'react';

interface ControlPanelProps {
  onStart: () => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onStart, onReset }) => {
  return (
    <div className="h-[80px] grid grid-cols-2 gap-px bg-gray-900 mt-auto">
      <button 
        onClick={onStart}
        className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
      >
        INICIAR
      </button>
      <button 
        onClick={onReset}
        className="w-full h-full bg-black/80 text-2xl font-bold text-white active:bg-gray-800"
      >
        RESET
      </button>
    </div>
  );
};

export default ControlPanel;
