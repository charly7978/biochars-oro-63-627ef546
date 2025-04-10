
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Módulo de Cámara
 * Gestiona acceso, configuración y captura de la cámara
 */

import { EventType, eventBus } from '../events/EventBus';
import { CameraConfig, RawSignalFrame } from '../types/signal';

export class CameraModule {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameInterval: number | null = null;
  private isProcessing: boolean = false;
  private config: CameraConfig = {
    width: 640,
    height: 480,
    fps: 30,
    facingMode: 'user'
  };
  
  /**
   * Iniciar la cámara
   */
  async start(): Promise<boolean> {
    if (this.stream) {
      return true; // Ya está iniciada
    }
    
    try {
      // Solicitar acceso a la cámara
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          facingMode: this.config.facingMode,
          frameRate: { ideal: this.config.fps }
        }
      });
      
      // Crear elementos necesarios
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.config.width;
      this.canvas.height = this.config.height;
      this.ctx = this.canvas.getContext('2d');
      
      // Esperar a que el video esté listo
      await new Promise<void>((resolve) => {
        if (this.videoElement) {
          this.videoElement.onloadedmetadata = () => resolve();
          this.videoElement.play().catch(console.error);
        }
      });
      
      // Publicar evento de cámara lista
      eventBus.publish(EventType.CAMERA_STARTED, {
        timestamp: Date.now(),
        resolution: {
          width: this.config.width,
          height: this.config.height
        }
      });
      
      console.log('Cámara iniciada correctamente con resolución', 
        this.config.width, 'x', this.config.height);
      
      return true;
    } catch (error) {
      console.error('Error al iniciar la cámara:', error);
      eventBus.publish(EventType.CAMERA_ERROR, {
        message: error instanceof Error ? error.message : 'Error accediendo a la cámara',
        timestamp: Date.now()
      });
      
      return false;
    }
  }
  
  /**
   * Detener la cámara
   */
  stop(): void {
    this.stopProcessing();
    
    // Detener todos los tracks de la cámara
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Eliminar elementos
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    
    eventBus.publish(EventType.CAMERA_STOPPED, {
      timestamp: Date.now()
    });
    
    console.log('Cámara detenida');
  }
  
  /**
   * Iniciar procesamiento de frames
   */
  startProcessing(): void {
    if (this.isProcessing || !this.stream || !this.videoElement || !this.ctx) {
      return;
    }
    
    this.isProcessing = true;
    
    // Intervalo para captura de frames
    const frameInterval = 1000 / this.config.fps;
    this.frameInterval = window.setInterval(() => {
      this.captureFrame();
    }, frameInterval);
    
    console.log('Procesamiento de frames iniciado a', this.config.fps, 'FPS');
  }
  
  /**
   * Detener procesamiento de frames
   */
  stopProcessing(): void {
    this.isProcessing = false;
    
    if (this.frameInterval !== null) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    
    console.log('Procesamiento de frames detenido');
  }
  
  /**
   * Capturar un frame de la cámara
   */
  private captureFrame(): void {
    if (!this.isProcessing || !this.videoElement || !this.ctx || !this.canvas) {
      return;
    }
    
    try {
      // Dibujar frame actual en el canvas
      this.ctx.drawImage(
        this.videoElement, 
        0, 0, 
        this.canvas.width, 
        this.canvas.height
      );
      
      // Obtener datos de la imagen
      const imageData = this.ctx.getImageData(
        0, 0, 
        this.canvas.width, 
        this.canvas.height
      );
      
      // Calcular canal rojo promedio (para simplificar extracción PPG)
      const redChannel = this.calculateRedChannel(imageData);
      
      // Crear objeto de frame
      const frame: RawSignalFrame = {
        timestamp: Date.now(),
        imageData,
        width: this.canvas.width,
        height: this.canvas.height,
        redChannel
      };
      
      // Publicar frame
      eventBus.publish(EventType.CAMERA_FRAME, frame);
      eventBus.publish(EventType.CAMERA_FRAME_READY, frame);
    } catch (error) {
      console.error('Error capturando frame:', error);
    }
  }
  
  /**
   * Calcular valor promedio del canal rojo
   */
  private calculateRedChannel(imageData: ImageData): number {
    let redSum = 0;
    let pixelCount = 0;
    
    // Muestrear píxeles (uno cada 16 para rendimiento)
    for (let i = 0; i < imageData.data.length; i += 16) {
      redSum += imageData.data[i];
      pixelCount++;
    }
    
    return redSum / pixelCount;
  }
  
  /**
   * Configurar la cámara
   */
  configure(config: Partial<CameraConfig>): void {
    const needsRestart = 
      this.stream !== null && 
      (config.width !== this.config.width || 
       config.height !== this.config.height ||
       config.facingMode !== this.config.facingMode);
    
    // Actualizar configuración
    this.config = {
      ...this.config,
      ...config
    };
    
    // Reiniciar si es necesario
    if (needsRestart) {
      this.stop();
      this.start().then(success => {
        if (success && this.isProcessing) {
          this.startProcessing();
        }
      });
    }
    
    console.log('Configuración de cámara actualizada:', this.config);
  }
  
  /**
   * Obtener el estado actual
   */
  getStatus(): {
    isActive: boolean;
    isProcessing: boolean;
    config: CameraConfig;
  } {
    return {
      isActive: this.stream !== null,
      isProcessing: this.isProcessing,
      config: { ...this.config }
    };
  }
}

// Exportar instancia singleton
export const cameraModule = new CameraModule();

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
