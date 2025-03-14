
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const historySize = 5; // Ventana de historial para promedio

  // Detectar plataforma
  useEffect(() => {
    const androidDetected = /android/i.test(navigator.userAgent);
    setIsAndroid(androidDetected);
    
    // Mostrar tip de ayuda en Android después de un delay
    if (androidDetected) {
      const timer = setTimeout(() => setShowHelpTip(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Mantener historial de calidad para cálculo de promedio
  useEffect(() => {
    if (isMonitoring) {
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
    } else {
      setQualityHistory([]);
      setDisplayQuality(0);
    }
  }, [quality, isMonitoring]);

  // Calcular calidad promedio con más peso a valores recientes
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = index + 1; // Valores más recientes tienen más peso
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Suavizar cambios con animación
    setDisplayQuality(prev => {
      const delta = (averageQuality - prev) * 0.3;
      return Math.round(prev + delta);
    });
  }, [qualityHistory]);

  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 65) return '#00ff00'; // Umbral reducido para Android
    if (q > 40) return '#ffff00'; // Umbral reducido para Android
    return '#ff0000';
  };

  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 65) return 'Excelente';
    if (q > 40) return 'Buena';
    return 'Baja';
  };

  // Efecto de pulso más notable para Android
  const pulseStyle = displayQuality > 0 
    ? isAndroid ? "animate-pulse transition-all duration-500" : "animate-pulse transition-all duration-300" 
    : "transition-all duration-300";

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-7mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${pulseStyle}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`
          }}
        >
          <span className="text-[10px] font-bold text-white">{displayQuality}%</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-semibold text-white/90">Calidad de Señal</span>
            <span 
              className="text-[10px] font-medium"
              style={{ color: getQualityColor(displayQuality) }}
            >
              {getQualityText(displayQuality)}
            </span>
          </div>

          <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{
                width: `${displayQuality}%`,
                backgroundColor: getQualityColor(displayQuality)
              }}
            />
          </div>
        </div>
      </div>
      
      {isAndroid && showHelpTip && displayQuality < 30 && (
        <div className="absolute -bottom-20 left-0 right-0 bg-black/70 p-2 rounded text-white text-xs flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <span>
            Asegure que su dedo cubra completamente la cámara y la luz de flash. 
            Presione firmemente.
          </span>
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
