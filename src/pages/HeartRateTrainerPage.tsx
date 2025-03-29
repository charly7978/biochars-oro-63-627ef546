
import React, { useState } from 'react';
import { usePPGData } from '../hooks/usePPGData';
import {
  addHeartRateSample,
  trainUserHeartRateModel,
  predictUserHeartRate
} from '../core/HeartRateTrainer';
import { Heart } from 'lucide-react';

const HeartRateTrainerPage: React.FC = () => {
  const { ppgValues } = usePPGData();
  const [realBPM, setRealBPM] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [estimado, setEstimado] = useState<number | null>(null);

  const agregarMuestra = () => {
    if (ppgValues.length < 300) return setMensaje('⏳ Esperando 300 muestras PPG...');
    const valor = parseInt(realBPM);
    if (isNaN(valor)) return setMensaje('❌ Ingresá un BPM válido');
    addHeartRateSample(ppgValues.slice(-300), valor);
    setMensaje('✅ Muestra añadida con éxito');
  };

  const entrenar = async () => {
    await trainUserHeartRateModel();
    setMensaje('✅ Modelo calibrado con tus datos');
  };

  const predecir = async () => {
    const bpm = await predictUserHeartRate(ppgValues.slice(-300));
    setEstimado(bpm);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-6">
      <h2 className="text-xl font-bold text-blue-700 mb-4">🎯 Calibrar Frecuencia Cardíaca (BPM)</h2>

      <div className="w-full max-w-md p-4 bg-white rounded-xl shadow">
        <label className="text-sm font-medium">Tu BPM real (tensiómetro, reloj...)</label>
        <input
          type="number"
          value={realBPM}
          onChange={e => setRealBPM(e.target.value)}
          className="border p-2 w-full mt-1 mb-3 rounded text-sm"
          placeholder="Ej: 76"
        />
        <button
          onClick={agregarMuestra}
          className="w-full py-2 mb-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Agregar muestra
        </button>
        <button
          onClick={entrenar}
          className="w-full py-2 mb-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Entrenar con mis datos
        </button>
        <button
          onClick={predecir}
          className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
        >
          Probar predicción personalizada
        </button>

        {mensaje && <p className="text-xs text-center mt-3 text-gray-700">{mensaje}</p>}
        {estimado && <p className="text-sm text-center mt-3 text-black font-medium">🧠 BPM estimado: {estimado.toFixed(1)}</p>}
      </div>
    </div>
  );
};

export default HeartRateTrainerPage;
