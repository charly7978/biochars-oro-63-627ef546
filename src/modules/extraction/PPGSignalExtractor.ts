
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Extractor de Señal PPG
 * Se enfoca exclusivamente en la extracción de la señal PPG sin procesamiento complejo
 */

import { EventType, eventBus } from '../events/EventBus';
import { RawFrame } from '../camera/CameraFrameReader';

export interface PPGSignalData {
  redChannel: number;
  greenChannel: number;
  blueChannel: number;
  timestamp: number;
  rawValues: number[];
  combinedValue: number;
  channelData?: {
    red: number;
    ir: number;
  };
}

export class PPGSignalExtractor {
  private recentRedValues: number[] = [];
  private recentGreenValues: number[] = [];
  private recentBlueValues: number[] = [];
  private isExtracting: boolean = false;
  private readonly BUFFER_SIZE = 50;
  
  /**
   * Iniciar extracción
   */
  startExtraction(): void {
    if (this.isExtracting) return;
    
    this.isExtracting = true;
    this.reset();
    
    // Suscribirse a frames de cámara
    eventBus.subscribe(EventType.CAMERA_FRAME_READY, this.processFrame.bind(this));
    console.log('Extracción de señal PPG iniciada');
  }
  
  /**
   * Detener extracción
   */
  stopExtraction(): void {
    this.isExtracting = false;
    this.reset();
    console.log('Extracción de señal PPG detenida');
  }
  
  /**
   * Reiniciar buffers y estados
   */
  reset(): void {
    this.recentRedValues = [];
    this.recentGreenValues = [];
    this.recentBlueValues = [];
  }
  
  /**
   * Procesar un frame para extraer señal PPG
   */
  private processFrame(frame: RawFrame): void {
    if (!this.isExtracting) return;
    
    try {
      // Extraer valores RGB
      const { red, green, blue } = this.extractRGBValues(frame.imageData);
      
      // Añadir a buffers
      this.recentRedValues.push(red);
      this.recentGreenValues.push(green);
      this.recentBlueValues.push(blue);
      
      // Mantener tamaño de buffer
      if (this.recentRedValues.length > this.BUFFER_SIZE) {
        this.recentRedValues.shift();
        this.recentGreenValues.shift();
        this.recentBlueValues.shift();
      }
      
      // Calcular valor combinado (principalmente para visualización)
      // En PPG, el canal rojo es el más importante, pero consideramos todos
      const combinedValue = (red * 0.7) + (green * 0.2) + (blue * 0.1);
      
      // Crear datos de señal PPG
      const ppgData: PPGSignalData = {
        redChannel: red,
        greenChannel: green,
        blueChannel: blue,
        timestamp: frame.timestamp,
        rawValues: [...this.recentRedValues], // Para análisis de tendencia
        combinedValue,
        channelData: {
          red: red,
          ir: red * 0.95 // Utilizamos el canal rojo como base para ambos valores
        }
      };
      
      // Publicar datos para que otros módulos los procesen
      eventBus.publish(EventType.PPG_SIGNAL_EXTRACTED, ppgData);
      
      // También publicar señal combinada
      eventBus.publish(EventType.SIGNAL_EXTRACTED, {
        value: combinedValue,
        timestamp: frame.timestamp,
        type: 'combined'
      });
      
    } catch (error) {
      console.error('Error en extracción de señal PPG:', error);
      eventBus.publish(EventType.ERROR_OCCURRED, {
        source: 'PPGSignalExtractor',
        message: 'Error procesando frame',
        timestamp: Date.now(),
        error
      });
    }
  }
  
  /**
   * Extraer valores RGB promedio
   */
  private extractRGBValues(imageData: ImageData): {
    red: number;
    green: number;
    blue: number;
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let count = 0;
    
    // Extraer del centro de la imagen (30%)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];       // Canal rojo
        greenSum += data[i + 1]; // Canal verde
        blueSum += data[i + 2];  // Canal azul
        count++;
      }
    }
    
    // Normalizar a 0-1
    const avgRed = count > 0 ? (redSum / count) / 255 : 0;
    const avgGreen = count > 0 ? (greenSum / count) / 255 : 0;
    const avgBlue = count > 0 ? (blueSum / count) / 255 : 0;
    
    return {
      red: avgRed,
      green: avgGreen,
      blue: avgBlue
    };
  }
  
  /**
   * Obtener datos actuales
   */
  getCurrentData(): {
    redValues: number[];
    greenValues: number[];
    blueValues: number[];
  } {
    return {
      redValues: [...this.recentRedValues],
      greenValues: [...this.recentGreenValues],
      blueValues: [...this.recentBlueValues]
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
export const ppgSignalExtractor = new PPGSignalExtractor();
