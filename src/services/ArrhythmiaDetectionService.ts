
import { ArrhythmiaWindow } from '../hooks/vital-signs/types';

type ArrhythmiaListener = (window: ArrhythmiaWindow) => void;

class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private listeners: ArrhythmiaListener[] = [];

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  public static addArrhythmiaListener(listener: ArrhythmiaListener): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners.push(listener);
  }

  public static removeArrhythmiaListener(listener: ArrhythmiaListener): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners = service.listeners.filter(l => l !== listener);
  }

  public static notifyArrhythmia(window: ArrhythmiaWindow): void {
    const service = ArrhythmiaDetectionService.getInstance();
    service.listeners.forEach(listener => {
      try {
        listener(window);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }
}

export default ArrhythmiaDetectionService;
