
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { amplifyHeartbeatRealtime } from '../../utils/signalProcessingUtils';

export class SignalProcessor {
  private readonly PPG_BUFFER_SIZE = 90;
  private readonly SMA_WINDOW = 3;
  private readonly WINDOW_SIZE = 300;
  
  private ppgBuffer: number[] = [];
  private smaBuffer: number[] = [];
  private ppgValues: number[] = [];

  /**
   * Procesa una señal PPG aplicando amplificación y filtrado
   * @param ppgValue Valor PPG crudo
   * @returns Valor PPG procesado
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
      this.ppgBuffer.slice(0, -1), // Excluir el valor actual
      this.PPG_BUFFER_SIZE
    );
    
    // Aplicar filtro SMA al valor amplificado
    const filteredValue = this.applySMAFilter(amplifiedValue);
    
    // Almacenar el valor filtrado
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    return filteredValue;
  }

  /**
   * Obtiene los valores PPG procesados recientes
   * @param count Número de valores a obtener
   * @returns Array con los valores PPG recientes
   */
  public getRecentValues(count: number = 60): number[] {
    return this.ppgValues.slice(-Math.min(count, this.ppgValues.length));
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
   * Reinicia los buffers del procesador
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.smaBuffer = [];
    this.ppgValues = [];
  }
}
