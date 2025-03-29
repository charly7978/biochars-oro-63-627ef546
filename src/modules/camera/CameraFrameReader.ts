
/**
 * Módulo de Cámara
 * Responsable exclusivamente de la captura de frames de la cámara
 */

import { EventType, eventBus } from '../events/EventBus';

export interface CameraConfig {
  facingMode: 'user' | 'environment';
  width: number;
  height: number;
  frameRate: number;
  torch?: boolean;
}

export interface RawFrame {
  imageData: ImageData;
  timestamp: number;
  width: number;
  height: number;
}

export class CameraFrameReader {
  private stream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private isReading: boolean = false;
  private processingCanvas: HTMLCanvasElement;
  private processingContext: CanvasRenderingContext2D | null = null;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameInterval: number = 1000 / 30; // 30 fps por defecto
  
  constructor(private config: CameraConfig = {
    facingMode: 'environment',
    width: 640,
    height: 480,
    frameRate: 30,
    torch: false
  }) {
    this.processingCanvas = document.createElement('canvas');
    this.processingContext = this.processingCanvas.getContext('2d', { willReadFrequently: true });
    this.processingCanvas.width = 320; // Tamaño reducido para mejor rendimiento
    this.processingCanvas.height = 240;
    this.frameInterval = 1000 / config.frameRate;
  }
  
  /**
   * Iniciar la cámara y configurar parámetros
   */
  async startCamera(): Promise<boolean> {
    try {
      if (this.stream) {
        this.stopCamera();
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de cámara no soportada en este navegador');
      }
      
      // Configurar restricciones de cámara
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: this.config.frameRate }
        }
      };
      
      // Acceder a la cámara
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoTrack = this.stream.getVideoTracks()[0];
      
      // Optimizar configuración para cámaras móviles
      if (this.videoTrack) {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid && this.videoTrack.getCapabilities) {
          const capabilities = this.videoTrack.getCapabilities();
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // Habilitar configuraciones óptimas para PPG
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
          }
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }
          
          // Activar flash si se solicita y está disponible
          if (this.config.torch && capabilities.torch) {
            try {
              await this.videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
            } catch (err) {
              console.warn('No se pudo activar el flash:', err);
            }
          }
          
          // Aplicar todas las restricciones avanzadas
          if (advancedConstraints.length > 0) {
            try {
              await this.videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
            } catch (err) {
              console.warn('No se pudieron aplicar algunas optimizaciones de cámara:', err);
            }
          }
        }
        
        // Notificar que la cámara está lista
        eventBus.publish(EventType.CAMERA_READY, {
          stream: this.stream,
          track: this.videoTrack
        });
        
        console.log('Cámara inicializada correctamente');
        return true;
      } else {
        throw new Error('No hay pista de video disponible');
      }
    } catch (error) {
      console.error('Error de inicialización de cámara:', error);
      eventBus.publish(EventType.CAMERA_ERROR, {
        code: 'CAMERA_INIT_ERROR',
        message: error instanceof Error ? error.message : 'Error al iniciar la cámara',
        timestamp: Date.now()
      });
      return false;
    }
  }
  
  /**
   * Detener la cámara y liberar recursos
   */
  stopCamera(): void {
    this.isReading = false;
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
      this.videoTrack = null;
    }
    
    console.log('Cámara detenida y recursos liberados');
  }
  
  /**
   * Comenzar a leer frames de la cámara
   */
  startFrameReading(): void {
    if (!this.stream || !this.videoTrack) {
      eventBus.publish(EventType.CAMERA_ERROR, {
        code: 'CAMERA_NOT_READY',
        message: 'Cámara no inicializada',
        timestamp: Date.now()
      });
      return;
    }
    
    this.isReading = true;
    this.processNextFrame();
    console.log('Lectura de frames iniciada');
  }
  
  /**
   * Detener la lectura de frames
   */
  stopFrameReading(): void {
    this.isReading = false;
    console.log('Lectura de frames detenida');
  }
  
  /**
   * Procesar el siguiente frame de la cámara
   */
  private async processNextFrame(): Promise<void> {
    if (!this.isReading || !this.videoTrack) return;
    
    const now = Date.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    
    // Controlar la tasa de frames
    if (timeSinceLastFrame >= this.frameInterval) {
      try {
        // Crear un elemento de video temporal para capturar el frame
        const video = document.createElement('video');
        video.srcObject = this.stream!;
        await video.play();
        
        // Dibujar el frame en el canvas
        if (this.processingContext) {
          this.processingContext.drawImage(
            video, 
            0, 0, video.videoWidth, video.videoHeight,
            0, 0, this.processingCanvas.width, this.processingCanvas.height
          );
          
          // Obtener los datos de imagen
          const imageData = this.processingContext.getImageData(
            0, 0, this.processingCanvas.width, this.processingCanvas.height
          );
          
          this.frameCount++;
          this.lastFrameTime = now;
          
          // Crear objeto de frame
          const frame: RawFrame = {
            imageData,
            timestamp: now,
            width: this.processingCanvas.width,
            height: this.processingCanvas.height
          };
          
          // Publicar el frame
          eventBus.publish(EventType.CAMERA_FRAME, frame);
          
          // Registro de rendimiento cada 30 frames
          if (this.frameCount % 30 === 0) {
            const fps = 1000 / (timeSinceLastFrame || 1);
            console.log(`Procesamiento de cámara a ${fps.toFixed(1)} FPS`);
          }
        }
      } catch (error) {
        console.error('Error al procesar frame de cámara:', error);
        eventBus.publish(EventType.ERROR_OCCURRED, {
          code: 'FRAME_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error procesando frame',
          timestamp: Date.now()
        });
      }
    }
    
    // Programar próximo frame
    requestAnimationFrame(() => this.processNextFrame());
  }
  
  /**
   * Alternar linterna/flash
   */
  async toggleTorch(enable: boolean): Promise<boolean> {
    if (!this.videoTrack) return false;
    
    try {
      const capabilities = this.videoTrack.getCapabilities();
      if (capabilities.torch) {
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: enable }]
        });
        this.config.torch = enable;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al alternar flash:', error);
      return false;
    }
  }
  
  /**
   * Obtener estado actual de la cámara
   */
  getStatus(): {
    active: boolean;
    reading: boolean;
    config: CameraConfig;
    frameCount: number;
  } {
    return {
      active: !!this.stream,
      reading: this.isReading,
      config: { ...this.config },
      frameCount: this.frameCount
    };
  }
}

// Exportar instancia singleton
export const cameraFrameReader = new CameraFrameReader();
