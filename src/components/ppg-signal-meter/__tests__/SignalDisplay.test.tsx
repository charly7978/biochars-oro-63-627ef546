
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignalDisplay from '../SignalDisplay';
import * as useSignalRendererModule from '../useSignalRenderer';

vi.mock('../useSignalRenderer');

describe('SignalDisplay', () => {
  const mockCanvasRef = { current: document.createElement('canvas') };

  beforeEach(() => {
    vi.spyOn(useSignalRendererModule, 'useSignalRenderer').mockReturnValue({
      canvasRef: mockCanvasRef
    });
  });

  it('should render canvas element', () => {
    render(<SignalDisplay 
      value={100} 
      isArrhythmia={false} 
      isFingerDetected={true} 
      preserveResults={false} 
    />);
    
    // Should render a canvas
    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName.toLowerCase()).toBe('canvas');
  });

  it('should pass correct props to useSignalRenderer', () => {
    render(<SignalDisplay 
      value={100} 
      isArrhythmia={false} 
      isFingerDetected={true} 
      preserveResults={false} 
    />);
    
    expect(useSignalRendererModule.useSignalRenderer).toHaveBeenCalledWith({
      value: 100,
      isArrhythmia: false,
      isFingerDetected: true,
      preserveResults: false
    });
  });
});
