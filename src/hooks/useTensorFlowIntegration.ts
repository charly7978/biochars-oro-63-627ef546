/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import * as tf from '@tensorflow/tfjs';
import { useEffect, useState } from 'react';
import { logSignalProcessing } from '../utils/signalNormalization';

interface ModelStatus {
  isModelLoaded: boolean;
  modelLoadProgress: number;
  modelLoadError: string | null;
}

export const useTensorFlowIntegration = (modelURL: string) => {
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    isModelLoaded: false,
    modelLoadProgress: 0,
    modelLoadError: null
  });

  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("TensorFlow: Starting model loading...");
        
        const loadedModel = await tf.loadGraphModel(modelURL, {
          onProgress: (fraction) => {
            console.log(`TensorFlow: Model loading progress: ${fraction}`);
            setModelStatus(prev => ({
              ...prev,
              modelLoadProgress: fraction
            }));
          }
        });

        setModel(loadedModel);
        setModelStatus({
          isModelLoaded: true,
          modelLoadProgress: 1,
          modelLoadError: null
        });

        console.log("TensorFlow: Model loaded successfully.");
      } catch (error: any) {
        console.error("TensorFlow: Error loading model:", error);
        logSignalProcessing("TensorFlow integration error", error);
        
        setModelStatus({
          isModelLoaded: false,
          modelLoadProgress: 0,
          modelLoadError: error.message || "Failed to load model"
        });
      }
    };

    loadModel();

    return () => {
      console.log("TensorFlow: Cleaning up model.");
      if (model) {
        model.dispose();
      }
    };
  }, [modelURL]);

  const isReady = !!modelStatus as boolean;

  return { model, modelStatus, isReady };
};
