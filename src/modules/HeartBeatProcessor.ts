/**
 * HeartBeatProcessor mejorado con filtrado pasa-banda 0.5-5 Hz para señal PPG,
 * detección de picos adaptada a Pan-Tompkins con validación y confirmación,
 * cálculo BPM con promedios robustos en ventana temporal de 10s,
 * análisis de RR para detección de arritmias basada en variabilidad RR.
 * Implementa procesamiento en tiempo real optimizado para móviles.
 *
 * Prohibido uso de simulaciones o valores arbitrarios.
 */

import { antiRedundancyGuard } from '../core/validation/CrossValidationSystem';
import { MovingAverage } from '../utils/MovingAverage'; // Reutilizar MovingAverage
import { AdaptivePeakDetector } from './peak_detectors/AdaptivePeakDetector'; // Integración del detector adaptativo

// Interfaz para resultados más detallados
export interface HeartBeatAnalysis {
    bpm: number;         // BPM calculado
    confidence: number;  // Confianza en la medición (0-1)
    isPeak: boolean;     // Si el último punto fue un pico detectado
    rrIntervalsMs: number[]; // Historial reciente de intervalos RR en ms
    lastRrMs: number | null; // Último intervalo RR calculado
    rmssd: number;       // RMSSD para variabilidad (indicador de arritmia/estrés)
    sdnn: number;        // SDNN para variabilidad
    isArrhythmiaLikely: boolean; // Indicador simple de posible arritmia
    filteredValue: number; // Valor de la señal después del filtrado
    threshold?: number;    // Umbral dinámico actual (opcional, para visualización)
    snr?: number;          // SNR estimado (opcional, para visualización)
}

let globalHeartBeatProcessorInstanceCount = 0;

class ButterworthIIR {
  private x: Float32Array = new Float32Array(5);
  private y: Float32Array = new Float32Array(5);
  private readonly a = [1, -3.1806, 3.8612, -2.1122, 0.4383];
  private readonly b = [0.0004, 0, -0.0011, 0, 0.0011, 0, -0.0004];

  process(newValue: number): number {
    // Desplaza los valores antiguos
    for (let i = 4; i > 0; i--) {
      this.x[i] = this.x[i-1];
      this.y[i] = this.y[i-1];
    }
    this.x[0] = newValue;
    this.y[0] = this.b[0]*this.x[0] + this.b[2]*this.x[2] + this.b[4]*this.x[4]
                - this.a[1]*this.y[1] - this.a[2]*this.y[2] - this.a[3]*this.y[3] - this.a[4]*this.y[4];
    return this.y[0];
  }
  reset() {
    this.x.fill(0);
    this.y.fill(0);
  }
}

export class HeartBeatProcessor {
  private readonly SAMPLE_RATE = 30;                 // 30 FPS típico cámara
  private readonly LOW_CUTOFF = 0.5;                  // filtro pasa-banda 0.5 Hz (~30 bpm)
  private readonly HIGH_CUTOFF = 5.0;                  // filtro pasa-banda 5 Hz (~300 bpm)
  private readonly WINDOW_LENGTH = 300;                // buffer 10 segundos @30Hz
  private readonly MIN_PEAK_DISTANCE_MS = 300;         // 300 ms mínimo entre picos (200 bpm max)
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly PEAK_CONFIDENCE_THRESHOLD = 0.5;

  private signalBuffer: Float32Array;
  private bufferHead: number = 0;
  private bufferCount: number = 0;
  private filteredSignal: Float32Array;
  private rrIntervals: number[] = [];
  private lastPeakTimestamp: number | null = null;
  private bpmHistory = new MovingAverage(10); // Suavizar BPM usando los últimos 10 valores calculados
  private confidence: number = 0;

  private peakDetector = new AdaptivePeakDetector();
  private butterworth = new ButterworthIIR();

