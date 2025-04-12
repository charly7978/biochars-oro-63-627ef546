import { HeartBeatConfig } from './heart-beat/config';
// import { HeartbeatAudioManager } from './heart-beat/audio-manager'; // Mantenido comentado si PPGSignalMeter lo maneja
// Eliminar importaciones de filtros antiguos
// import { applyFilterPipeline } from './heart-beat/signal-filters';
import { detectPeak, confirmPeak } from './heart-beat/peak-detector';
import { updateBPMHistory, calculateCurrentBPM, smoothBPM, calculateFinalBPM } from './heart-beat/bpm-calculator';
// Importar filtros consolidados
import { applyMedianFilter, applyMovingAverageFilter, applyEMAFilter, applyFilterPipeline } from '@/core/filters/signalFilters';
import { HeartBeatResult, RRIntervalData } from '@/core/types'; // Asegurar que usa el tipo unificado (se hará en paso 4)

export class HeartBeatProcessor {
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.60;
  MIN_CONFIDENCE = 0.50;
  DERIVATIVE_THRESHOLD = -0.03;
  MIN_PEAK_TIME_MS = 300; // Reducido para permitir detección más frecuente
  WARMUP_TIME_MS = 2000; // Reducido para comenzar antes

  MEDIAN_FILTER_WINDOW = 3;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.3;
  BASELINE_FACTOR = 0.995;

  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 80; // Ligeramente más corto para respuesta más rápida
  BEEP_VOLUME = 0.8; // Aumentado para mejor audibilidad
  MIN_BEEP_INTERVAL_MS = 250; // Reducido para permitir beeps más frecuentes

  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 10;
  lowSignalCount = 0;

  // Banderas para sincronización forzada
  FORCE_IMMEDIATE_BEEP = true; // Nueva bandera para forzar beeps inmediatos
  SKIP_TIMING_VALIDATION = true; // Omitir validaciones que puedan retrasar beeps
  
  // Variable para controlar el estado de monitoreo
  private isMonitoring = false;

  signalBuffer = [];
  medianBuffer: number[] = [];
  movingAverageBuffer: number[] = [];
  smoothedValue: number = 0;
  audioContext = null;
  lastBeepTime = 0;
  lastPeakTime = null;
  previousPeakTime = null;
  bpmHistory = [];
  baseline = 0;
  lastValue = 0;
  values = [];
  startTime = 0;
  peakConfirmationBuffer = [];
  lastConfirmedPeak = false;
  smoothBPM = 0;
  BPM_ALPHA = 0.2;
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  rrIntervals: number[] = [];
  emaValue: number = 0; // Para almacenar el valor EMA actualizado explícitamente

