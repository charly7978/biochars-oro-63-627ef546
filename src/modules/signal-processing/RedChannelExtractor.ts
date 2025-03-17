
/**
 * Extracts red channel values from camera image data
 */
export class RedChannelExtractor {
  /**
   * Extract average red channel value from the center of the image
   * @param imageData - Raw image data from camera
   * @returns Average red channel value
   */
  public extractRedValue(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let pixelCount = 0;
    
    // Valores de debugging
    console.log("RedChannelExtractor: Processing image", {
      width: imageData.width,
      height: imageData.height,
      dataLength: data.length
    });
    
    if (imageData.width === 0 || imageData.height === 0 || data.length === 0) {
      console.warn("RedChannelExtractor: Invalid image data");
      return 0;
    }
    
    // Analizar solo el centro de la imagen (50% central)
    const centerRegionSize = 0.5; // Usar 50% del centro
    const startX = Math.floor(imageData.width * ((1 - centerRegionSize) / 2));
    const endX = Math.floor(imageData.width * (1 - ((1 - centerRegionSize) / 2)));
    const startY = Math.floor(imageData.height * ((1 - centerRegionSize) / 2));
    const endY = Math.floor(imageData.height * (1 - ((1 - centerRegionSize) / 2)));
    
    console.log("RedChannelExtractor: Analysis region", {
      startX, endX, startY, endY,
      regionWidth: endX - startX,
      regionHeight: endY - startY
    });
    
    // Extraer canal rojo de cada pixel en la región central
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        
        // Asegurarse de que el índice está dentro de los límites
        if (i >= 0 && i < data.length) {
          redSum += data[i]; // Canal rojo (R en RGBA)
          pixelCount++;
        }
      }
    }
    
    if (pixelCount === 0) {
      console.warn("RedChannelExtractor: No pixels analyzed");
      return 0;
    }
    
    const avgRed = redSum / pixelCount;
    
    // Reportar valores para debugging
    if (Math.random() < 0.05) { // Solo reportar ocasionalmente para no saturar la consola
      console.log("RedChannelExtractor: Extracted value", {
        avgRed,
        pixelsAnalyzed: pixelCount,
        timestamp: Date.now()
      });
    }
    
    return avgRed;
  }
}
