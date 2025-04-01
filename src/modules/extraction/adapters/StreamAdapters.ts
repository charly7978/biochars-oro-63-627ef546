/**
 * Adaptadores para entrada y salida de datos
 * Permite convertir diferentes fuentes de datos al formato esperado por el extractor
 */

import { Observable, Subject } from '../observable/SignalObservable';

/**
 * Interfaz base para adaptadores de entrada
 */
export interface InputAdapter<TSource, TTarget> {
  connect(source: TSource): void;
  disconnect(): void;
  getOutputStream(): Observable<TTarget>;
}

/**
 * Interfaz base para adaptadores de salida
 */
export interface OutputAdapter<TSource, TTarget> {
  connect(source: Observable<TSource>): void;
  disconnect(): void;
  getDestination(): TTarget;
}

/**
 * Adaptador para convertir frames de cámara a valores PPG
 */
export class CameraFrameAdapter implements InputAdapter<ImageData, number> {
  private outputSubject = new Subject<number>();
  private connected = false;
  private extractionConfig = {
    useRedChannel: true,
    useGreenChannel: false,
    useBlueChannel: false,
    regionOfInterest: {
      x: 0.3, // Centro 40% del frame
      y: 0.3,
      width: 0.4,
      height: 0.4
    }
  };
  
  /**
   * Configura el adaptador
   */
  public configure(config: Partial<typeof this.extractionConfig>): void {
    this.extractionConfig = {
      ...this.extractionConfig,
      ...config
    };
  }
  
  /**
   * Conecta a la fuente de frames
   */
  public connect(source: ImageData): void {
    if (!source) {
      throw new Error('Fuente de frames no válida');
    }
    
    this.processFrame(source);
    this.connected = true;
  }
  
  /**
   * Desconecta de la fuente de frames
   */
  public disconnect(): void {
    this.connected = false;
  }
  
  /**
   * Procesa un frame de cámara para extraer valor PPG
   */
  public processFrame(imageData: ImageData): void {
    if (!this.connected) return;
    
    try {
      const ppgValue = this.extractPPGValue(imageData);
      this.outputSubject.next(ppgValue);
    } catch (error) {
      console.error('Error procesando frame en adaptador:', error);
    }
  }
  
  /**
   * Extrae valor PPG de un frame
   */
  private extractPPGValue(imageData: ImageData): number {
    const { data, width, height } = imageData;
    const { useRedChannel, useGreenChannel, useBlueChannel, regionOfInterest } = this.extractionConfig;
    
    // Calcular límites de la región de interés
    const startX = Math.floor(width * regionOfInterest.x);
    const startY = Math.floor(height * regionOfInterest.y);
    const roiWidth = Math.floor(width * regionOfInterest.width);
    const roiHeight = Math.floor(height * regionOfInterest.height);
    const endX = startX + roiWidth;
    const endY = startY + roiHeight;
    
    // Variables para acumular valores
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Procesar solo la región de interés
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * width + x) * 4;
        if (useRedChannel) redSum += data[i];     // Canal rojo
        if (useGreenChannel) greenSum += data[i + 1]; // Canal verde
        if (useBlueChannel) blueSum += data[i + 2]; // Canal azul
        pixelCount++;
      }
    }
    
    // Promediar canales y normalizar a [0,1]
    let channelSum = 0;
    let channelCount = 0;
    
    if (useRedChannel) { channelSum += redSum; channelCount++; }
    if (useGreenChannel) { channelSum += greenSum; channelCount++; }
    if (useBlueChannel) { channelSum += blueSum; channelCount++; }
    
    // Usar solo canal rojo si no se seleccionó ninguno
    if (channelCount === 0) {
      return redSum / (pixelCount * 255);
    }
    
    return channelSum / (channelCount * pixelCount * 255);
  }
  
  /**
   * Obtiene el observable de salida
   */
  public getOutputStream(): Observable<number> {
    return this.outputSubject;
  }
}

/**
 * Adaptador para convertir valores PPG a buffer de audio
 */
export class PPGToAudioAdapter implements OutputAdapter<number, AudioNode> {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private subscription: (() => void) | null = null;
  
  private config = {
    baseFrequency: 440, // Hz
    maxFrequencyShift: 100, // Hz
    minGain: 0.0,
    maxGain: 0.2
  };
  
  constructor(audioContext?: AudioContext) {
    if (audioContext) {
      this.audioContext = audioContext;
      this.setupAudioNodes();
    }
  }
  
  /**
   * Configura el adaptador
   */
  public configure(config: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Actualizar parámetros si ya está conectado
    if (this.oscillator) {
      this.oscillator.frequency.setValueAtTime(
        this.config.baseFrequency,
        this.audioContext?.currentTime || 0
      );
    }
  }
  