  constructor() {
    this.signalBuffer = new Float32Array(this.WINDOW_LENGTH);
    this.filteredSignal = new Float32Array(this.WINDOW_LENGTH);
    this.reset();
    globalHeartBeatProcessorInstanceCount++;
    console.log('[HeartBeatProcessor] Nueva instancia creada. Total:', globalHeartBeatProcessorInstanceCount, new Error().stack.split('\n').slice(1,3).join(' | '));
  }

  /**
   * Actualiza buffers con nuevo valor de señal PPG cruda, filtra y detecta picos robustos.
   */
  public processSignal(rawValue: number, timestamp: number): HeartBeatAnalysis {
    console.log('[HeartBeatProcessor] processSignal llamado con valor:', rawValue, new Error().stack.split('\n').slice(1,3).join(' | '));
    // Añadir valor raw a buffer circular
    this.signalBuffer[this.bufferHead] = rawValue;
    // Filtrar incrementalmente
    const filtered = this.butterworth.process(rawValue);
    this.filteredSignal[this.bufferHead] = filtered;
    this.bufferHead = (this.bufferHead + 1) % this.WINDOW_LENGTH;
    if (this.bufferCount < this.WINDOW_LENGTH) this.bufferCount++;

    // Obtener el valor filtrado más reciente
    const currentFilteredValue = filtered;
    const currentFilteredTimestamp = timestamp;

    // Detección de Picos Adaptativa
    const peakResult = this.peakDetector.process(currentFilteredValue, currentFilteredTimestamp);
    const isPeak = peakResult.isPeak;
    const peakTimestamp = peakResult.timestamp;
    const currentSnr = peakResult.snr;
    const threshold = peakResult.threshold;
    let lastRrMs: number | null = null;

    // Si hay pico confirmado, actualizar RR intervals y calcular BPM robústamente
    if (isPeak) {
      if (this.lastPeakTimestamp === null) {
        // Primer pico: solo inicializa
        this.lastPeakTimestamp = currentFilteredTimestamp;
        console.log('[HeartBeatProcessor][RR] Primer pico detectado, inicializando lastPeakTimestamp:', currentFilteredTimestamp);
      } else {
        const rr = peakTimestamp - this.lastPeakTimestamp;
        if (rr > 300 && rr < 2000) {
          this.rrIntervals.push(rr);
          if (this.rrIntervals.length > 20) { // mantener últimos 20 intervalos
            this.rrIntervals.shift();
          }
          lastRrMs = rr;
          console.log('[HeartBeatProcessor][RR] Nuevo intervalo RR:', rr, 'Todos:', this.rrIntervals);
        } else {
          console.log('[HeartBeatProcessor][RR] Intervalo RR fuera de rango:', rr);
        }
        this.lastPeakTimestamp = currentFilteredTimestamp;
      }
    }

    // Calcular BPM robusto sobre ventana de RR intervals en ms
    const bpm = this.calculateRobustBPM();
    this.bpmHistory.add(bpm);
    const finalBpm = this.bpmHistory.size() > 0 ? Math.round(this.bpmHistory.getAverage()) : 0;
    console.log('[HeartBeatProcessor][BPM] BPM calculado:', bpm, 'RR intervals:', this.rrIntervals);

    // Calcular confianza usando SNR
    this.confidence = this.calculateConfidence(currentSnr);

    // HRV: RMSSD y SDNN
    const { rmssd, sdnn } = this.calculateHRV();
    const isArrhythmiaLikely = sdnn > 120 || rmssd > 80; // Umbrales orientativos

    return {
      bpm: finalBpm,
      confidence: this.confidence,
      isPeak,
      rrIntervalsMs: this.rrIntervals.slice(),
      lastRrMs,
      rmssd,
      sdnn,
      isArrhythmiaLikely,
      filteredValue: currentFilteredValue,
      threshold,
      snr: currentSnr
    };
  }

  private calculateConfidence(snr: number): number {
    // Escalar SNR a [0,1] con saturación
    if (snr < 1) return 0;
    if (snr > 10) return 1;
    return (snr - 1) / 9;
  }

