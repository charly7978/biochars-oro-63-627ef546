
import React from 'react';
import { Button } from "@/components/ui/button";

interface MonitorButtonProps {
  isMonitoring: boolean;
  onToggle: () => void;
  variant?: "monitor" | "reset";
}

const MonitorButton: React.FC<MonitorButtonProps> = ({ isMonitoring, onToggle, variant = "monitor" }) => {
  // Determine the styles based on the variant and state
  const getButtonVariant = () => {
    if (variant === "monitor") {
      return isMonitoring ? "destructive" : "default";
    } else {
      return "secondary";
    }
  };
      
  return (
    <Button 
      onClick={onToggle} 
      variant={getButtonVariant()} 
      className="w-full"
    >
      {variant === "monitor" ? (isMonitoring ? 'Detener' : 'Iniciar') : 'Reset'}
    </Button>
  );
};

export default MonitorButton;
