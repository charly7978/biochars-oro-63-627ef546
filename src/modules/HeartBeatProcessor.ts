import { PeakDetector, RRData } from '@/core/signal/PeakDetector';
// Importamos los filtros y utilidades consolidadas
import { applyMedianFilter } from '@/core/signal/filters/medianFilter';
import { applySMAFilter } from '@/core/signal/filters/movingAverage';
import { calculateEMA } from '@/lib/utils';

// CONSTANTES (Extraídas para claridad, podrían ir a config.ts)
const SAMPLE_RATE = 30;
const WINDOW_SIZE = 60;
const MIN_BPM = 40;
const MAX_BPM = 200;
const MIN_CONFIDENCE = 0.50;
const MIN_PEAK_TIME_MS = 300;
const WARMUP_TIME_MS = 2000;
const MEDIAN_FILTER_WINDOW = 3;
const MOVING_AVERAGE_WINDOW = 5;
const EMA_ALPHA = 0.3;
const BASELINE_FACTOR = 0.995;
const BEEP_PRIMARY_FREQUENCY = 880;
const BEEP_SECONDARY_FREQUENCY = 440;
const BEEP_DURATION = 80;
const BEEP_VOLUME = 0.8;
const MIN_BEEP_INTERVAL_MS = 250;
const LOW_SIGNAL_THRESHOLD = 0.03;
const LOW_SIGNAL_FRAMES = 10;
const BPM_ALPHA = 0.2;
const RR_HISTORY_SIZE = 30;
const BPM_HISTORY_SIZE = 5;

export class HeartBeatProcessor {

  private isMonitoring = false;
  private peakDetector: PeakDetector;

  // Buffers y estado para filtros
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private prevEMA: number | null = null;

  // Estado de audio
  private audioContext: AudioContext | null = null;
  private lastBeepTime: number = 0;

  // Estado de BPM y picos
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private smoothBPM: number = 0;
  private startTime: number = 0;
  private rrIntervals: number[] = []; // Almacena los intervalos RR calculados

  // Estado de calidad de señal
  private baseline: number = 0;
  private lowSignalCount: number = 0;

  constructor() {
    this.peakDetector = new PeakDetector();
    this.initAudio();
    this.startTime = Date.now();
  }

  /**
   * Establece el estado de monitoreo del procesador
   * @param monitoring Verdadero para activar el monitoreo, falso para desactivarlo
   */
  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    console.log(`HeartBeatProcessor: Monitoring set to ${monitoring}`);
    
