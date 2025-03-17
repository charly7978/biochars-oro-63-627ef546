
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
  
  // Constantes de configuración - ajustadas para mejor representación de la realidad 
  const historySize = 6; // Ventana más pequeña para respuesta más rápida
  const QUALITY_THRESHOLD = 65; // Umbral reducido para calidad considerada "buena"
  const MIN_QUALITY_FOR_DETECTION = 30; // Umbral mínimo reducido para detección válida
  const SIGNAL_STABILITY_THRESHOLD = 0.2; // Umbral de estabilidad ajustado

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
  // y aplicar validación más estricta para mejor representación de la realidad
  useEffect(() => {
    if (qualityHistory.length === 0) {
      setDisplayQuality(0);
      return;
    }

    // Ponderación con mayor peso a valores más recientes
    let weightedSum = 0;
    let totalWeight = 0;

    qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.2, index); // Valores más recientes tienen más peso
      weightedSum += q * weight;
      totalWeight += weight;
    });

    // Calcular media ponderada básica
    let averageQuality = Math.round(weightedSum / totalWeight);
    
    // Verificar estabilidad de la señal
    const variance = calculateVariance(qualityHistory);
    
    // Logging para depuración de varianza y estabilidad
    console.log("SignalQualityIndicator: Análisis de estabilidad", {
      variance,
      qualityHistory: qualityHistory.slice(-3),
      qualityAvg: averageQuality,
      threshold: 150
    });
    
    // Ajustar la calidad según la estabilidad (varianza) de la señal
    // Señal inestable = calidad reducida
    if (variance > 150) { 
      averageQuality = Math.round(averageQuality * 0.7);
    } else if (variance > 80) {
      averageQuality = Math.round(averageQuality * 0.85);
    }
    
    // Si la calidad es muy baja, no la reduzca aún más
    if (averageQuality < 20 && quality > 25) {
      averageQuality = 25; // Mantener un mínimo para señales débiles pero presentes
    }
    
    // Suavizar cambios para mejor UX
    setDisplayQuality(prev => {
      const delta = (averageQuality - prev) * 0.4; // Más peso a nuevos valores para actualización más rápida
      return Math.round(prev + delta);
    });

    // Emitir evento de señal válida cuando tenemos calidad suficiente
    if (averageQuality > MIN_QUALITY_FOR_DETECTION && isMonitoring) {
      const stabilityScore = 1 - (variance / 200);
      const eventDetail = { 
        quality: averageQuality,
        stable: variance < 150,
        variance,
        stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
        qualityHistory: qualityHistory.slice(-3),
        timestamp: Date.now()
      };
      
      // Emitir evento más frecuente cuando la calidad es buena 
      // para mantener mediciones actualizadas
      if (averageQuality > QUALITY_THRESHOLD || Math.random() < 0.3) {
        window.dispatchEvent(new CustomEvent('validSignalDetected', { 
          detail: eventDetail
        }));
        
        console.log("SignalQualityIndicator: Evento validSignalDetected emitido", eventDetail);
      }
    }
  }, [qualityHistory, isMonitoring]);

  // Calcular varianza para detección de estabilidad
  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  };

  /**
   * Obtiene el color basado en la calidad
   */
  const getQualityColor = (q: number) => {
    if (q === 0) return '#666666';
    if (q > 70) return '#00ff00';
    if (q > 50) return '#bfff00';
    if (q > 30) return '#ffff00';
    if (q > 15) return '#ffbf00';
    return '#ff0000';
  };

  /**
   * Obtiene el texto descriptivo de calidad
   */
  const getQualityText = (q: number) => {
    if (q === 0) return 'Sin Dedo';
    if (q > 70) return 'Excelente';
    if (q > 50) return 'Buena';
    if (q > 30) return 'Regular';
    if (q > 15) return 'Baja';
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
