
export interface ArrhythmiaWindow {
  id: string;
  start: number;
  end: number;
  type: 'irregular' | 'bigeminy' | 'tachycardia' | 'bradycardia' | 'forced';
  intensity: number;
}
