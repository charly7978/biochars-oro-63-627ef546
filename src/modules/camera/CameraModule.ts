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
 * Proporciona funcionalidades para acceder y controlar la cámara del dispositivo
 */

import { EventType, eventBus } from '../events/EventBus';

export interface CameraConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
}

class CameraModule {
  private videoStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;
  private currentConfig: CameraConfig = {
    width: 640,
    height: 480,
    fps: 30,
    facingMode: 'user'
  };
  
  /**
   * Iniciar la cámara con la configuración dada
   */
  async startCamera(config: Partial<CameraConfig> = {}): Promise<boolean> {
    try {
      // Combinar configuración por defecto con la configuración proporcionada
      this.currentConfig = { ...this.currentConfig, ...config };
      
      // Solicitar acceso a la cámara
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: this.currentConfig.width,
          height: this.currentConfig.height,
          frameRate: this.currentConfig.fps,
          facingMode: this.currentConfig.facingMode
        },
        audio: false
      });
      
      // Crear elementos de video y canvas si no existen
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.width = this.currentConfig.width;
        this.videoElement.height = this.currentConfig.height;
        this.videoElement.autoplay = true;
        this.videoElement.style.display = 'none'; // Ocultar el elemento de video
        document.body.appendChild(this.videoElement);
      }
      
      if (!this.canvasElement) {
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = this.currentConfig.width;
        this.canvasElement.height = this.currentConfig.height;
        this.canvasElement.style.display = 'none'; // Ocultar el canvas
        document.body.appendChild(this.canvasElement);
      }
      
      // Asignar el stream de video al elemento de video
      this.videoElement.srcObject = this.videoStream;
      
      // Esperar a que el video empiece a reproducirse
      await this.videoElement.play();
      
      // Publicar evento de cámara iniciada
      eventBus.publish(EventType.CAMERA_STARTED, {
        width: this.currentConfig.width,
        height: this.currentConfig.height,
        fps: this.currentConfig.fps,
        facingMode: this.currentConfig.facingMode
      });
      
      return true;
    } catch (error: any) {
      // Manejar errores de inicialización de la cámara
      eventBus.publish(EventType.CAMERA_ERROR, {
        code: 'camera_init_error',
        message: `Error inicializando cámara: ${error.message}`,
        timestamp: Date.now()
      });
      
      console.error('Error al iniciar la cámara:', error);
      return false;
    }
  }
  
  /**
   * Detener la cámara
   */
  stopCamera(): void {
    if (this.videoStream) {
      // Detener cada pista de video
      this.videoStream.getTracks().forEach(track => {
        track.stop();
      });
      
      this.videoStream = null;
    }
    
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
    
    // Publicar evento de cámara detenida
    eventBus.publish(EventType.CAMERA_STOPPED, {});
  }
  
  /**
   * Leer un frame de la cámara y publicarlo
   */
  readFrame(): void {
    if (!this.videoElement || !this.canvasElement) return;
    
    const context = this.canvasElement.getContext('2d');
    if (!context) return;
    
    try {
      // Dibujar el frame actual del video en el canvas
      context.drawImage(this.videoElement, 0, 0, this.currentConfig.width, this.currentConfig.height);
      
      // Obtener los datos de la imagen del canvas
      const imageData = context.getImageData(0, 0, this.currentConfig.width, this.currentConfig.height);
      
      // Publicar el evento con los datos del frame
      eventBus.publish(EventType.CAMERA_FRAME_READY, {
        timestamp: Date.now(),
        imageData: imageData,
        width: this.currentConfig.width,
        height: this.currentConfig.height
      });
    } catch (error: any) {
      // Manejar errores al extraer el frame
      eventBus.publish(EventType.CAMERA_ERROR, {
        code: 'frame_extraction_error',
        message: error.message || 'Error extrayendo frame de cámara',
        timestamp: Date.now()
      });
      
      console.error('Error al leer el frame de la cámara:', error);
    }
  }
  
  /**
   * Iniciar la lectura continua de frames
   */
  startFrameReading(): void {
    if (this.animationFrameId) return;
    
    const readAndRepeat = () => {
      this.readFrame();
      this.animationFrameId = requestAnimationFrame(readAndRepeat);
    };
    
    readAndRepeat();
  }
  
  /**
   * Detener la lectura de frames
   */
  stopFrameReading(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Cambiar la configuración de la cámara
   */
  async changeCameraConfig(newConfig: Partial<CameraConfig>): Promise<boolean> {
    // Detener la cámara antes de cambiar la configuración
    this.stopCamera();
    
    // Iniciar la cámara con la nueva configuración
    return this.startCamera(newConfig);
  }
  
  /**
   * Obtener el estado actual de la cámara
   */
  getCameraStatus(): { isRunning: boolean; config: CameraConfig } {
    return {
      isRunning: !!this.videoStream,
      config: this.currentConfig
    };
  }
}

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

// Exportar instancia singleton
export const cameraFrameReader = new CameraModule();
