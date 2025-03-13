
import { AudioHandler } from './audio-handler';
import { SignalProcessor } from './signal-processor';
import { PeakDetector } from './peak-detector';
import { BPMAnalyzer } from './bpm-analyzer';
import { HeartBeatResult, RRIntervalData } from './types';
import HumSoundFile from '../../assets/sounds/heartbeat-low.mp3';

export class HeartBeatProcessor {
  // Modo de depuración
  private DEBUG = true;

  // Módulos de componentes
  private audioHandler: AudioHandler;
  private signalProcessor: SignalProcessor;
  private peakDetector: PeakDetector;
  private bpmAnalyzer: BPMAnalyzer;
  
  // Estado
  private lastBeatTime = 0;
  private lastMajorBeatTime = 0;
  private rrIntervals: { timestamp: number; interval: number }[] = [];
  private isInitialized = false;
  private lastSignalQuality = 0;
  private consecutiveMissedBeats = 0;
  private forcedDetectionMode = false;
  private readonly MAX_RR_DATA_POINTS = 20;
  private signalBuffer: number[] = [];
  private beatsCounter = 0;
  private lastFiveBeatsQuality: number[] = [0, 0, 0, 0, 0];
  private falsePositiveProtection = 0;
  private lastProcessedTimestamp = 0;
  private initializationAttempts = 0;
  private lastDebugLogTime = 0;

  constructor() {
    // Parámetros mejorados para detección más sensible
    this.audioHandler = new AudioHandler(HumSoundFile);
    this.signalProcessor = new SignalProcessor(150, 4, 0.45); // Valores más sensibles: buffer más pequeño, ventana más pequeña, alpha más alto
    
    // Configuración de detector de picos más sensible para capturar mejor los latidos
    this.peakDetector = new PeakDetector(
      2,       // Ventana de pico más pequeña para detección más rápida
      0.12,    // Umbral más bajo para capturar más picos
      0.2,     // Umbral de pico fuerte más bajo
      0.5,     // Umbral dinámico más agresivo
      200,     // Tiempo mínimo más bajo (200ms = 300bpm máx)
      1800     // Tiempo máximo aumentado (1800ms = 33bpm mín)
    );
    
    this.bpmAnalyzer = new BPMAnalyzer(35, 210, 5); // Rango fisiológico ampliado
    
    console.log("HeartBeatProcessor: Constructor ejecutado con parámetros optimizados");
    this.initialize();
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitialized && this.initializationAttempts > 0) return true;
    
    this.initializationAttempts++;
    console.log(`HeartBeatProcessor intento de inicialización #${this.initializationAttempts}`);

