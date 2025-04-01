
/**
 * BeatDispatcher
 * 
 * Sistema centralizado de eventos para sincronizar latidos cardíacos
 * entre diferentes componentes de la aplicación.
 */

export type BeatListener = (time: number, position: number) => void;

class BeatDispatcher {
  private listeners: BeatListener[] = [];
  
  /**
   * Registra un nuevo listener para eventos de latido
   * @param listener Función que recibirá el tiempo y posición del latido
   */
  public addListener(listener: BeatListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Elimina un listener previamente registrado
   * @param listener Referencia a la función listener a eliminar
   */
  public removeListener(listener: BeatListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Dispara un evento de latido a todos los listeners registrados
   * @param time Tiempo del latido en segundos (timestamp)
   * @param position Posición relativa en la señal (0-1)
   */
  public dispatchBeat(time: number, position: number): void {
    this.listeners.forEach(listener => {
      try {
        listener(time, position);
      } catch (error) {
        console.error("Error en listener de beatDispatcher:", error);
      }
    });
  }
  
  /**
   * Limpia todos los listeners registrados
   */
  public clearAllListeners(): void {
    this.listeners = [];
  }
}

// Instancia singleton para toda la aplicación
export const beatDispatcher = new BeatDispatcher();
