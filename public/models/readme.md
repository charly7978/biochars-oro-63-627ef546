
# Neural Network Models Directory

This directory contains TensorFlow.js models for vital signs measurements.

## Model Structure

Each model should be placed in its own subdirectory:

- `heart-rate/` - Heart rate estimation model
- `spo2/` - SpO2 estimation model
- `blood-pressure/` - Blood pressure estimation model  
- `glucose/` - Glucose estimation model
- `arrhythmia/` - Arrhythmia detection model

## Model Format

Models should be saved in TensorFlow.js format, typically including:
- `model.json` - Model architecture and weights reference
- `*.bin` - Weight files

## Adding Models

To add a model, create the appropriate subdirectory and copy the model files.
For example:
```
public/models/heart-rate/model.json
public/models/heart-rate/weights.bin
```

## Model Conversion

Models can be converted from various formats (TF SavedModel, Keras, PyTorch) to TensorFlow.js using the tfjs-converter.
