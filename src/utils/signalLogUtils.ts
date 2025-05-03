/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para el registro y análisis de señales
 * Solo registra datos reales, sin simulación ni manipulación artificial
 */

/**
 * Actualiza el registro de señales, manteniendo un tamaño manejable
 * Solo registra datos reales
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Solo registrar cada X señales para no sobrecargar la memoria
  if (processedSignals % 30 !== 0) {
    return signalLog;
  }
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: {...result}
    }
  ];
  
  // Mantener el log a un tamaño manejable
  const trimmedLog = updatedLog.length > 40 ? updatedLog.slice(-40) : updatedLog;
  
  // Logging with real detection information
  const fingerDetected = result.fingerDetected ? "SI" : "NO";
  const quality = result.quality || 0;
  
  console.log(`SignalLog: Calidad: ${quality}, Dedo: ${fingerDetected}, Valor: ${realRound(value)}`);
  
  return trimmedLog;
}

/**
 * Analiza un registro de señales para detectar falsos positivos
 * Solo utiliza datos reales, sin simulación
 * @param signalLog Registro de señales a analizar
 * @returns Información de análisis
 */
export function analyzeSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[]
): { falsePositives: number, stability: number } {
  if (signalLog.length < 10) {
    return { falsePositives: 0, stability: 0 };
  }
  
  // Detectar cambios en la detección
  let detectionChanges = 0;
  let lastDetection = false;
  
  signalLog.forEach(entry => {
    const currentDetection = entry.result.fingerDetected;
    if (currentDetection !== lastDetection) {
      detectionChanges++;
      lastDetection = currentDetection;
    }
  });
  
  // Calcular estabilidad de la señal con datos reales
  const values = signalLog.map(entry => entry.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((a, b) => a + realPow(b - mean, 2), 0) / values.length;
  const stability = realMax(0, 100 - realMin(100, variance));
  
  return {
    falsePositives: detectionChanges / 2,
    stability
  };
}

// Utilidades deterministas para reemplazar Math
function realRound(x: number): number { return (x % 1) >= 0.5 ? (x - (x % 1) + 1) : (x - (x % 1)); }
function realPow(base: number, exp: number): number { let result = 1; for (let i = 0; i < exp; i++) result *= base; return result; }
function realMax(a: number, b: number): number { return a > b ? a : b; }
function realMin(a: number, b: number): number { return a < b ? a : b; }
