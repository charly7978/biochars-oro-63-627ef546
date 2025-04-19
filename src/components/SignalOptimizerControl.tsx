
import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem, 
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SignalOptimizerManager } from '../modules/signal-optimizer/SignalOptimizerManager';

// Define the interface locally since it's not exported from the module
interface SignalChannelOptimizerParams {
  filterType: 'sma' | 'ema' | 'kalman' | 'none';
  gain: number;
  filterWindow: number;
  emaAlpha: number;
  kalmanQ: number;
  kalmanR: number;
}

interface SignalOptimizerControlProps {
  optimizerManager: SignalOptimizerManager;
}

const filterTypes = [
  { value: 'sma', label: 'SMA' },
  { value: 'ema', label: 'EMA' },
  { value: 'kalman', label: 'Kalman' },
  { value: 'none', label: 'Ninguno' },
];

export const SignalOptimizerControl: React.FC<SignalOptimizerControlProps> = ({ optimizerManager }) => {
  const [selectedChannel, setSelectedChannel] = useState<string>('red');
  const [params, setParams] = useState<SignalChannelOptimizerParams | null>(optimizerManager.getParams(selectedChannel));

  const channels = optimizerManager.getChannels();

  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channel = e.target.value;
    setSelectedChannel(channel);
    setParams(optimizerManager.getParams(channel));
  };

  const handleParamChange = (key: keyof SignalChannelOptimizerParams, value: any) => {
    if (!params) return;
    const newParams = { ...params, [key]: value };
    setParams(newParams);
  };

  const handleApply = () => {
    if (params) {
      optimizerManager.setParams(selectedChannel, params);
    }
  };

  if (!params) return null;

  return (
    <div className="p-4 border rounded-md bg-card max-w-md mx-auto mt-4">
      <h2 className="font-bold mb-2">Ajuste Manual de Optimización de Señal</h2>
      <div className="mb-2">
        <label className="block mb-1">Canal:</label>
        <select value={selectedChannel} onChange={handleChannelChange} className="w-full border rounded px-2 py-1">
          {channels.map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="block mb-1">Tipo de Filtro:</label>
        <Select value={params.filterType} onValueChange={(v) => handleParamChange('filterType', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar filtro" />
          </SelectTrigger>
          <SelectContent>
            {filterTypes.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-2">
        <label className="block mb-1">Ganancia:</label>
        <Slider min={0.5} max={4.0} step={0.05} value={[params.gain]} onValueChange={([v]) => handleParamChange('gain', v)} />
        <span className="ml-2">{params.gain.toFixed(2)}</span>
      </div>
      <div className="mb-2">
        <label className="block mb-1">Ventana de Filtro:</label>
        <Input type="number" min={1} max={30} value={params.filterWindow} onChange={e => handleParamChange('filterWindow', Number(e.target.value))} />
      </div>
      {params.filterType === 'ema' && (
        <div className="mb-2">
          <label className="block mb-1">EMA Alpha:</label>
          <Slider min={0.01} max={1.0} step={0.01} value={[params.emaAlpha]} onValueChange={([v]) => handleParamChange('emaAlpha', v)} />
          <span className="ml-2">{params.emaAlpha.toFixed(2)}</span>
        </div>
      )}
      {params.filterType === 'kalman' && (
        <>
          <div className="mb-2">
            <label className="block mb-1">Kalman Q:</label>
            <Input type="number" step={0.01} value={params.kalmanQ} onChange={e => handleParamChange('kalmanQ', Number(e.target.value))} />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Kalman R:</label>
            <Input type="number" step={0.01} value={params.kalmanR} onChange={e => handleParamChange('kalmanR', Number(e.target.value))} />
          </div>
        </>
      )}
      <Button className="mt-2 w-full" onClick={handleApply}>Aplicar Cambios</Button>
    </div>
  );
};