    try {
      // Inicializar manejador de audio primero
      let audioInit = await this.audioHandler.initialize();
      
      // Reintentar inicialización de audio si falla
      if (!audioInit) {
        console.log("Reintentando inicialización de audio después de breve retraso...");
        await new Promise(resolve => setTimeout(resolve, 500));
        audioInit = await this.audioHandler.initialize();
      }
      
      this.isInitialized = true;
      
      console.log("HeartBeatProcessor: Inicializado con estado de audio:", audioInit);
      return true;
    } catch (error) {
      console.error("Error inicializando HeartBeatProcessor:", error);
      // Aún marcar como inicializado para permitir procesamiento sin audio
      this.isInitialized = true;
      
      // Intentar reinicializar después de un retraso
      setTimeout(() => {
        console.log("Intentando reinicializar audio después de error");
        this.audioHandler.initialize().catch(err => 
          console.error("Reinicialización de audio falló:", err)
        );
      }, 2000);
      
      return true;
    }
  }

  public processSignal(value: number, quality: number = 50): HeartBeatResult { // Valor de calidad por defecto aumentado de 0 a 50
    const now = Date.now();
    
    // Limitar la frecuencia de procesamiento para no sobrecargar el sistema
    if (now - this.lastProcessedTimestamp < 15 && this.lastProcessedTimestamp !== 0) { // Reducido de 20 a 15ms
      // Devolver último resultado si estamos procesando con demasiada frecuencia
      return {
        bpm: this.bpmAnalyzer.currentBPM,
        confidence: 0.3, // Confianza balanceada aumentada de 0.2 a 0.3
        isBeat: false,
        lastBeatTime: this.lastBeatTime,
        rrData: [...this.rrIntervals]
      };
    }
    
    this.lastProcessedTimestamp = now;
    
    // Registro de depuración periódico (cada 3 segundos)
    const shouldDebugLog = now - this.lastDebugLogTime > 3000;
    if (shouldDebugLog) {
      console.log(`HeartBeatProcessor: Procesando señal con valor=${value.toFixed(2)}, calidad=${quality}, beats=${this.beatsCounter}`, {
        forcedMode: this.forcedDetectionMode,
        missedBeats: this.consecutiveMissedBeats,
        timestamp: new Date().toISOString()
      });
      this.lastDebugLogTime = now;
    }
    
    // Aumentar calidad mínima de señal para ayudar con la detección
    this.lastSignalQuality = Math.max(50, quality); // Aumentado de 40 a 50
    
    // Mantener un buffer corto de valores sin procesar para detección de anomalías
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 20) { // Reducido de 30 a 20
      this.signalBuffer.shift();
    }
    
    // Procesar la señal a través de nuestro procesador de señal
    const { smoothedValue, derivative, signalBuffer } = this.signalProcessor.processSignal(value);
    
    // Actualización más frecuente de umbral adaptativo para respuesta más rápida
    if (this.beatsCounter % 3 === 0 || this.forcedDetectionMode) { // Reducido de 5 a 3
      this.peakDetector.updateAdaptiveThreshold(signalBuffer, now, shouldDebugLog);
    }

    // Detección de latido con lógica mejorada
    let isBeat = false;
    let currentBpm = this.bpmAnalyzer.currentBPM;
    
    // Detección más rápida con requisito de buffer más pequeño
    if (this.signalProcessor.bufferLength > 2) { // Reducido de 3 a 2
      // Detección de latido más sensible con comprobación de calidad relajada
      isBeat = this.peakDetector.detectBeat(
        now, 
        smoothedValue, 
        Math.max(40, this.lastSignalQuality), // Usar un umbral de calidad mínimo más alto (aumentado de 30 a 40)
        signalBuffer, 
        derivative, 
        this.lastBeatTime
      );
      
      // Protección contra falsos positivos menos agresiva
      if (isBeat) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        
        // Bloquear solo latidos extremadamente frecuentes (menos restrictivo)
        if (timeSinceLastBeat < 150) { // Reducido de 180 a 150
          isBeat = false;
          this.falsePositiveProtection++;
          if (this.DEBUG && shouldDebugLog) {
            console.log(`Falso positivo rechazado: intervalo extremadamente corto (${timeSinceLastBeat}ms)`);
          }
        } else {
          this.falsePositiveProtection = Math.max(0, this.falsePositiveProtection - 1);
        }
      }
      
      // Si se detecta latido y pasa verificación de falso positivo
      if (isBeat) {
        console.log(`LATIDO DETECTADO en timestamp ${now} con calidad ${this.lastSignalQuality}`);
        this.beatsCounter++;
        
        // Reiniciar contador para modo forzado
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // Validación de intervalo más permisiva
          if (interval > 200 && interval < 1800) { // Cambiado de 240/1600 a 200/1800
            // Almacenar datos de intervalo RR
            this.rrIntervals.push({ timestamp: now, interval });
            if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
              this.rrIntervals.shift();
            }
            
            // Rastrear calidad de últimos 5 latidos para cálculo de confianza
            this.lastFiveBeatsQuality.push(this.lastSignalQuality);
            if (this.lastFiveBeatsQuality.length > 5) {
              this.lastFiveBeatsQuality.shift();
            }
            
            // Calcular BPM y actualizar analizador
            const newBpm = this.bpmAnalyzer.addBeatInterval(interval);
            if (newBpm !== null) {
              currentBpm = newBpm;
              
              // Actualizar parámetros de tiempo del detector de picos
              this.peakDetector.setTimingParameters(interval);
            }
          } else if (this.DEBUG && shouldDebugLog) {
            console.log(`Intervalo de latido fuera de rango válido: ${interval}ms`);
          }
        }
        
        // Actualizar hora del último latido
        this.lastBeatTime = now;
        this.lastMajorBeatTime = now;
        
        // Reproducir sonido con volumen aumentado basado en confianza
        const beatStrength = this.peakDetector.confidenceLevel;
        this.audioHandler.playBeep(
          Math.min(1.0, beatStrength + 0.5), // Volumen aumentado (de 0.9/0.4 a 1.0/0.5)
          Math.min(90, this.lastSignalQuality)  // Tono basado en calidad más alto (de 85 a 90)
        );
          
        if (this.DEBUG && shouldDebugLog) {
          console.log(`BEEP reproducido con fuerza ${beatStrength.toFixed(2)} y calidad ${this.lastSignalQuality}`);
        }
        
        if (this.DEBUG && this.beatsCounter % 2 === 0) {
          console.log(`LATIDO @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confianza: ${this.peakDetector.confidenceLevel.toFixed(2)}, Calidad: ${this.lastSignalQuality}, Estabilidad: ${this.peakDetector.stabilityLevel.toFixed(2)}`);
        }
      }
      
      // Manejo más agresivo de latidos perdidos
      const expectedBeatInterval = 60000 / (currentBpm || 70);
      if (!isBeat && now - this.lastBeatTime > expectedBeatInterval * 1.2 && this.lastBeatTime > 0) { // Reducido de 1.3 a 1.2
        this.consecutiveMissedBeats++;
        
        // Entrar en modo forzado antes
        if (this.consecutiveMissedBeats > 2 && !this.forcedDetectionMode) { // Reducido de 3 a 2
          this.forcedDetectionMode = true;
          console.log("HeartBeatProcessor: Entrando en modo de detección forzada después de latidos perdidos");
          
          // Forzar un latido después de menos latidos perdidos
          if (this.consecutiveMissedBeats > 3 && now - this.lastBeatTime > expectedBeatInterval * 1.5) { // Reducido de 4 a 3 y de 1.6 a 1.5
            isBeat = true;
            this.lastBeatTime = now;
            this.beatsCounter++;
            
            // Reproducir un sonido de latido forzado a mayor volumen
            this.audioHandler.playBeep(0.8, 65); // Aumentado de 0.7/60 a 0.8/65
            console.log("Latido forzado generado después de perder múltiples latidos");
          }
        }
      }
    }

    // Calcular confianza con impulso más agresivo
    const avgQuality = this.lastFiveBeatsQuality.reduce((sum, q) => sum + q, 0) / 
                     (this.lastFiveBeatsQuality.length || 1);
    
    let finalConfidence = this.bpmAnalyzer.calculateConfidence(avgQuality);
    
    // Fuerte impulso de confianza basado en estabilidad
    finalConfidence *= (1.0 + (0.7 * this.peakDetector.stabilityLevel)); // Aumentado de 0.5 a 0.7
    finalConfidence = Math.min(1.0, finalConfidence + 0.25); // Base más alta (de 0.2 a 0.25)
    
    if (this.forcedDetectionMode) {
      finalConfidence *= 0.85; // Menos penalización para modo forzado (de 0.8 a 0.85)
    }

    return {
      bpm: currentBpm,
      confidence: finalConfidence,
      isBeat,
      lastBeatTime: this.lastBeatTime,
      rrData: [...this.rrIntervals]
    };
  }

  public reset(): void {
    this.signalProcessor.reset();
    this.peakDetector.reset();
    this.bpmAnalyzer.reset();
    
    this.lastBeatTime = 0;
    this.lastMajorBeatTime = 0;
    this.rrIntervals = [];
    this.consecutiveMissedBeats = 0;
    this.forcedDetectionMode = false;
    this.signalBuffer = [];
    this.beatsCounter = 0;
    this.lastFiveBeatsQuality = [0, 0, 0, 0, 0];
    this.falsePositiveProtection = 0;
    this.lastProcessedTimestamp = 0;
    this.lastDebugLogTime = 0;
    
    console.log("HeartBeatProcessor: Reset completo ejecutado");
  }

  public getRRIntervals(): RRIntervalData {
    // Convertir datos de intervalo RR a una matriz simple de intervalos
    const intervals = this.rrIntervals.map(rr => rr.interval);
    
    return {
      intervals,
      lastPeakTime: this.lastBeatTime > 0 ? this.lastBeatTime : null
    };
  }
}
