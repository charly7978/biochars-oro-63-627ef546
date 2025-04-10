import { HydrationNeuralModel } from '../../core/neural/HydrationModel';

export class HydrationProcessor {
  private neuralModel: HydrationNeuralModel;

  constructor() {
    this.neuralModel = new HydrationNeuralModel();
  }

  public calculateHydration(ppgSignal: number[]): number {
    if (!ppgSignal || ppgSignal.length < 2) {
      return 0;
    }

    // Usar el modelo neuronal para procesar la señal PPG
    const prediction = this.neuralModel.predict(ppgSignal);
    return prediction[0];
  }

  public reset(): void {
    // Reiniciar estado si es necesario
  }
} 