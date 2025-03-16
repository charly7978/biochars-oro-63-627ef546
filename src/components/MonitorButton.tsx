
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface MonitorButtonProps {
  isMonitoring: boolean;
  onToggle: () => void;
  variant?: "monitor" | "reset";
}

const MonitorButton: React.FC<MonitorButtonProps> = ({ 
  isMonitoring, 
  onToggle, 
  variant = "monitor" 
}) => {
  const baseClass = "w-full animation-smooth";
  
  // Get the button variant accepted by shadcn/ui Button component
  const getButtonVariant = () => {
    if (variant === "reset") return "secondary";
    return isMonitoring ? "destructive" : "default"; // Using 'default' instead of 'primary'
  };
  
  return (
    <Button 
      onClick={onToggle} 
      variant={getButtonVariant()}
      className={cn(
        baseClass,
        isMonitoring && variant === "monitor" && "bg-[var(--medical-danger-direct)] hover:bg-[var(--medical-danger-direct)]/90",
        !isMonitoring && variant === "monitor" && "bg-[var(--medical-info-direct)] hover:bg-[var(--medical-info-direct)]/90"
      )}
    >
      {variant === "monitor" ? (isMonitoring ? 'Detener' : 'Iniciar') : 'Reset'}
    </Button>
  );
};

export default MonitorButton;
