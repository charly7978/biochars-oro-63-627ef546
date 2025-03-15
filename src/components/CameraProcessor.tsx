
import React, { useCallback } from 'react';
import { useSignalProcessor } from '../hooks/useSignalProcessor';

interface CameraProcessorProps {
  isMonitoring: boolean;
  stream: MediaStream;
}

const CameraProcessor: React.FC<CameraProcessorProps> = ({ 
  isMonitoring, 
  stream 
}) => {
  const { processFrame } = useSignalProcessor();
  
  const processCamera = useCallback(async () => {
    if (!isMonitoring || !stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(videoTrack);
    
    // Asegurar que la linterna esté encendida para mediciones de PPG
    if (videoTrack.getCapabilities()?.torch) {
      console.log("Activando linterna para mejorar la señal PPG");
      videoTrack.applyConstraints({
        advanced: [{ torch: true }]
      }).catch(err => console.error("Error activando linterna:", err));
    } else {
      console.warn("Esta cámara no tiene linterna disponible, la medición puede ser menos precisa");
    }
    
    // Crear un canvas de tamaño óptimo para el procesamiento
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', {willReadFrequently: true});
    if (!tempCtx) {
      console.error("No se pudo obtener el contexto 2D");
      return;
    }
    
    // Variables para controlar el rendimiento y la tasa de frames
    let lastProcessTime = 0;
    const targetFrameInterval = 1000/30; // Apuntar a 30 FPS para precisión
    let frameCount = 0;
    let lastFpsUpdateTime = Date.now();
    let processingFps = 0;
    
    // Crearemos un contexto dedicado para el procesamiento de imagen
    const enhanceCanvas = document.createElement('canvas');
    const enhanceCtx = enhanceCanvas.getContext('2d', {willReadFrequently: true});
    enhanceCanvas.width = 320;  // Tamaño óptimo para procesamiento PPG
    enhanceCanvas.height = 240;
    
    const processImage = async () => {
      if (!isMonitoring) return;
      
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;
      
      // Control de tasa de frames para no sobrecargar el dispositivo
      if (timeSinceLastProcess >= targetFrameInterval) {
        try {
          // Capturar frame 
          const frame = await imageCapture.grabFrame();
          
          // Configurar tamaño adecuado del canvas para procesamiento
          const targetWidth = Math.min(320, frame.width);
          const targetHeight = Math.min(240, frame.height);
          
          tempCanvas.width = targetWidth;
          tempCanvas.height = targetHeight;
          
          // Dibujar el frame en el canvas
          tempCtx.drawImage(
            frame, 
            0, 0, frame.width, frame.height, 
            0, 0, targetWidth, targetHeight
          );
          
          // Mejorar la imagen para detección PPG
          if (enhanceCtx) {
            // Resetear canvas
            enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Dibujar en el canvas de mejora
            enhanceCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
            
            // Opcionales: Ajustes para mejorar la señal roja
            enhanceCtx.globalCompositeOperation = 'source-over';
            enhanceCtx.fillStyle = 'rgba(255,0,0,0.05)';  // Sutil refuerzo del canal rojo
            enhanceCtx.fillRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            enhanceCtx.globalCompositeOperation = 'source-over';
          
            // Obtener datos de la imagen mejorada
            const imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
            
            // Procesar el frame mejorado
            processFrame(imageData);
          } else {
            // Fallback a procesamiento normal
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            processFrame(imageData);
          }
          
          // Actualizar contadores para monitoreo de rendimiento
          frameCount++;
          lastProcessTime = now;
          
          // Calcular FPS cada segundo
          if (now - lastFpsUpdateTime > 1000) {
            processingFps = frameCount;
            frameCount = 0;
            lastFpsUpdateTime = now;
            console.log(`Rendimiento de procesamiento: ${processingFps} FPS`);
          }
        } catch (error) {
          console.error("Error capturando frame:", error);
        }
      }
      
      // Programar el siguiente frame
      if (isMonitoring) {
        requestAnimationFrame(processImage);
      }
    };

    processImage();
  }, [isMonitoring, stream, processFrame]);

  React.useEffect(() => {
    if (isMonitoring && stream) {
      processCamera();
    }
  }, [isMonitoring, stream, processCamera]);

  return null; // This is a logic-only component, no UI
};

export default CameraProcessor;
