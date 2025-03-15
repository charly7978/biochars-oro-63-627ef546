
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { amplifyHeartbeatRealtime } from '../../utils/signalProcessingUtils';

/**
 * Procesador especializado para el procesamiento y amplificación de señales PPG
 */
export class PPGProcessor {
  private readonly PPG_BUFFER_SIZE = 90;
  private readonly SMA_WINDOW = 3;
  
  private ppgBuffer: number[] = [];
  private smaBuffer: number[] = [];
  
  /**
   * Procesa y amplifica una señal PPG
   * @param ppgValue Valor actual de PPG
   * @returns Valor PPG filtrado y amplificado
   */
  public processSignal(ppgValue: number): number {
    // Almacenar valor PPG en el buffer para amplificación
    this.ppgBuffer.push(ppgValue);
    if (this.ppgBuffer.length > this.PPG_BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Aplicar amplificación de latido en tiempo real
    const amplifiedValue = amplifyHeartbeatRealtime(
      ppgValue, 
      this.ppgBuffer.slice(0, -1), // Excluir el valor actual que acabamos de agregar
      this.PPG_BUFFER_SIZE
    );
    
    // Aplicar filtro SMA al valor amplificado
    return this.applySMAFilter(amplifiedValue);
  }
  
  /**
   * Aplica un filtro de media móvil simple
   * @param value Valor a filtrar
   * @returns Valor filtrado
   */
  private applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }
  
  /**
   * Reinicia los buffers de procesamiento
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.smaBuffer = [];
  }
}