  /**
   * Calcula BPM con recorte estadístico sobre ventanas de RR para estabilidad
   */
  private calculateRobustBPM(): number {
    if (this.rrIntervals.length < 2) {
      console.log('[HeartBeatProcessor][BPM] No hay suficientes RR intervals para calcular BPM:', this.rrIntervals);
      return 0;
    }

    // Convertir RR a bpm
    const bpmValues = this.rrIntervals.map(intervalMs => 60000 / intervalMs);
    console.log('[HeartBeatProcessor][BPM] BPM values (sin recorte):', bpmValues);

    // Ordenar ascending
    const sorted = bpmValues.slice().sort((a,b) => a - b);

    // Recortar extremos (10%)
    const cut = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(cut, sorted.length - cut);
    console.log('[HeartBeatProcessor][BPM] BPM values (recortados):', trimmed);

    if (trimmed.length === 0) {
      console.log('[HeartBeatProcessor][BPM] No quedan valores tras recorte.');
      return 0;
    }

    // Promedio trimmed
    const avg = trimmed.reduce((a,b) => a + b, 0) / trimmed.length;
    console.log('[HeartBeatProcessor][BPM] Promedio BPM:', avg);

    // Validar rango fisiológico
    if (avg < this.MIN_BPM || avg > this.MAX_BPM) {
      console.log('[HeartBeatProcessor][BPM] BPM fuera de rango fisiológico:', avg);
      return 0;
    }

    return Math.round(avg);
  }

  private calculateHRV(): { rmssd: number; sdnn: number } {
    if (this.rrIntervals.length < 2) {
      return { rmssd: 0, sdnn: 0 };
    }
    // RMSSD
    let sumSq = 0;
    let count = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i-1];
      sumSq += diff * diff;
      count++;
    }
    const rmssd = count > 0 ? Math.sqrt(sumSq / count) : 0;
    // SDNN
    const mean = this.rrIntervals.reduce((a,b) => a+b,0) / this.rrIntervals.length;
    const sdnn = Math.sqrt(this.rrIntervals.reduce((a,b) => a + (b-mean)*(b-mean), 0) / this.rrIntervals.length);
    return { rmssd, sdnn };
  }

  private createDefaultResult(rawValue: number): HeartBeatAnalysis {
    return {
      bpm: 0,
      confidence: 0,
      isPeak: false,
      rrIntervalsMs: [],
      lastRrMs: null,
      rmssd: 0,
      sdnn: 0,
      isArrhythmiaLikely: false,
      filteredValue: rawValue
    };
  }

  /**
   * Permite resetear todos los estados
   */
  public reset() {
    this.signalBuffer.fill(0);
    this.filteredSignal.fill(0);
    this.bufferHead = 0;
    this.bufferCount = 0;
    this.rrIntervals = [];
    this.lastPeakTimestamp = null;
    this.bpmHistory.clear();
    this.confidence = 0;
    this.peakDetector.reset();
    this.butterworth.reset();
  }

  /**
   * Devuelve copia de RR intervals para external analysis
   */
  public getRRIntervals() {
    return {
      intervals: this.rrIntervals.slice(),
      lastPeakTime: this.lastPeakTimestamp
    };
  }

  /**
   * Inicia el monitoreo: prepara buffers y estados
   */
  public startMonitoring(): void {
    this.reset();
    // Aquí puedes agregar lógica adicional si se requiere para iniciar el monitoreo
  }

  /**
   * Detiene el monitoreo: limpia buffers y estados
   */
  public stopMonitoring(): void {
    this.reset();
    // Aquí puedes agregar lógica adicional si se requiere para detener el monitoreo
  }
}

// Registrar para singleton y evitar múltiples instancias
antiRedundancyGuard.registerFile('src/modules/HeartBeatProcessor.ts');
antiRedundancyGuard.registerTask('HeartBeatProcessorSingleton');