  /**
   * Inicializa el contexto de audio si no existe
   */
  private initAudioContext(): void {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.setupAudioNodes();
      } catch (error) {
        console.error('Error inicializando contexto de audio:', error);
      }
    }
  }
  
  /**
   * Configura los nodos de audio
   */
  private setupAudioNodes(): void {
    if (!this.audioContext) return;
    
    // Crear oscillator
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(
      this.config.baseFrequency,
      this.audioContext.currentTime
    );
    
    // Crear gain node (para volumen)
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    
    // Conectar nodos
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    // Iniciar oscillator
    this.oscillator.start();
  }
  
  /**
   * Conecta a la fuente de datos
   */
  public connect(source: Observable<number>): void {
    this.initAudioContext();
    
    if (!this.audioContext || !this.oscillator || !this.gainNode) {
      console.error('Error: Nodos de audio no inicializados');
      return;
    }
    
    // Desconectar si ya había una suscripción
    this.disconnect();
    
    // Suscribirse al observable
    this.subscription = source.subscribe(value => {
      this.updateAudioFromPPG(value);
    });
  }
  
  /**
   * Actualiza parámetros de audio desde valor PPG
   */
  private updateAudioFromPPG(ppgValue: number): void {
    if (!this.audioContext || !this.oscillator || !this.gainNode) return;
    
    // Mapear PPG a frecuencia (valor alto = frecuencia alta)
    const normalizedValue = Math.max(0, Math.min(1, ppgValue));
    const frequencyShift = normalizedValue * this.config.maxFrequencyShift;
    const newFrequency = this.config.baseFrequency + frequencyShift;
    
    // Mapear PPG a ganancia/volumen
    const newGain = this.config.minGain + 
      normalizedValue * (this.config.maxGain - this.config.minGain);
    
    // Aplicar cambios con rampa para evitar clics
    const currentTime = this.audioContext.currentTime;
    this.oscillator.frequency.linearRampToValueAtTime(newFrequency, currentTime + 0.05);
    this.gainNode.gain.linearRampToValueAtTime(newGain, currentTime + 0.05);
  }
  
  /**
   * Desconecta de la fuente de datos
   */
  public disconnect(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    
    // Silenciar audio
    if (this.audioContext && this.gainNode) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    }
  }
  
  /**
   * Detiene y limpia recursos
   */
  public stop(): void {
    this.disconnect();
    
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (error) {
        // Ignorar si ya estaba detenido
      }
      this.oscillator = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }
  
  /**
   * Obtiene el nodo de salida
   */
  public getDestination(): AudioNode {
    if (!this.gainNode) {
      throw new Error('Audio no inicializado');
    }
    return this.gainNode;
  }
}

/**
 * Adaptador para convertir valores PPG a ArrayBuffer para transferencia
 */
export class PPGToArrayBufferAdapter implements OutputAdapter<number, ArrayBuffer> {
  private buffer: Float32Array;
  private index: number = 0;
  private subscription: (() => void) | null = null;
  private transferableBuffer: ArrayBuffer | null = null;
  private onBufferFull: ((buffer: ArrayBuffer) => void) | null = null;
  
  constructor(
    private bufferSize: number = 100,
    onBufferFull?: (buffer: ArrayBuffer) => void
  ) {
    this.buffer = new Float32Array(bufferSize);
    this.onBufferFull = onBufferFull || null;
  }
  
  /**
   * Conecta a la fuente de datos
   */
  public connect(source: Observable<number>): void {
    // Desconectar si ya había una suscripción
    this.disconnect();
    
    // Resetear buffer
    this.index = 0;
    this.buffer = new Float32Array(this.bufferSize);
    
    // Suscribirse al observable
    this.subscription = source.subscribe(value => {
      this.addValue(value);
    });
  }
  
  /**
   * Añade un valor al buffer
   */
  private addValue(value: number): void {
    this.buffer[this.index] = value;
    this.index++;
    
    // Si el buffer está lleno, notificar y crear uno nuevo
    if (this.index >= this.bufferSize) {
      // Guardar referencia al buffer lleno
      this.transferableBuffer = this.buffer.buffer;
      
      // Notificar si hay callback
      if (this.onBufferFull) {
        this.onBufferFull(this.transferableBuffer);
      }
      
      // Crear nuevo buffer
      this.buffer = new Float32Array(this.bufferSize);
      this.index = 0;
    }
  }
  
  /**
   * Desconecta de la fuente de datos
   */
  public disconnect(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
  }
  
  /**
   * Obtiene el buffer actual (posiblemente parcialmente lleno)
   */
  public getDestination(): ArrayBuffer {
    return this.buffer.buffer;
  }
  
  /**
   * Obtiene el último buffer completo transferible
   */
  public getTransferableBuffer(): ArrayBuffer | null {
    return this.transferableBuffer;
  }
  
  /**
   * Fuerza la emisión del buffer actual aunque no esté lleno
   */
  public flush(): ArrayBuffer | null {
    if (this.index > 0) {
      // Crear una vista del buffer con solo los datos válidos
      const partialBuffer = this.buffer.slice(0, this.index).buffer;
      
      // Notificar si hay callback
      if (this.onBufferFull) {
        this.onBufferFull(partialBuffer);
      }
      
      // Resetear buffer
      this.buffer = new Float32Array(this.bufferSize);
      this.index = 0;
      
      return partialBuffer;
    }
    
    return null;
  }
}

/**
 * Crea un adaptador para frames de cámara
 */
export function createCameraFrameAdapter(): CameraFrameAdapter {
  return new CameraFrameAdapter();
}

/**
 * Crea un adaptador para audio
 */
export function createAudioAdapter(audioContext?: AudioContext): PPGToAudioAdapter {
  return new PPGToAudioAdapter(audioContext);
}

/**
 * Crea un adaptador para ArrayBuffer
 */
export function createArrayBufferAdapter(
  bufferSize: number = 100,
  onBufferFull?: (buffer: ArrayBuffer) => void
): PPGToArrayBufferAdapter {
  return new PPGToArrayBufferAdapter(bufferSize, onBufferFull);
}
