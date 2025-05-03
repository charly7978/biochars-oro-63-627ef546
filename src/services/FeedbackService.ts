
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Servicio para proporcionar retroalimentación a usuarios basada en eventos reales 
 * detectados en la señal biométrica. No usa simulaciones.
 */
export class FeedbackService {
  private static lastNotificationTime = 0;
  private static measurementEventListeners: Array<(event: string, data: any) => void> = [];

  /**
   * Notifica la detección de una arritmia real
   */
  public static signalArrhythmia(count: number): void {
    const now = Date.now();
    
    // Limitar la frecuencia de notificaciones (máximo una cada 10 segundos)
    if (now - FeedbackService.lastNotificationTime < 10000) {
      return;
    }
    
    FeedbackService.lastNotificationTime = now;
    
    // Notificar sobre el evento de arritmia real
    console.log(`FeedbackService: Arritmia detectada (conteo: ${count})`);
    
    // Enviar evento a los oyentes registrados
    FeedbackService.notifyListeners('arrhythmia_detected', { count });
  }
  
  /**
   * Notifica sobre la calidad de la señal
   */
  public static signalQuality(quality: number, isGood: boolean): void {
    // Solo notificar cambios significativos
    if (quality < 20 || (quality > 80 && !isGood)) {
      console.log(`FeedbackService: Calidad de señal ${isGood ? 'buena' : 'baja'} (${quality}%)`);
      
      // Enviar evento a los oyentes registrados
      FeedbackService.notifyListeners('signal_quality', { quality, isGood });
    }
  }

  /**
   * Recibe una alerta de medición anómala (presión, SpO2, etc)
   */
  public static abnormalMeasurement(type: string, value: number, threshold: number): void {
    const now = Date.now();
    
    // Limitar la frecuencia de notificaciones (máximo una cada 30 segundos)
    if (now - FeedbackService.lastNotificationTime < 30000) {
      return;
    }
    
    FeedbackService.lastNotificationTime = now;
    
    console.log(`FeedbackService: Medición anómala de ${type}: ${value} (umbral: ${threshold})`);
    
    // Enviar evento a los oyentes registrados
    FeedbackService.notifyListeners('abnormal_measurement', { type, value, threshold });
  }

  /**
   * Añadir oyente para eventos de medición
   */
  public static addMeasurementEventListener(listener: (event: string, data: any) => void): void {
    FeedbackService.measurementEventListeners.push(listener);
  }

  /**
   * Eliminar oyente para eventos de medición
   */
  public static removeMeasurementEventListener(listener: (event: string, data: any) => void): void {
    FeedbackService.measurementEventListeners = FeedbackService.measurementEventListeners.filter(
      l => l !== listener
    );
  }

  /**
   * Notificar a todos los oyentes registrados
   */
  private static notifyListeners(event: string, data: any): void {
    for (const listener of FeedbackService.measurementEventListeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error en oyente de FeedbackService:', error);
      }
    }
  }
}

export default FeedbackService;
