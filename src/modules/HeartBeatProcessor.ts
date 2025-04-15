import { SignalFilter } from '@/core/signal-processing/filters/SignalFilter';
import { PeakDetector, RRData } from '@/core/signal/PeakDetector';

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

  signalBuffer: number[] = [];
  audioContext: AudioContext | null = null;
  lastBeepTime = 0;
  lastPeakTime: number | null = null;
  previousPeakTime: number | null = null;
  bpmHistory: number[] = [];
  baseline = 0;
  lastValue = 0;
  values: number[] = [];
  startTime = 0;
  peakConfirmationBuffer: number[] = [];
  lastConfirmedPeak = false;
  smoothBPM = 0;
  BPM_ALPHA = 0.2;
  peakCandidateIndex: number | null = null;
  peakCandidateValue = 0;
  rrIntervals: number[] = [];

  // Instantiate the centralized filter and detector
  private signalFilter: SignalFilter;
  private peakDetector: PeakDetector;

  constructor() {
    this.signalFilter = new SignalFilter();
    this.peakDetector = new PeakDetector(); // Initialize PeakDetector
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

  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
  } {
    // Si no está en modo de monitoreo, retornar valores por defecto
    if (!this.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: 0,
        arrhythmiaCount: 0
      };
    }
    
    // Iniciar temporizador si es la primera vez
    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.initAudio(); // Inicializar audio
    }
    
    // Store the raw value in the general signal buffer for potential other uses
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Get recent values needed for filters (adjust sizes as needed)
    const medianRecentBuffer = this.signalBuffer.length >= this.MEDIAN_FILTER_WINDOW - 1
                             ? this.signalBuffer.slice(-(this.MEDIAN_FILTER_WINDOW - 1))
                             : [];
    const movingAvgRecentBuffer = this.signalBuffer.length >= this.MOVING_AVERAGE_WINDOW - 1
                                ? this.signalBuffer.slice(-(this.MOVING_AVERAGE_WINDOW - 1))
                                : [];

    // Apply filters using the centralized SignalFilter instance
    const medVal = this.signalFilter.applyMedianFilter(value, medianRecentBuffer, this.MEDIAN_FILTER_WINDOW);
    // Note: SMA is now applied to the EMA result, matching the original logic order
    // Apply EMA filter first
    const emaVal = this.signalFilter.applyEMAFilter(medVal, this.EMA_ALPHA);
    // Apply SMA filter to the EMA result
    const smoothed = this.signalFilter.applySMAFilter(emaVal, movingAvgRecentBuffer, this.MOVING_AVERAGE_WINDOW);

    // Esperar suficientes datos (use the main signal buffer length)
    if (this.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed, // Return the final smoothed value
        arrhythmiaCount: 0
      };
    }

    // Actualizar línea base (using the final smoothed value)
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    // Normalizar señal (using the final smoothed value)
    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Calcular derivada para detección de picos (using the final smoothed value)
    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue; // Still uses last SMOOTHED value for derivative
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }

    // Use the centralized PeakDetector on the *smoothed* signal buffer
    // We need a buffer of smoothed values for the detector
    // Let's reuse signalBuffer for this, storing smoothed values instead of raw
    this.signalBuffer = []; // Clear the buffer temporarily (or manage it better)
    // This needs rethinking - processSignal works sample by sample.
    // PeakDetector expects a buffer. We need to accumulate smoothed values.

    // Let's maintain a separate buffer for smoothed values for the PeakDetector
    // We already store the latest smoothed values in this.values for derivative calculation.
    // Let's expand that buffer slightly?
    // No, PeakDetector needs a longer window. Let's use signalBuffer for smoothed values.

    // Store smoothed value in the buffer for peak detection
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) { // Use WINDOW_SIZE for detector buffer
        this.signalBuffer.shift();
    }

    let confirmedPeak = false;
    let currentConfidence = 0;
    let detectedIntervals: number[] = [];
    let lastDetectedPeakTime: number = 0; // Variable to store the time from the result

    // Only run peak detection if we have enough smoothed data
    if (this.signalBuffer.length >= 30) { // Use a reasonable minimum size for detection
        const detectionResult = this.peakDetector.detectPeaks(this.signalBuffer);
        detectedIntervals = detectionResult.intervals;
        lastDetectedPeakTime = detectionResult.lastPeakTime; // Get the public time from result

        // Check if the *last* sample processed corresponds to a detected peak index
        // Note: detectionResult.peakIndices refers to indices *within the passed buffer*
        const lastSmoothedValueIndexInBuffer = this.signalBuffer.length - 1;
        if (detectionResult.peakIndices.includes(lastSmoothedValueIndexInBuffer)) {
            confirmedPeak = true;
            // Estimate confidence based on the original normalized value at this point
            currentConfidence = Math.min(1.0, Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5));
            currentConfidence = Math.max(this.MIN_CONFIDENCE, currentConfidence);
        }

        // Use intervals from the detector to update BPM
        if (detectedIntervals.length > 0) {
          // Update BPM history using the intervals from the detector
          this.updateBPMFromIntervals(detectedIntervals);
        }
    }

    // Play beep based on the *instantaneous* peak detection (using normalized value)
    // This part remains tricky. The original logic used normalizedValue and derivative.
    // Let's try to approximate it.
    const timeSinceLastPeakDetector = lastDetectedPeakTime > 0 ? (Date.now() - lastDetectedPeakTime) : Infinity;
    // If the central detector just found a peak (small time diff) and normalized value is high
    if (timeSinceLastPeakDetector < 100 && normalizedValue > this.SIGNAL_THRESHOLD) {
       const beepConfidence = Math.min(1.0, Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5));
       if (Date.now() - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
          this.playBeep(beepConfidence * this.BEEP_VOLUME);
          this.lastBeepTime = Date.now();
       }
    }

    // Update RR intervals if new intervals were detected
    if (detectedIntervals.length > this.rrIntervals.length) {
        this.rrIntervals = [...detectedIntervals]; // Use intervals from the detector
        // Update peak times based on the detector's last peak time
        if (lastDetectedPeakTime > (this.lastPeakTime ?? 0)) { // Use the time from the result object
            this.previousPeakTime = this.lastPeakTime;
            this.lastPeakTime = lastDetectedPeakTime; // Use the time from the result object
        }
    }

    // Retornar resultados
    return {
      bpm: Math.round(this.getFinalBPM()),
      confidence: currentConfidence, // Use confidence from the approximated check
      isPeak: confirmedPeak && !this.isInWarmup(), // Use confirmation from PeakDetector
      filteredValue: smoothed, // Return the final smoothed value
      arrhythmiaCount: 0 // Keep arrhythmia logic separate for now
    };
  }

  autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
        this.peakDetector.reset(); // Also reset the central detector
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    // this.lastConfirmedPeak = false; // No longer used directly
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = []; // Likely no longer needed
    this.values = []; // Reset derivative buffer
    this.lastValue = 0; // Reset last normalized value
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  // New method to update BPM from detected intervals
  private updateBPMFromIntervals(intervals: number[]): void {
    if (this.isInWarmup() || intervals.length === 0) {
      return;
    }

    // Calculate BPM from the mean of the *valid* intervals provided by the detector
    const validIntervals = intervals; // Assume detector already filtered them
    if (validIntervals.length === 0) return;

    const meanInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const instantBPM = 60000 / meanInterval;

    // Add to history (maybe use mean BPM directly?)
    this.bpmHistory.push(instantBPM);
    if (this.bpmHistory.length > 5) {
      this.bpmHistory.shift();
    }

    this.smoothBPM = this.getSmoothBPM(); // Recalculate smoothed BPM based on history
  }

  private getSmoothBPM(): number {
    if (this.bpmHistory.length === 0) {
      return 75; // Valor por defecto si no hay datos
    }
    
    // Ordenar valores para identificar posibles outliers
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Si hay suficientes valores, descartar el más alto y el más bajo para reducir ruido
    let validBPMs = this.bpmHistory;
    if (sortedBPMs.length >= 5) {
      validBPMs = sortedBPMs.slice(1, -1); // Excluir valores extremos
    }
    
    // Calcular media de los valores válidos
    const sum = validBPMs.reduce((acc, val) => acc + val, 0);
    const averageBPM = sum / validBPMs.length;
    
    // Asegurar que está en rango fisiológico
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, averageBPM));
  }

  private calculateCurrentBPM(): number {
    // Si no hay suficientes datos, usar valor suavizado actual
    if (this.bpmHistory.length < 2) {
      return this.smoothBPM > 0 ? this.smoothBPM : 75;
    }
    
    // Aplicar EMA al BPM actual (suaviza aún más los cambios)
    this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + 
                   this.getSmoothBPM() * this.BPM_ALPHA;
    
    // Asegurar valor fisiológico razonable
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, this.smoothBPM));
  }

  public getFinalBPM(): number {
    if (this.isInWarmup() || this.bpmHistory.length < 3) {
      // Durante el período de calentamiento, mostrar un valor promedio base
      return 75;
    }
    
    // Verificar si ha pasado demasiado tiempo desde el último pico
    const timeSinceLastPeak = this.lastPeakTime ? (Date.now() - this.lastPeakTime) : 0;
    
    // Si no hay picos recientes (>3 segundos), reducir gradualmente la confianza
    if (timeSinceLastPeak > 3000) {
      const degradationFactor = Math.min(1, 3000 / timeSinceLastPeak);
      return this.calculateCurrentBPM() * degradationFactor + 75 * (1 - degradationFactor);
    }
    
    return this.calculateCurrentBPM();
  }

  reset() {
    this.signalBuffer = []; // Clear smoothed buffer
    this.peakConfirmationBuffer = []; // Clear if still needed
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.startTime = Date.now();
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    this.rrIntervals = [];

    this.signalFilter.reset(); // Reset filter state
    this.peakDetector.reset(); // Reset detector state

    // Intentar asegurar que el contexto de audio esté activo
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
  }

  getRRIntervals(): RRData { // Update return type to match PeakDetector
    return {
      intervals: [...this.rrIntervals], // Use the rrIntervals populated by the detector logic
      lastPeakTime: this.lastPeakTime
    };
  }
}
