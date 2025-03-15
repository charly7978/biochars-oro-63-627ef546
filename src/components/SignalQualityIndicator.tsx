
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal PPG
 * Incluye detección específica para Android y consejos de ayuda
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  
  // Constantes de configuración
  const historySize = 5; // Ventana de historial para promedio
  const REQUIRED_FINGER_FRAMES = 8;
  const QUALITY_THRESHOLD = 50;

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

  // Mantener historial de calidad para promedio
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

  // Calcular calidad ponderada con más peso a valores recientes
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
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (averageQuality - prev) * 0.3;
      return Math.round(prev + delta);
    });
    
    // Registrar cambios de calidad para depuración
    console.log("SignalQualityIndicator: Calidad actualizada", {
      nuevaCalidad: averageQuality,
      calidadMostrada: Math.round(displayQuality + (averageQuality - displayQuality) * 0.3),
      historicoCalidad: [...qualityHistory],
      timestamp: new Date().toISOString()
    });
  }, [qualityHistory]);

  /**
   * Obtiene el color basado en la calidad real (ahora más preciso)
   */
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 70) return '#10b981'; // Verde más saturado
    if (q > 50) return '#22c55e'; // Verde normal 
    if (q > 30) return '#eab308'; // Amarillo
    if (q > 10) return '#f97316'; // Naranja
    return '#ef4444';             // Rojo
  };

  /**
   * Obtiene el texto descriptivo de calidad con umbral más preciso
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 70) return 'Excelente';
    if (q > 50) return 'Buena';
    if (q > 30) return 'Aceptable';
    if (q > 10) return 'Baja';
    return 'Muy Baja';
  };

  // Efecto de pulso adaptado a la plataforma
  const pulseStyle = displayQuality > 0 
    ? isAndroid ? "animate-pulse transition-all duration-500" : "animate-pulse transition-all duration-300" 
    : "transition-all duration-300";

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-9mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${pulseStyle}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`
          }}
        >
          <span className="text-[9px] font-bold text-white">{displayQuality}%</span>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-semibold text-white/90">Calidad de Señal</span>
            <span 
              className="text-[9px] font-medium"
              style={{ color: getQualityColor(displayQuality) }}
            >
              {getQualityText(displayQuality)}
            </span>
          </div>

          <div className="w-full h-0.5 bg-gray-700/50 rounded-full overflow-hidden">
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
      
      {/* Consejos de ayuda específicos para Android */}
      {isAndroid && showHelpTip && displayQuality < QUALITY_THRESHOLD && (
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
