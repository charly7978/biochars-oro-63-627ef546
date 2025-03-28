
import React from 'react';
import { Button } from './ui/button';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onToggle: () => void;
  variant?: "monitor" | "reset";
  disabled?: boolean;
  extraClasses?: string;
}

const MonitorButton: React.FC<MonitorButtonProps> = ({ 
  isMonitoring, 
  onToggle, 
  variant = "monitor",
  disabled = false,
  extraClasses = ""
}) => {
  // Determine text and color based on variant and state
  const buttonText = variant === "monitor" 
    ? (isMonitoring ? 'Detener' : 'Iniciar') 
    : 'Reset';
  
  const buttonVariant = variant === "monitor"
    ? (isMonitoring ? "destructive" : "default")
    : "secondary";

  return (
    <Button 
      onClick={onToggle} 
      variant={buttonVariant}
      disabled={disabled}
      className={`w-full font-bold ${extraClasses}`}
    >
      {buttonText}
    </Button>
  );
};

export default MonitorButton;
