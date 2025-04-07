
import { useHeartBeatProcessor as useHeartBeatProcessorInternal } from './heart-beat/useHeartBeatProcessor';
import { UseHeartBeatReturn } from './heart-beat/types';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  return useHeartBeatProcessorInternal();
};
