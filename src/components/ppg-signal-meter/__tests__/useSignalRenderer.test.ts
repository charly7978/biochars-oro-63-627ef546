
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignalRenderer } from '../useSignalRenderer';
import * as useCanvasModule from '../useCanvas';
import * as useSignalDataModule from '../useSignalData';
import * as useHeartbeatAudioModule from '../useHeartbeatAudio';

vi.mock('../useCanvas');
vi.mock('../useSignalData');
vi.mock('../useHeartbeatAudio');

describe('useSignalRenderer', () => {
  const mockCanvasHook = {
    canvasRef: { current: document.createElement('canvas') },
    gridCanvasRef: { current: document.createElement('canvas') },
    offscreenCanvasRef: { current: document.createElement('canvas') },
    animationFrameRef: { current: 0 },
    lastRenderTimeRef: { current: 0 },
    drawGrid: vi.fn(),
    drawPeaks: vi.fn(),
    drawSignalSegments: vi.fn(),
    smoothValue: vi.fn((val) => val)
  };

  const mockSignalDataHook = {
    dataBufferRef: { current: { push: vi.fn(), getPoints: vi.fn(() => []) } },
    baselineRef: { current: 0 },
    lastValueRef: { current: 0 },
    peaksRef: { current: [] },
    lastBeepRequestTimeRef: { current: 0 },
    arrhythmiaTransitionRef: { current: { active: false, startTime: 0, endTime: null } },
    arrhythmiaSegmentsRef: { current: [] },
    initBuffer: vi.fn(),
    clearBuffer: vi.fn(),
    detectPeaks: vi.fn(),
    isPointInArrhythmiaSegment: vi.fn(() => false),
    updateArrhythmiaState: vi.fn(),
    resetArrhythmiaData: vi.fn()
  };

  const mockHeartbeatAudioHook = {
    requestBeepForPeak: vi.fn()
  };

  beforeEach(() => {
    vi.spyOn(useCanvasModule, 'useCanvas').mockReturnValue(mockCanvasHook);
    vi.spyOn(useSignalDataModule, 'useSignalData').mockReturnValue(mockSignalDataHook);
    vi.spyOn(useHeartbeatAudioModule, 'useHeartbeatAudio').mockReturnValue(mockHeartbeatAudioHook);
    
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize buffer on mount', () => {
    renderHook(() => useSignalRenderer({ 
      value: 100, 
      isArrhythmia: false, 
      isFingerDetected: true, 
      preserveResults: false 
    }));
    
    expect(mockSignalDataHook.initBuffer).toHaveBeenCalled();
  });

  it('should update arrhythmia state when isArrhythmia changes', () => {
    const { rerender } = renderHook(({ value, isArrhythmia, isFingerDetected, preserveResults }) => 
      useSignalRenderer({ value, isArrhythmia, isFingerDetected, preserveResults }),
      { initialProps: { value: 100, isArrhythmia: false, isFingerDetected: true, preserveResults: false } }
    );
    
    expect(mockSignalDataHook.updateArrhythmiaState).toHaveBeenCalledWith(false);
    
    rerender({ 
      value: 100, 
      isArrhythmia: true, 
      isFingerDetected: true, 
      preserveResults: false 
    });
    
    expect(mockSignalDataHook.updateArrhythmiaState).toHaveBeenCalledWith(true);
  });

  it('should clear buffer when preserveResults is true and no finger detected', () => {
    renderHook(() => useSignalRenderer({ 
      value: 100, 
      isArrhythmia: false, 
      isFingerDetected: false, 
      preserveResults: true 
    }));
    
    expect(mockSignalDataHook.clearBuffer).toHaveBeenCalled();
  });

  it('should set up animation frame on mount', () => {
    renderHook(() => useSignalRenderer({ 
      value: 100, 
      isArrhythmia: false, 
      isFingerDetected: true, 
      preserveResults: false 
    }));
    
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('should clean up animation frame on unmount', () => {
    const { unmount } = renderHook(() => useSignalRenderer({ 
      value: 100, 
      isArrhythmia: false, 
      isFingerDetected: true, 
      preserveResults: false 
    }));
    
    unmount();
    
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });
});
