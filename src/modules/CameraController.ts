
export class CameraController {
  private stream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private readonly OPTIMAL_BRIGHTNESS_MIN = 128;
  private readonly OPTIMAL_BRIGHTNESS_MAX = 180;

  async setupCamera(): Promise<MediaStream> {
    try {
      // Intentar primero con resolución HD
      const hdConstraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
          frameRate: { min: 30, ideal: 60 }
        }
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(hdConstraints);
      } catch (e) {
        console.log("No se pudo obtener HD, intentando resolución menor");
        // Si falla HD, intentar con resolución media
        const mediumConstraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 },
            frameRate: { min: 30, ideal: 30 }
          }
        };
        this.stream = await navigator.mediaDevices.getUserMedia(mediumConstraints);
      }

      this.videoTrack = this.stream.getVideoTracks()[0];
      
      // Esperar a que el track esté realmente listo
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      
      // Forzar la configuración más alta disponible
      const capabilities = this.videoTrack.getCapabilities();
      const settings: MediaTrackConstraintSet = {};

      if (capabilities.width) {
        settings.width = capabilities.width.max;
      }
      if (capabilities.height) {
        settings.height = capabilities.height.max;
      }
      if (capabilities.frameRate) {
        settings.frameRate = Math.min(60, capabilities.frameRate.max || 30);
      }

      // Aplicar configuraciones avanzadas
      await this.initializeTrackSettings();
      
      // Verificar la resolución final
      const finalSettings = this.videoTrack.getSettings();
      console.log("Resolución final de la cámara:", {
        width: finalSettings.width,
        height: finalSettings.height,
        frameRate: finalSettings.frameRate
      });
      
      return this.stream;
    } catch (error) {
      console.error('Error al configurar la cámara:', error);
      throw error;
    }
  }

  private async initializeTrackSettings() {
    if (!this.videoTrack) return;

    const capabilities = this.videoTrack.getCapabilities();
    const settings: MediaTrackConstraintSet = {};

    // Configurar modos de la cámara
    if (capabilities.exposureMode?.includes('manual')) {
      settings.exposureMode = 'manual';
    }

    if (capabilities.focusMode?.includes('manual')) {
      settings.focusMode = 'manual';
    }

    if (capabilities.whiteBalanceMode?.includes('manual')) {
      settings.whiteBalanceMode = 'manual';
    }

    // Intentar aplicar configuraciones avanzadas
    try {
      await this.videoTrack.applyConstraints({
        advanced: [settings]
      });

      // Verificar si podemos ajustar la exposición
      if (capabilities.exposureMode) {
        await this.videoTrack.applyConstraints({
          advanced: [{
            exposureMode: 'manual'
          }]
        });
      }
    } catch (error) {
      console.warn('No se pudieron aplicar algunas configuraciones:', error);
    }
  }

  async optimizeForPPG(): Promise<void> {
    if (!this.videoTrack) return;

    const capabilities = this.videoTrack.getCapabilities();
    const settings: MediaTrackConstraintSet = {};

    // Configuración específica para PPG
    if (capabilities.exposureMode?.includes('manual')) {
      settings.exposureMode = 'manual';
    }

    if (capabilities.focusMode?.includes('manual')) {
      settings.focusMode = 'manual';
    }

    if (capabilities.whiteBalanceMode?.includes('manual')) {
      settings.whiteBalanceMode = 'manual';
    }

    // Activar linterna si está disponible
    if (capabilities.torch) {
      settings.torch = true;
    }

    try {
      await this.videoTrack.applyConstraints({
        advanced: [settings]
      });
    } catch (error) {
      console.warn('Error al optimizar para PPG:', error);
    }
  }

  calculateAverageBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let totalBrightness = 0;
    
    // Analizar solo el centro de la imagen (ROI)
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.25;
    
    const startX = Math.max(0, centerX - roiSize/2);
    const endX = Math.min(imageData.width, centerX + roiSize/2);
    const startY = Math.max(0, centerY - roiSize/2);
    const endY = Math.min(imageData.height, centerY + roiSize/2);
    
    let pixelCount = 0;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
        pixelCount++;
      }
    }
    
    return totalBrightness / pixelCount;
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.videoTrack;
  }

  async stop(): Promise<void> {
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
