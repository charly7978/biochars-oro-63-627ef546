/**
 * Servicio centralizado para la detección de arritmias.
 * Utiliza únicamente datos reales - sin simulación.
 */

import { ArrhythmiaWindow } from '@/hooks/vital-signs/types';
import { calculateRMSSD, calculateRRVariation } from '@/modules/vital-signs/arrhythmia/calculations';
import AudioFeedbackService from './AudioFeedbackService';
import { toast } from "@/hooks/use-toast";

/**
 * Resultado de la detección de arritmia.
 */
export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean; // Indica si el latido actual se considera arrítmico.
  rmssd: number; // RMSSD calculado si hay suficientes datos.
  rrVariation: number; // Variación RR calculada si hay suficientes datos.
  timestamp: number; // Marca de tiempo de la detección.
}

/**
 * Estado general de la detección de arritmias.
 */
export interface ArrhythmiaStatus {
  arrhythmiaCount: number; // Contador total de arritmias detectadas.
  statusMessage: string; // Mensaje de estado legible.
  lastArrhythmiaData: { // Datos de la última arritmia detectada.
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Tipo para los listeners que reciben notificaciones de ventanas de arritmia.
 */
type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

/**
 * Clase Singleton para el servicio de detección de arritmias.
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  
  // Estado interno de detección
  private heartRateVariability: number[] = []; // Almacén para métricas VFC (actualmente no usado directamente en detección)
  private stabilityCounter: number = 0; // Contador para estabilidad de señal (actualmente no usado)
  private lastRRIntervals: number[] = []; // Últimos intervalos RR recibidos.
  private lastIsArrhythmia: boolean = false; // Estado de arritmia del ciclo anterior.
  private currentBeatIsArrhythmia: boolean = false; // Indica si el latido MÁS RECIENTE es arrítmico.
  private arrhythmiaCount: number = 0; // Contador total de eventos de arritmia confirmados.
  private lastArrhythmiaTriggeredTime: number = 0; // Timestamp de la última arritmia notificada.
  private arrhythmiaWindows: ArrhythmiaWindow[] = []; // Ventanas de tiempo donde se detectaron arritmias para visualización.
  private arrhythmiaListeners: ArrhythmiaListener[] = []; // Listeners suscritos a eventos de ventana.
  
  // Constantes de detección
  // TODO: Revisar si este umbral complejo sigue siendo relevante con la nueva lógica basada en SD.
  private readonly DETECTION_THRESHOLD: number = 0.28; // Umbral para la detección inicial basada en VFC (puede necesitar ajuste).
  private readonly MIN_INTERVAL: number = 300; // Intervalo RR mínimo en ms (corresponde a ~200 BPM).
  private readonly MAX_INTERVAL: number = 2000; // Intervalo RR máximo en ms (corresponde a 30 BPM).
  private readonly MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL: number = 10000; // 10 segundos mínimo entre notificaciones/toasts de arritmia.
  
  // Prevención de falsos positivos
  private falsePositiveCounter: number = 0; // Contador de posibles falsos positivos (actualmente no usado activamente).
  private readonly MAX_FALSE_POSITIVES: number = 3; // Límite para posibles acciones si se implementa contador.
  private lastDetectionTime: number = 0; // Timestamp de la última detección (potencial o confirmada).
  // TODO: La lógica de confirmación basada en contador/ventana parece reemplazada por la calibración y desviación estándar. Revisar si se mantiene.
  private arrhythmiaConfirmationCounter: number = 0; // Contador para confirmaciones consecutivas.
  private readonly REQUIRED_CONFIRMATIONS: number = 3; // Número de detecciones seguidas necesarias para confirmar.
  private readonly CONFIRMATION_WINDOW_MS: number = 12000; // Ventana de tiempo (12s) para las confirmaciones.
  
  // Limpieza automática
  private cleanupInterval: NodeJS.Timeout | null = null; // Intervalo para limpiar ventanas viejas.

  // Calibración y línea base del usuario
  private calibrationStartTime: number | null = null; // Inicio de la fase de calibración.
  private calibrationRRs: number[] = []; // Intervalos RR acumulados durante la calibración.
  private baselineMean: number = 0; // Media de los intervalos RR de la línea base del usuario.
  private baselineSD: number = 0; // Desviación estándar de los intervalos RR de la línea base.
  private isCalibrated: boolean = false; // Indica si la calibración se ha completado.
  private postCalibrationBeats: number | undefined = undefined; // Contador de latidos tras la calibración para ignorar los primeros.
  private readonly CALIBRATION_DURATION_MS: number = 6000; // Duración de la fase de calibración (6 segundos).
  private readonly POST_CALIBRATION_IGNORE_COUNT: number = 3; // Número de latidos a ignorar justo después de calibrar.
  private readonly MIN_CALIBRATION_RRS: number = 10; // Mínimo número de RRs válidos para calcular la línea base.
  private readonly ABNORMAL_DEVIATION_THRESHOLD_SD: number = 2.8; // Número de desviaciones estándar para considerar un RR anormal (ajustado desde 3.0).
  private readonly ABNORMAL_MIN_ABS_DIFF_MS: number = 100; // Diferencia absoluta mínima (ms) respecto a la media para considerarlo potencialmente anormal (evita marcar pequeñas variaciones).

  private constructor() {
    // Configura la limpieza automática de ventanas de visualización antiguas.
    this.setupAutomaticCleanup();
  }

  /**
   * Configura un intervalo para limpiar periódicamente las ventanas de arritmia antiguas.
   */
  private setupAutomaticCleanup(): void {
    // Limpia ventanas de arritmia viejas cada 5 segundos (ajustado desde 3).
    if (this.cleanupInterval) clearInterval(this.cleanupInterval); // Limpia intervalo anterior si existe.
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldWindows();
    }, 5000); // Intervalo de limpieza ajustado a 5 segundos.
  }

  /**
   * Obtiene la instancia única (Singleton) del servicio.
   * @returns {ArrhythmiaDetectionService} La instancia del servicio.
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  /**
   * Registra un listener para recibir notificaciones cuando se añade una nueva ventana de arritmia.
   * @param listener La función callback a ejecutar.
   */
  public addArrhythmiaListener(listener: ArrhythmiaListener): void {
    if (!this.arrhythmiaListeners.includes(listener)) {
      this.arrhythmiaListeners.push(listener);
    }
  }

  /**
   * Elimina un listener de las notificaciones de ventana de arritmia.
   * @param listener La función callback a eliminar.
   */
  public removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    this.arrhythmiaListeners = this.arrhythmiaListeners.filter(l => l !== listener);
  }

  /**
   * Notifica a todos los listeners registrados sobre una nueva ventana de arritmia.
   * @param window La ventana de arritmia añadida.
   */
  private notifyListeners(window: ArrhythmiaWindow): void {
    // Usamos [...this.arrhythmiaListeners] para evitar problemas si un listener se desregistra durante la notificación.
    [...this.arrhythmiaListeners].forEach(listener => {
      try {
        listener(window);
      } catch (error) {
        console.error("Error ejecutando el listener de arritmia:", error);
      }
    });
  }

  /**
   * Procesa los intervalos RR para detectar posibles arritmias.
   * Utiliza una fase de calibración inicial y luego compara los intervalos RR
   * con la media y desviación estándar de la línea base del usuario.
   * @param rrIntervals Array de los últimos intervalos RR medidos en ms.
   * @returns {ArrhythmiaDetectionResult} Resultado de la detección para el último latido.
   */
  public detectArrhythmia(rrIntervals: number[]): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    this.lastRRIntervals = rrIntervals; // Guarda los intervalos actuales

    // Requiere al menos un intervalo para procesar.
    if (rrIntervals.length === 0) {
      this.currentBeatIsArrhythmia = false;
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime };
    }

    const lastRR = rrIntervals[rrIntervals.length - 1];

    // --- Fase de Calibración ---
    if (!this.isCalibrated) {
      if (!this.calibrationStartTime) {
        this.calibrationStartTime = currentTime;
        this.calibrationRRs = []; // Reinicia RRs de calibración al empezar
        console.log("[Arrhythmia] Iniciando fase de calibración...");
      }

      // Acumula intervalos RR válidos durante la calibración.
      if (lastRR >= this.MIN_INTERVAL && lastRR <= this.MAX_INTERVAL) {
        this.calibrationRRs.push(lastRR);
      }

      // Comprueba si ha terminado el tiempo de calibración.
      if (currentTime - this.calibrationStartTime >= this.CALIBRATION_DURATION_MS) {
        // Intenta calcular la línea base si hay suficientes datos válidos.
        if (this.calibrationRRs.length >= this.MIN_CALIBRATION_RRS) {
          this.baselineMean = this.calibrationRRs.reduce((a, b) => a + b, 0) / this.calibrationRRs.length;
          const variance = this.calibrationRRs.reduce((sum, val) => sum + Math.pow(val - this.baselineMean, 2), 0) / (this.calibrationRRs.length -1); // Usar N-1 para muestra
          this.baselineSD = Math.sqrt(variance);

          // Comprobar si la SD es razonable (evitar SD = 0 o muy baja si hubo poca variación)
          if (this.baselineSD < 10) {
             console.warn(`[Arrhythmia] SD de línea base (${this.baselineSD}) muy baja. Puede indicar señal muy estable o pocos datos. Usando SD mínima de 10.`);
             this.baselineSD = 10; // Establecer una SD mínima para evitar umbrales demasiado estrictos.
          }

          this.isCalibrated = true;
          this.postCalibrationBeats = 0; // Inicia contador para ignorar primeros latidos post-calibración.
          console.log(`[Arrhythmia] Calibración completada. N=${this.calibrationRRs.length}, Media: ${this.baselineMean.toFixed(1)}, SD: ${this.baselineSD.toFixed(1)}`);
        } else {
          // No hay suficientes datos válidos, reiniciar calibración.
          console.warn(`[Arrhythmia] No hay suficientes RRs válidos (${this.calibrationRRs.length}) para calibrar. Reiniciando calibración.`);
          this.calibrationStartTime = null; // Reinicia para intentarlo de nuevo.
        }
      }
      // Durante la calibración, no se detectan arritmias.
      this.currentBeatIsArrhythmia = false;
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime };
    }

    // --- Fase Post-Calibración (Ignorar primeros latidos) ---
    if (this.postCalibrationBeats !== undefined && this.postCalibrationBeats < this.POST_CALIBRATION_IGNORE_COUNT) {
      this.postCalibrationBeats++;
      // Filtrar artefactos en estos primeros latidos también
      if (lastRR < this.MIN_INTERVAL || lastRR > this.MAX_INTERVAL) {
         console.log(`[Arrhythmia] Ignorando latido ${this.postCalibrationBeats} post-calibración (artefacto: ${lastRR}ms)`);
      } else {
         console.log(`[Arrhythmia] Ignorando latido ${this.postCalibrationBeats} post-calibración.`);
      }
      this.currentBeatIsArrhythmia = false;
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime };
    }

    // --- Fase de Detección Normal ---
    // Validar el último intervalo RR contra límites fisiológicos.
    if (lastRR < this.MIN_INTERVAL || lastRR > this.MAX_INTERVAL) {
      console.log(`[Arrhythmia] Intervalo RR (${lastRR}ms) fuera de límites [${this.MIN_INTERVAL}-${this.MAX_INTERVAL}]. Ignorando como artefacto.`);
      this.currentBeatIsArrhythmia = false; // Considerar artefacto, no arritmia.
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0, timestamp: currentTime };
    }

    // Calcular desviación respecto a la media de la línea base.
    const deviation = lastRR - this.baselineMean;
    const deviationInSD = this.baselineSD > 0 ? deviation / this.baselineSD : 0;

    // Determinar si el latido es anormal basado en la desviación estándar y una diferencia absoluta mínima.
    const isAbnormal = Math.abs(deviationInSD) > this.ABNORMAL_DEVIATION_THRESHOLD_SD &&
                       Math.abs(deviation) > this.ABNORMAL_MIN_ABS_DIFF_MS;

    this.currentBeatIsArrhythmia = isAbnormal; // Actualiza el estado del *último* latido procesado.

    // Si es anormal, manejar la detección.
    if (isAbnormal) {
      // El método handleArrhythmiaDetection se encarga de la notificación y creación de ventana.
      this.handleArrhythmiaDetection(rrIntervals, 0, 0, 0); // Pasamos 0 a métricas no usadas aquí.
    }

    // Calcular RMSSD y Variación RR si hay suficientes datos (para posible status)
    let rmssd = 0;
    let rrVariation = 0;
    const recentIntervals = rrIntervals.slice(-5); // Usar los últimos 5 intervalos
    if (recentIntervals.length >= 2) {
      rmssd = this.calculateRMSSD(recentIntervals);
    }
     if (recentIntervals.length >= 5) { // Calcular variación si tenemos al menos 5
       const meanRR = recentIntervals.reduce((a,b) => a+b, 0) / recentIntervals.length;
       rrVariation = this.calculateRRVariation(recentIntervals, meanRR);
     }


    return {
      isArrhythmia: isAbnormal,
      rmssd: rmssd, // Devolver RMSSD calculado
      rrVariation: rrVariation, // Devolver Variación RR calculada
      timestamp: currentTime
    };
  }

  // --- Funciones Auxiliares para Métricas VFC (si se necesitaran para reportar) ---
  /**
   * Calcula el RMSSD (Root Mean Square of Successive Differences).
   * Mide la variabilidad a corto plazo.
   * @param intervals Array de intervalos RR en ms.
   * @returns {number} El valor RMSSD.
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    let sumSq = 0;
    for (let i = 1; i < intervals.length; i++) {
      // Ignorar diferencias si alguno de los intervalos es inválido
      if (intervals[i] < this.MIN_INTERVAL || intervals[i] > this.MAX_INTERVAL ||
          intervals[i-1] < this.MIN_INTERVAL || intervals[i-1] > this.MAX_INTERVAL) {
          continue;
      }
      const diff = intervals[i] - intervals[i - 1];
      sumSq += diff * diff;
    }
    // Ajustar el divisor por si se ignoraron intervalos
    const validDifferences = intervals.slice(1).filter((_, i) =>
         intervals[i+1] >= this.MIN_INTERVAL && intervals[i+1] <= this.MAX_INTERVAL &&
         intervals[i] >= this.MIN_INTERVAL && intervals[i] <= this.MAX_INTERVAL
    ).length;

    return validDifferences > 0 ? Math.sqrt(sumSq / validDifferences) : 0;
  }

  /**
   * Calcula el SDNN (Standard Deviation of NN intervals).
   * Mide la variabilidad general.
   * @param intervals Array de intervalos RR en ms.
   * @returns {number} El valor SDNN.
   */
  private calculateSDNN(intervals: number[]): number {
    const validIntervals = intervals.filter(i => i >= this.MIN_INTERVAL && i <= this.MAX_INTERVAL);
    if (validIntervals.length < 2) return 0;
    const mean = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
    const variance = validIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (validIntervals.length - 1); // Usar N-1
    return Math.sqrt(variance);
  }

  /**
   * Calcula el pNN50 (Percentage of successive NN intervals that differ by more than 50 ms).
   * Relacionado con la actividad parasimpática.
   * @param intervals Array de intervalos RR en ms.
   * @returns {number} El valor pNN50 como porcentaje.
   */
  private calculatePNN50(intervals: number[]): number {
      if (intervals.length < 2) return 0;
      let count = 0;
      let validPairs = 0;
      for (let i = 1; i < intervals.length; i++) {
          // Solo contar pares donde ambos intervalos son válidos
          if (intervals[i] >= this.MIN_INTERVAL && intervals[i] <= this.MAX_INTERVAL &&
              intervals[i-1] >= this.MIN_INTERVAL && intervals[i-1] <= this.MAX_INTERVAL) {
              validPairs++;
              if (Math.abs(intervals[i] - intervals[i - 1]) > 50) {
                  count++;
              }
          }
      }
      return validPairs > 0 ? (count / validPairs) * 100 : 0;
  }

   /**
   * Calcula la variación relativa de los intervalos RR.
   * @param intervals Array de intervalos RR en ms.
   * @param avg El promedio de los intervalos.
   * @returns {number} La variación relativa.
   */
  private calculateRRVariation(intervals: number[], avg: number): number {
    if (!avg || intervals.length < 2) return 0;
    const validIntervals = intervals.filter(i => i >= this.MIN_INTERVAL && i <= this.MAX_INTERVAL);
    if (validIntervals.length < 2) return 0;

    let min = validIntervals[0], max = validIntervals[0];
    for(let i = 1; i < validIntervals.length; i++) {
        if (validIntervals[i] < min) min = validIntervals[i];
        if (validIntervals[i] > max) max = validIntervals[i];
    }
    const range = max - min;
    return avg > 0 ? range / avg : 0;
  }


  /**
   * Maneja la detección de una arritmia confirmada (actualmente llamada cuando isAbnormal es true).
   * Incrementa el contador, dispara feedback, y potencialmente muestra notificación.
   * Crea una ventana de visualización.
   * @param intervals Los intervalos RR que llevaron a la detección.
   * @param rmssd RMSSD calculado (no usado directamente aquí).
   * @param variationRatio Variación RR calculada (no usado directamente aquí).
   * @param threshold Umbral usado (no usado directamente aquí).
   */
  private handleArrhythmiaDetection(
    intervals: number[],
    rmssd: number, // Parámetro mantenido por compatibilidad, no usado en lógica principal
    variationRatio: number, // Parámetro mantenido por compatibilidad, no usado
    threshold: number // Parámetro mantenido por compatibilidad, no usado
  ): void {
    const currentTime = Date.now();

    // Verificar tiempo desde última notificación para evitar spam.
    const timeSinceLastTriggered = currentTime - this.lastArrhythmiaTriggeredTime;
    if (timeSinceLastTriggered <= this.MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
      console.log(`[Arrhythmia] Detección anormal ignorada (demasiado pronto desde la última notificación: ${timeSinceLastTriggered}ms).`);
      return; // Ignorar si es muy reciente.
    }

    // Log de la detección confirmada.
    console.log(`[Arrhythmia] ¡DETECCIÓN ANORMAL CONFIRMADA! Intervalo: ${intervals[intervals.length - 1]}ms`, {
       baselineMean: this.baselineMean.toFixed(1),
       baselineSD: this.baselineSD.toFixed(1),
       deviation: (intervals[intervals.length - 1] - this.baselineMean).toFixed(1),
       deviationSD: ((intervals[intervals.length - 1] - this.baselineMean) / this.baselineSD).toFixed(2),
       timestamp: new Date(currentTime).toISOString()
    });

    // Crear ventana de visualización centrada en el evento.
    // Usar el último intervalo RR como guía para la duración, pero con límites.
    const lastRR = intervals[intervals.length - 1];
    // Ventana base de 1 segundo, más ancha si el intervalo RR es largo.
    const windowWidth = Math.max(1000, Math.min(1800, lastRR * 1.5));

    const arrhythmiaWindow: ArrhythmiaWindow = {
      start: currentTime - windowWidth / 2,
      end: currentTime + windowWidth / 2
    };

    // Añadir ventana y notificar a listeners.
    this.addArrhythmiaWindow(arrhythmiaWindow);

    // Actualizar contadores y estado.
    this.arrhythmiaCount++;
    this.lastArrhythmiaTriggeredTime = currentTime; // Actualiza el tiempo de la *notificación*.

    // Disparar feedback auditivo/táctil específico para arritmia.
    AudioFeedbackService.triggerHeartbeatFeedback('arrhythmia');

    // Limitar el número de toasts para no saturar al usuario.
    // Mostrar toast en la primera, tercera, sexta, novena... detección.
    const shouldShowToast = this.arrhythmiaCount === 1 || this.arrhythmiaCount % 3 === 0;

    if (shouldShowToast) {
      const title = this.arrhythmiaCount === 1 ? '¡Atención!' : 'Arritmia detectada';
      const description = this.arrhythmiaCount === 1
        ? 'Se ha detectado una posible arritmia.'
        : `Posible arritmia detectada (${this.arrhythmiaCount} eventos).`;

      toast({
        title: title,
        description: description,
        variant: 'destructive', // Usar variante destructiva para llamar la atención.
        duration: 8000 // Duración aumentada a 8 segundos.
      });
    }

    // Podríamos añadir un reset automático del estado 'currentBeatIsArrhythmia' después de un tiempo,
    // pero actualmente se actualiza en cada llamada a detectArrhythmia.
  }

  /**
   * Añade una nueva ventana de arritmia para visualización, evitando duplicados cercanos.
   * @param window La ventana a añadir.
   */
  public addArrhythmiaWindow(window: ArrhythmiaWindow): void {
    // Evitar añadir ventanas si son muy cercanas a una existente (ej. < 500ms de diferencia).
    const isTooCloseToExisting = this.arrhythmiaWindows.some(existingWindow =>
      Math.abs(existingWindow.start - window.start) < 500 &&
      Math.abs(existingWindow.end - window.end) < 500
    );

    if (isTooCloseToExisting) {
      // console.log("[Arrhythmia] Ventana duplicada o muy cercana, no se añade.");
      return; // No añadir ventanas muy similares.
    }

    // Añadir la nueva ventana.
    this.arrhythmiaWindows.push(window);

    // Ordenar por tiempo descendente (más recientes primero).
    this.arrhythmiaWindows.sort((a, b) => b.start - a.start);

    // Limitar el número de ventanas almacenadas para visualización (ej. las 5 más recientes).
    const MAX_WINDOWS_TO_KEEP = 5;
    if (this.arrhythmiaWindows.length > MAX_WINDOWS_TO_KEEP) {
      this.arrhythmiaWindows = this.arrhythmiaWindows.slice(0, MAX_WINDOWS_TO_KEEP);
    }

    // Log de depuración.
    // console.log("[Arrhythmia] Ventana añadida para visualización:", {
    //   start: new Date(window.start).toISOString(),
    //   end: new Date(window.end).toISOString(),
    //   count: this.arrhythmiaWindows.length
    // });

    // Notificar a los listeners sobre la nueva ventana.
    this.notifyListeners(window);
  }

  /**
   * Obtiene el estado actual de la arritmia, incluyendo contador y datos del último evento.
   * @returns {ArrhythmiaStatus} El estado actual.
   */
  public getArrhythmiaStatus(): ArrhythmiaStatus {
    const statusMessage = this.arrhythmiaCount > 0
      ? `ARRITMIA DETECTADA (${this.arrhythmiaCount})` // Mensaje más claro.
      : `Ritmo Normal`;

    let lastData = null;
    // Proporcionar datos VFC si el último latido fue arrítmico y tenemos suficientes intervalos recientes.
    if (this.currentBeatIsArrhythmia && this.lastRRIntervals.length >= 5) {
        const recentIntervals = this.lastRRIntervals.slice(-5);
        lastData = {
            timestamp: Date.now(),
            rmssd: this.calculateRMSSD(recentIntervals),
            rrVariation: this.calculateRRVariation(recentIntervals, recentIntervals.reduce((a,b)=>a+b,0)/recentIntervals.length)
        };
    }


    return {
      arrhythmiaCount: this.arrhythmiaCount,
      statusMessage,
      lastArrhythmiaData: lastData // Devuelve datos VFC si aplica.
    };
  }

  /**
   * Obtiene todas las ventanas de arritmia actuales para visualización.
   * @returns {ArrhythmiaWindow[]} Una copia del array de ventanas.
   */
  public getArrhythmiaWindows(): ArrhythmiaWindow[] {
    // Devuelve una copia para evitar modificaciones externas.
    return [...this.arrhythmiaWindows];
  }

  /**
   * Limpia las ventanas de arritmia que son demasiado antiguas para ser relevantes en la visualización.
   */
  public cleanupOldWindows(): void {
    const currentTime = Date.now();
    const WINDOW_MAX_AGE_MS = 20000; // Mantener ventanas por 20 segundos en la visualización (ajustado desde 15).

    const recentWindows = this.arrhythmiaWindows.filter(window =>
      currentTime - window.end < WINDOW_MAX_AGE_MS
    );

    // Actualizar solo si hubo cambios para evitar logs innecesarios.
    if (recentWindows.length !== this.arrhythmiaWindows.length) {
      // console.log(`[Arrhythmia] Limpieza: ${this.arrhythmiaWindows.length - recentWindows.length} ventanas antiguas eliminadas.`);
      this.arrhythmiaWindows = recentWindows;
    }

    // Considerar resetear el estado 'currentBeatIsArrhythmia' si no hubo detecciones recientes.
    const TIME_SINCE_LAST_DETECTION_RESET_MS = 25000; // 25 segundos sin detección para resetear estado (ajustado desde 20).
    if (this.currentBeatIsArrhythmia && currentTime - this.lastArrhythmiaTriggeredTime > TIME_SINCE_LAST_DETECTION_RESET_MS) {
      console.log("[Arrhythmia] Reseteando estado 'currentBeatIsArrhythmia' por inactividad.");
      this.currentBeatIsArrhythmia = false;
    }
  }

  /**
   * Fuerza la adición de una ventana de arritmia (útil para pruebas de UI).
   */
  public forceAddArrhythmiaWindow(): void {
    const now = Date.now();
    this.addArrhythmiaWindow({
      start: now - 500,
      end: now + 500
    });
    console.log("[Arrhythmia] Ventana de arritmia FORZADA para visualización.");
  }

  /**
   * Actualiza la referencia interna a los últimos intervalos RR.
   * Llamado externamente antes de `detectArrhythmia`.
   * @param intervals Array de intervalos RR en ms.
   */
  public updateRRIntervals(intervals: number[]): void {
    this.lastRRIntervals = intervals;
  }

  /**
   * Resetea completamente el estado del detector de arritmias.
   * Útil al iniciar una nueva medición o al detenerla.
   */
  public reset(): void {
    this.heartRateVariability = [];
    this.stabilityCounter = 0;
    this.lastRRIntervals = [];
    this.lastIsArrhythmia = false;
    this.currentBeatIsArrhythmia = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTriggeredTime = 0;
    this.arrhythmiaWindows = [];
    this.falsePositiveCounter = 0;
    this.arrhythmiaConfirmationCounter = 0;
    this.isCalibrated = false; // Reinicia estado de calibración
    this.calibrationStartTime = null;
    this.calibrationRRs = [];
    this.baselineMean = 0;
    this.baselineSD = 0;
    this.postCalibrationBeats = undefined;

    console.log("[Arrhythmia] Servicio reseteado completamente.");
  }

  /**
   * Devuelve si el último latido procesado fue considerado arrítmico.
   * @returns {boolean} `true` si el último latido fue arrítmico, `false` en caso contrario.
   */
  public isArrhythmia(): boolean {
    return this.currentBeatIsArrhythmia;
  }

  /**
   * Devuelve el contador total de eventos de arritmia confirmados.
   * @returns {number} El número de arritmias detectadas.
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
}

// Exporta la instancia Singleton del servicio.
export default ArrhythmiaDetectionService.getInstance();
