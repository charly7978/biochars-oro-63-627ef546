
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface SignalQualityIndicatorProps {
  quality: number;
  isMonitoring?: boolean;
}

/**
 * Componente que muestra la calidad de la señal basada en las mediciones reales
 * de signos vitales como glucosa, oxígeno y colesterol.
 */
const SignalQualityIndicator = ({ quality, isMonitoring = false }: SignalQualityIndicatorProps) => {
  // Estado local
  const [displayQuality, setDisplayQuality] = useState(0);
  const [qualityHistory, setQualityHistory] = useState<number[]>([]);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showHelpTip, setShowHelpTip] = useState(false);
  const [suspiciousPattern, setSuspiciousPattern] = useState(false);
  const [falsePositiveDetected, setFalsePositiveDetected] = useState(false);
  
  // Referencias para evitar bucles de actualización infinitos
  const qualityRef = useRef(quality);
  const displayQualityRef = useRef(displayQuality);
  
  // Constantes para mejor detección de calidad desde signos vitales
  const historySize = 10;
  const QUALITY_STABILIZATION_FACTOR = 0.3; // Reducido para actualizaciones más rápidas
  
  // Console log para debugging - usando refs para evitar bucles infinitos
  useEffect(() => {
    console.log("SignalQualityIndicator: Received quality value: ", quality);
    console.log("SignalQualityIndicator: Current display quality: ", displayQuality);
    console.log("SignalQualityIndicator: Monitoring status: ", isMonitoring);
    
    // Actualizar las referencias
    qualityRef.current = quality;
  }, [quality, displayQuality, isMonitoring]);
  
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

  // Mantener historial de calidad para un promedio más estable
  useEffect(() => {
    if (isMonitoring) {
      // Actualizar historial de calidad con el valor que viene directamente
      // de las mediciones de los signos vitales
      setQualityHistory(prev => {
        const newHistory = [...prev, quality];
        return newHistory.slice(-historySize);
      });
      
      // Detectar patrones sospechosos (valores idénticos consecutivos)
      if (qualityHistory.length >= 3) {
        const last3Values = qualityHistory.slice(-3);
        const allIdentical = last3Values.every(q => q === last3Values[0]);
        const allPerfect = last3Values.every(q => q > 95);
        
        if ((allIdentical && quality > 0) || allPerfect) {
          console.log("SignalQualityIndicator: Suspicious pattern detected");
          setSuspiciousPattern(true);
          setFalsePositiveDetected(true);
          setTimeout(() => {
            setFalsePositiveDetected(false);
            setSuspiciousPattern(false);
          }, 5000);
        } else {
          setSuspiciousPattern(false);
          setFalsePositiveDetected(false);
        }
      }
    } else {
      // Reset all states when not monitoring
      setQualityHistory([]);
      setDisplayQuality(0);
      setSuspiciousPattern(false);
      setFalsePositiveDetected(false);
    }
  }, [quality, isMonitoring, qualityHistory]);

  // Calcular calidad ponderada y suavizada para la visualización
  useEffect(() => {
    if (qualityHistory.length === 0 || !isMonitoring) {
      setDisplayQuality(0);
      return;
    }

    // Usar media ponderada con mayor peso en valores recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.5, index);
      weightedSum += q * weight;
      totalWeight += weight;
    });

    const weightedAverage = Math.round(weightedSum / totalWeight);
    
    // Si se detecta patrón sospechoso, limitar la calidad mostrada
    const finalQuality = suspiciousPattern ? Math.min(40, weightedAverage) : weightedAverage;
    
    // Transición suave para mejor UX
    setDisplayQuality(prev => {
      const delta = (finalQuality - prev) * QUALITY_STABILIZATION_FACTOR;
      return Math.round(prev + delta);
    });
    
    // Actualizar referencia para evitar bucles
    displayQualityRef.current = displayQuality;

    console.log("SignalQualityIndicator: Calculated quality metrics", {
      weightedAverage,
      finalQuality,
      suspiciousPattern,
      historyLength: qualityHistory.length
    });

  }, [qualityHistory, isMonitoring, suspiciousPattern]);

  /**
   * Obtiene el color basado en la calidad con niveles intermedios más definidos
   */
  const getQualityColor = (q: number) => {
    if (falsePositiveDetected || suspiciousPattern) return '#ff6b6b';
    if (q === 0) return '#666666';
    if (q > 75) return '#00ff00';
    if (q > 60) return '#bfff00';
    if (q > 45) return '#ffff00';
    if (q > 30) return '#ffbf00';
    if (q > 15) return '#ff8000';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad con más niveles intermedios
   */
  const getQualityText = (q: number) => {
    if (falsePositiveDetected) return 'Falso Positivo';
    if (suspiciousPattern) return 'Patrón Sospechoso';
    if (q === 0) return 'Sin Dedo';
    if (q > 75) return 'Excelente';
    if (q > 60) return 'Muy Buena';
    if (q > 45) return 'Buena';
    if (q > 30) return 'Regular';
    if (q > 15) return 'Baja';
    return 'Muy Baja';
  };

  // Efecto de pulso adaptado a la plataforma y calidad
  const pulseStyle = displayQuality > 0 
    ? isAndroid 
      ? `animate-pulse transition-all duration-${500 - Math.min(400, displayQuality * 3)}`
      : `animate-pulse transition-all duration-${400 - Math.min(300, displayQuality * 2)}`
    : "transition-all duration-300";

  return (
    <div className="bg-black/30 backdrop-blur-md rounded p-1 w-full relative" style={{ marginTop: "-9mm" }}>
      <div className="flex items-center gap-1">
        <div 
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${pulseStyle}`}
          style={{
            borderColor: getQualityColor(displayQuality),
            backgroundColor: `${getQualityColor(displayQuality)}33`,
            opacity: Math.max(0.3, Math.min(1, displayQuality / 100))
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
      
      {/* Mensajes de ayuda más específicos */}
      {showHelpTip && displayQuality < 60 && (
        <div className="absolute -bottom-20 left-0 right-0 bg-black/70 p-2 rounded text-white text-xs flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          {suspiciousPattern ? (
            <span>Posible falso positivo detectado. Reajuste la posición del dedo.</span>
          ) : displayQuality === 0 ? (
            <span>Coloque su dedo cubriendo completamente la cámara y la luz de flash.</span>
          ) : displayQuality < 30 ? (
            <span>Presione firmemente y mantenga el dedo quieto. Ajuste la posición.</span>
          ) : (
            <span>Mantenga el dedo firme y evite movimientos para mejorar la medición.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default SignalQualityIndicator;