  constructor() {
    this.startTime = Date.now();
    // Inicializar audioManager si es necesario (pero probablemente manejado por PPGSignalMeter)
    console.log("HeartBeatProcessor.ts initialized (Real Data Only)");
    this.reset(); // Asegura estado inicial limpio
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

  async playBeep(volume = this.BEEP_VOLUME) {
    // Si no está en modo de monitoreo, no reproducir beeps
    if (!this.isMonitoring) return false;
    
    // Si estamos en el período de calentamiento, no reproducir beeps
    if (this.isInWarmup()) return false;
    
    // Verificación básica de intervalo para evitar beeps demasiado frecuentes
    const now = Date.now();
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

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
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Configuración de tono secundario
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.BEEP_SECONDARY_FREQUENCY,
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
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envolvente de amplitud para tono secundario
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.4, // Volumen reducido para el secundario
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conecta osciladores y ganancias
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Inicia y detiene los osciladores con timing preciso
      primaryOscillator.start(this.audioContext.currentTime);
      secondaryOscillator.start(this.audioContext.currentTime);
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);

      // Actualiza el tiempo del último beep
      this.lastBeepTime = now;
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
      return false;
    }
  }

  isInWarmup() {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  // --- Métodos de filtro individuales (ahora usan las funciones consolidadas) ---
  private applyMedianFilter(value: number): number {
      const { filteredValue, updatedBuffer } = applyMedianFilter(value, this.medianBuffer, this.MEDIAN_FILTER_WINDOW);
      this.medianBuffer = updatedBuffer;
      return filteredValue;
  }

  private applyMovingAverageFilter(value: number): number {
      const { filteredValue, updatedBuffer } = applyMovingAverageFilter(value, this.movingAverageBuffer, this.MOVING_AVERAGE_WINDOW);
      this.movingAverageBuffer = updatedBuffer;
      return filteredValue;
  }

  private applyEMAFilter(value: number): number {
      this.emaValue = applyEMAFilter(value, this.emaValue, this.EMA_ALPHA);
      return this.emaValue;
  }
  // --- Fin Métodos de filtro individuales ---

  processSignal(value: number): HeartBeatResult { // Usar tipo unificado
    if (!this.isMonitoring || typeof value !== 'number' || isNaN(value)) {
      return { bpm: 0, confidence: 0, isPeak: false, arrhythmiaCount: this.arrhythmiaCounter };
    }

    const currentTime = Date.now();

    // Low signal check remains the same
    if (Math.abs(value) < this.LOW_SIGNAL_THRESHOLD) {
        this.lowSignalCount++;
        if (this.lowSignalCount > this.LOW_SIGNAL_FRAMES) {
            // console.warn("HeartBeatProcessor.ts: Low signal detected consistently.");
            this.autoResetIfSignalIsLow(0); // Consider reset on low signal
            return { bpm: -1, confidence: 0, isPeak: false, arrhythmiaCount: this.arrhythmiaCounter, lowSignal: true };
        }
    } else {
        this.lowSignalCount = 0; // Reset counter on good signal
    }


    // Aplicar la pipeline de filtros consolidada
    const {
        filteredValue: finalFilteredValue,
        updatedMedianBuffer,
        updatedMovingAvgBuffer,
        updatedEmaValue
    } = applyFilterPipeline(
        value,
        this.medianBuffer,
        this.movingAverageBuffer,
        this.emaValue, // Pasar el EMA anterior almacenado
        {
            medianWindowSize: this.MEDIAN_FILTER_WINDOW,
            movingAvgWindowSize: this.MOVING_AVERAGE_WINDOW,
            emaAlpha: this.EMA_ALPHA
        }
    );

    // Actualizar buffers y valor EMA
    this.medianBuffer = updatedMedianBuffer;
    this.movingAverageBuffer = updatedMovingAvgBuffer;
    this.emaValue = updatedEmaValue; // Actualizar EMA para el próximo ciclo


    // Update baseline based on the final filtered value
    this.baseline = this.baseline * this.BASELINE_FACTOR + finalFilteredValue * (1 - this.BASELINE_FACTOR);
    const normalizedValue = finalFilteredValue - this.baseline;
    const derivative = finalFilteredValue - this.lastValue;
    this.lastValue = finalFilteredValue; // Store the *filtered* value as lastValue for derivative calculation

    // Add normalized value to buffer for analysis
    this.signalBuffer.push(normalizedValue);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Warmup period check
    if (this.isInWarmup()) {
        this.resetDetectionStates();
        return { bpm: 0, confidence: 0, isPeak: false, filteredValue: finalFilteredValue, arrhythmiaCount: this.arrhythmiaCounter };
    }

    // Detect peak based on *normalized* signal characteristics
    const { isPeak, confidence } = this.detectPeak(normalizedValue, derivative);

    // Confirm peak remains the same
    const { isConfirmedPeak, updatedBuffer, updatedLastConfirmedPeak } = this.confirmPeak(
      isPeak,
      normalizedValue, // Confirm based on normalized value
      confidence
    );
    this.peakConfirmationBuffer = updatedBuffer;
    this.lastConfirmedPeak = updatedLastConfirmedPeak;

    let currentBPM = 0;
    let finalConfidence = isConfirmedPeak ? confidence : 0;

    if (isConfirmedPeak) {
      this.updateBPM(currentTime); // Actualiza previousPeakTime, lastPeakTime, bpmHistory
      currentBPM = this.calculateCurrentBPM();
      this.smoothBPM = smoothBPM(currentBPM, this.smoothBPM, this.BPM_ALPHA);

      // Beep logic remains the same - likely handled by PPGSignalMeter based on isPeak
      // this.playBeep();

    } else {
      // Gradually decrease confidence if no peak detected
      const avgConfidenceInBuffer = this.peakConfirmationBuffer.length > 0
        ? this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / this.peakConfirmationBuffer.length
        : 0;
       finalConfidence = Math.max(0, avgConfidenceInBuffer - 0.05); // Slower decay

      // Use last smoothed BPM if valid, otherwise clamp to min/max or 0
       currentBPM = this.smoothBPM > 0 ? this.smoothBPM : 0;
    }

    // Final BPM calculation and clamping
    const finalBPM = this.getFinalBPM(); // Uses bpmHistory internally

    // Reset if signal amplitude is too low for too long
    const amplitude = this.signalBuffer.length > 1 ? Math.max(...this.signalBuffer) - Math.min(...this.signalBuffer) : 0;
    this.autoResetIfSignalIsLow(amplitude);


    const result: HeartBeatResult = { // Use type unificado
      bpm: finalBPM,
      confidence: Math.min(1, Math.max(0, finalConfidence)), // Ensure confidence is [0, 1]
      isPeak: isConfirmedPeak,
      filteredValue: finalFilteredValue, // Return the final filtered value
      arrhythmiaCount: this.arrhythmiaCounter,
      rrData: this.getRRIntervals(), // Include RR data
    };

    return result;
  }

  // --- detectPeak, confirmPeak, updateBPM, calculateCurrentBPM, getSmoothBPM, getFinalBPM, reset, getRRIntervals, etc. ---
  // (Estas funciones internas permanecen mayormente iguales, asegurándose de que usan los valores correctos:
  //  - detectPeak usa normalizedValue y derivative calculados con finalFilteredValue
  //  - confirmPeak usa normalizedValue
  //  - updateBPM, calculateCurrentBPM, getFinalBPM usan this.bpmHistory
  //  - getRRIntervals usa this.rrIntervals o lo calcula desde bpmHistory)

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    // Simplified logic example (real logic might be more complex)
    let isPeak = false;
    let confidence = 0;
    const currentTime = Date.now();

    // Check if it's above threshold and derivative is changing sign (simple peak condition)
    if (normalizedValue > this.SIGNAL_THRESHOLD && derivative < this.DERIVATIVE_THRESHOLD && this.lastValue > normalizedValue) {
        if (!this.lastPeakTime || (currentTime - this.lastPeakTime > this.MIN_PEAK_TIME_MS)) {
             isPeak = true;
            // Confidence based on how much it exceeds threshold and time since last peak
            confidence = Math.min(1, (normalizedValue / this.SIGNAL_THRESHOLD) * 0.5 + 0.5);
        }
    }

    // Reset candidate if conditions aren't met consistently
    if (!isPeak) {
        // Reset logic if needed
    }

    return { isPeak, confidence };
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    // Check if amplitude is consistently low
    // If so, call this.reset()
  }

  private resetDetectionStates() {
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    // Reset other relevant states if needed
  }


  confirmPeak(isPeak: boolean, normalizedValue: number, confidence: number): {
    isConfirmedPeak: boolean;
    updatedBuffer: number[];
    updatedLastConfirmedPeak: boolean;
  } {
    const updatedBuffer = [...this.peakConfirmationBuffer];
    // Buffer confidence values or just boolean flags
    updatedBuffer.push(isPeak ? confidence : 0); // Store confidence if peak, 0 otherwise
    if (updatedBuffer.length > 5) { // Example buffer size
      updatedBuffer.shift();
    }

    // Require a certain number of positive detections or high average confidence
    const positiveDetections = updatedBuffer.filter(c => c > 0).length;
    const averageConfidence = updatedBuffer.length > 0 ? updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length : 0;

    // Confirmation logic (example: needs 3/5 positive or high avg confidence)
    const isConfirmedPeak = (positiveDetections >= 3 || averageConfidence > this.MIN_CONFIDENCE) && isPeak;

    return {
      isConfirmedPeak,
      updatedBuffer,
      updatedLastConfirmedPeak: isConfirmedPeak, // Update based on current confirmation
    };
  }

  private updateBPM(currentTime: number): void {
    if (this.lastPeakTime !== null) {
      this.previousPeakTime = this.lastPeakTime;
      const interval = currentTime - this.lastPeakTime;
      if (interval > 0) {
        const currentInstantBPM = 60000 / interval;
         if (currentInstantBPM >= this.MIN_BPM && currentInstantBPM <= this.MAX_BPM) {
             // Store interval instead of BPM for RR analysis?
             this.rrIntervals.push(interval);
             if (this.rrIntervals.length > 10) this.rrIntervals.shift(); // Limit size

             this.bpmHistory.push(currentInstantBPM);
             if (this.bpmHistory.length > 10) { // Limit history size
                 this.bpmHistory.shift();
             }
         }
      }
    }
    this.lastPeakTime = currentTime;
  }


    private getSmoothBPM(): number {
        // Use the smoothed BPM value directly
        return this.smoothBPM;
    }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length === 0) {
      return 0;
    }
    // Calculate average of recent valid BPMs
    const sum = this.bpmHistory.reduce((a, b) => a + b, 0);
    return sum / this.bpmHistory.length;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length === 0) return 0;

    // Use a more robust method like median or trimmed mean of bpmHistory
    const sortedBPM = [...this.bpmHistory].sort((a, b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    let finalBPMCalc = 0;
    if (sortedBPM.length % 2 === 0 && sortedBPM.length > 0) {
        finalBPMCalc = (sortedBPM[mid - 1] + sortedBPM[mid]) / 2;
    } else if (sortedBPM.length > 0) {
        finalBPMCalc = sortedBPM[mid];
    }

     // Apply smoothing to the median/calculated BPM
    this.smoothBPM = smoothBPM(finalBPMCalc, this.smoothBPM, this.BPM_ALPHA);


    // Clamp to physiological limits
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, Math.round(this.smoothBPM)));
  }

  reset() {
    console.log("HeartBeatProcessor.ts: Resetting state.");
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.smoothedValue = 0;
    this.emaValue = 0; // Reset EMA value
    this.lastBeepTime = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.bpmHistory = [];
    this.rrIntervals = []; // Reset RR intervals
    this.baseline = 0;
    this.lastValue = 0;
    this.values = [];
    this.startTime = Date.now();
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    // this.isMonitoring = false; // Don't reset monitoring status unless intended
    this.arrhythmiaCounter = 0;
    this.lowSignalCount = 0;

    // Reset audio manager if needed
    // if (this.audioManager && typeof this.audioManager.reset === 'function') {
    //   this.audioManager.reset();
    // }
  }

  getRRIntervals(): RRIntervalData { // Use type unificado
    return {
      intervals: [...this.rrIntervals], // Return a copy
      lastPeakTime: this.lastPeakTime
    };
  }
}
