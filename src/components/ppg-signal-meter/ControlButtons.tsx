
import React from 'react';

interface ControlButtonsProps {
  onStartMeasurement: () => void;
  onReset: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({ onStartMeasurement, onReset }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[60px] grid grid-cols-2 bg-transparent z-10">
      <button 
        onClick={onStartMeasurement}
        className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
      >
        INICIAR
      </button>
      <button 
        onClick={onReset}
        className="bg-transparent text-black/80 hover:bg-white/5 active:bg-white/10 transition-colors duration-200 text-sm font-semibold"
      >
        RESET
      </button>
    </div>
  );
};

export default ControlButtons;
