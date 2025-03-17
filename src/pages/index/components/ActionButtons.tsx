
import React from 'react';
import MonitorButton from "@/components/MonitorButton";

interface ActionButtonsProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onReset: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onReset
}) => {
  return (
    <div className="absolute inset-x-0 bottom-4 flex gap-4 px-4">
      <div className="w-1/2">
        <MonitorButton 
          isMonitoring={isMonitoring} 
          onToggle={onToggleMonitoring} 
          variant="monitor"
        />
      </div>
      <div className="w-1/2">
        <MonitorButton 
          isMonitoring={isMonitoring} 
          onToggle={onReset} 
          variant="reset"
        />
      </div>
    </div>
  );
};

export default ActionButtons;