    // Si se activa el monitoreo, asegurarse que el audio esté iniciado
    if (monitoring && this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context", err);
      });
    }
  }

  /**
   * Obtiene el estado actual de monitoreo
   * @returns Verdadero si el monitoreo está activo
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  async initAudio() {
    try {
      // Inicializa o recupera el contexto de audio con baja latencia
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Siempre asegúrate de que el contexto esté en estado "running"
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Prepara el sistema de audio con un beep silencioso
        await this.playBeep(0.01);
        console.log("HeartBeatProcessor: Audio Context Initialized with low latency");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = BEEP_VOLUME): Promise<boolean> {
    if (!this.isMonitoring || this.isInWarmup()) return false;

    const now = Date.now();
    // Usar las constantes directamente
    // if (!SKIP_TIMING_VALIDATION && now - this.lastBeepTime < MIN_BEEP_INTERVAL_MS) {
    //   return false;
    // }

    try {
      // Asegúrate de que el contexto de audio esté disponible y activo
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
          return false;
        }
      }

      // Crea y configura osciladores para un sonido cardíaco más realista
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configuración de tono principal
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Configuración de tono secundario
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        BEEP_SECONDARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Envolvente de amplitud para tono principal (ataque rápido, decaimiento natural)
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + BEEP_DURATION / 1000
      );

      // Envolvente de amplitud para tono secundario
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.4, // Volumen reducido para el secundario
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + BEEP_DURATION / 1000
      );

      // Conecta osciladores y ganancias
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Inicia y detiene los osciladores con timing preciso
      primaryOscillator.start(this.audioContext.currentTime);
      secondaryOscillator.start(this.audioContext.currentTime);
      primaryOscillator.stop(this.audioContext.currentTime + BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(this.audioContext.currentTime + BEEP_DURATION / 1000 + 0.02);

      // Actualiza el tiempo del último beep
      this.lastBeepTime = now;
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
      return false;
    }
  }

  isInWarmup() {
    return Date.now() - this.startTime < WARMUP_TIME_MS;
  }

  // Los filtros ahora usan las funciones consolidadas y manejan estado interno
  private applyFilters(rawValue: number): number {
      const { filteredValue: medVal, updatedBuffer: newMedianBuffer } = applyMedianFilter(rawValue, this.medianBuffer, MEDIAN_FILTER_WINDOW);
      this.medianBuffer = newMedianBuffer;

      const { filteredValue: movAvgVal, updatedBuffer: newMovAvgBuffer } = applySMAFilter(medVal, this.movingAverageBuffer, MOVING_AVERAGE_WINDOW);
      this.movingAverageBuffer = newMovAvgBuffer;

      // Usamos calculateEMA directamente. Si prevEMA es null (primera vez), calculateEMA lo manejará.
      const emaFiltered = calculateEMA(movAvgVal, this.prevEMA === null ? movAvgVal : this.prevEMA, EMA_ALPHA);
      this.prevEMA = emaFiltered; // Actualizamos prevEMA para la próxima iteración

      this.smoothedValue = emaFiltered; // Guardamos el valor final filtrado
      return this.smoothedValue;
  }

  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean; // Indica si *este* punto fue un pico detectado
    filteredValue: number;
    arrhythmiaCount: number; // Mantenido por compatibilidad, pero la lógica se moverá
    rrData?: RRData; // Devolvemos los datos RR
  } {
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: 0, arrhythmiaCount: 0 };
    }

    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.initAudio();
    }

    const filtered = this.applyFilters(value);

    // Almacenar en buffer para análisis de picos
    this.signalBuffer.push(filtered);
    if (this.signalBuffer.length > WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Esperar suficientes datos
    if (this.signalBuffer.length < 30) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: filtered, arrhythmiaCount: 0 };
    }

    // Actualizar línea base y detectar señal baja
    this.baseline = this.baseline * BASELINE_FACTOR + filtered * (1 - BASELINE_FACTOR);
    const normalizedValue = filtered - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // --- Detección de Picos con PeakDetector --- 
    const peakResult = this.peakDetector.detectPeaks(this.signalBuffer);
    let currentFrameIsPeak = false;

    // Verificar si el *último* pico detectado corresponde al frame actual
    if (peakResult.peakIndices.length > 0) {
        const lastDetectedPeakIndexInBuffer = peakResult.peakIndices[peakResult.peakIndices.length - 1];
        // El índice del frame actual en signalBuffer es signalBuffer.length - 1
        if (lastDetectedPeakIndexInBuffer === this.signalBuffer.length - 1) {
            currentFrameIsPeak = true;
            // Intentar tocar beep si es un pico nuevo y ha pasado suficiente tiempo
            const now = Date.now();
            if (this.lastPeakTime === null || now - this.lastPeakTime > MIN_PEAK_TIME_MS) {
                // La confianza podría basarse en la calidad de la señal o la salida del detector
                const confidence = MIN_CONFIDENCE; // Usar un valor base por ahora
                if (now - this.lastBeepTime > MIN_BEEP_INTERVAL_MS) {
                    this.playBeep(confidence * BEEP_VOLUME);
                }
                this.previousPeakTime = this.lastPeakTime;
                this.lastPeakTime = now;
                this.updateBPMHistory(); // Actualizar historial de BPM basado en el nuevo intervalo
            }
        }
    }

    // Actualizar el array de intervalos RR local
    this.rrIntervals = peakResult.intervals;

    // Actualizar BPM suavizado independientemente de si el frame actual es pico
    this.smoothBPM = this.calculateSmoothedBPM();

    return {
      bpm: Math.round(this.getFinalBPM()),
      confidence: currentFrameIsPeak ? MIN_CONFIDENCE : 0, // Confianza solo si es pico
      isPeak: currentFrameIsPeak && !this.isInWarmup(),
      filteredValue: filtered,
      arrhythmiaCount: 0, // Lógica de arritmia se moverá
      rrData: {
          intervals: [...this.rrIntervals],
          lastPeakTime: this.lastPeakTime
      }
    };
  }

  autoResetIfSignalIsLow(amplitude: number): void {
    if (amplitude < LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates(): void {
    this.peakDetector.reset(); // Usar el reset del detector consolidado
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.bpmHistory = [];
    this.rrIntervals = [];
    this.smoothBPM = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  // Actualiza el historial de BPM basado en el último intervalo detectado
  private updateBPMHistory(): void {
    if (this.lastPeakTime === null || this.previousPeakTime === null) return;

    const currentInterval = this.lastPeakTime - this.previousPeakTime;
    if (currentInterval < 250 || currentInterval > 1500) return; // Validar intervalo

    const instantBPM = 60000 / currentInterval;
    this.bpmHistory.push(instantBPM);
    if (this.bpmHistory.length > BPM_HISTORY_SIZE) {
      this.bpmHistory.shift();
    }
  }

  // Calcula el BPM suavizado a partir del historial
  private calculateSmoothedBPM(): number {
    if (this.bpmHistory.length === 0) return 75;

    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    let validBPMs = this.bpmHistory;
    if (sortedBPMs.length >= 5) {
      validBPMs = sortedBPMs.slice(1, -1);
    }

    if (validBPMs.length === 0) return 75; // Evitar división por cero

    const sum = validBPMs.reduce((acc, val) => acc + val, 0);
    const averageBPM = sum / validBPMs.length;

    // Aplicar EMA para mayor suavidad
    const newSmoothBPM = this.smoothBPM === 0 ? averageBPM : (this.smoothBPM * (1 - BPM_ALPHA) + averageBPM * BPM_ALPHA);

    return Math.max(MIN_BPM, Math.min(MAX_BPM, newSmoothBPM));
  }

  public getFinalBPM(): number {
    if (this.isInWarmup() || this.bpmHistory.length < 3) return 75;

    const timeSinceLastPeak = this.lastPeakTime ? (Date.now() - this.lastPeakTime) : Infinity;
    if (timeSinceLastPeak > 3000) {
       // Deterioro gradual si no hay picos recientes
       const degradationFactor = Math.max(0, 1 - (timeSinceLastPeak - 3000) / 5000); // Reduce a 0 en 8s
       return Math.round(this.smoothBPM * degradationFactor + 75 * (1 - degradationFactor));
    }

    return Math.round(this.smoothBPM);
  }

  reset(): void {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.bpmHistory = [];
    this.rrIntervals = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.smoothedValue = 0;
    this.prevEMA = null;
    this.startTime = Date.now();
    this.lowSignalCount = 0;
    this.peakDetector.reset(); // Resetear el detector de picos

    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
     console.log("HeartBeatProcessor: Reset completed");
  }

  // Mantenemos getRRIntervals por compatibilidad si es necesario
  getRRIntervals(): RRData {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
}
