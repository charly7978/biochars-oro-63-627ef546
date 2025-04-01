
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Heart } from 'lucide-react';

interface HeartbeatQualityCardProps {
  currentBPM: number;
  confidence: number;
  arrhythmiaDetected: boolean;
  signalStrength: 'strong' | 'moderate' | 'weak' | 'unknown';
  rrIntervalQuality: number;
}

const HeartbeatQualityCard: React.FC<HeartbeatQualityCardProps> = ({
  currentBPM,
  confidence,
  arrhythmiaDetected,
  signalStrength,
  rrIntervalQuality
}) => {
  const getSignalStrengthColor = () => {
    switch (signalStrength) {
      case 'strong': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'weak': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getHeartRateClass = () => {
    if (currentBPM === 0) return 'text-gray-400';
    if (currentBPM < 60) return 'text-blue-500';
    if (currentBPM > 100) return 'text-red-500';
    return 'text-green-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          Cardiac Signal
          <span className={`text-sm font-normal ${getSignalStrengthColor()}`}>
            {typeof signalStrength === 'string' ? signalStrength.toUpperCase() : 'UNKNOWN'}
          </span>
        </CardTitle>
        <CardDescription>
          Heartbeat signal quality and metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Heart className={`h-6 w-6 mr-2 ${getHeartRateClass()}`} />
              <span className={`text-2xl font-bold ${getHeartRateClass()}`}>
                {currentBPM || '--'}
              </span>
              <span className="text-xs ml-1 text-gray-500">BPM</span>
            </div>
            
            {arrhythmiaDetected && (
              <Badge variant="destructive" className="flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Arrhythmia
              </Badge>
            )}
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Confidence</span>
              <span className="text-sm font-semibold">{Math.round(confidence * 100)}%</span>
            </div>
            <Progress value={confidence * 100} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">RR Interval Quality</span>
              <span className="text-sm font-semibold">{Math.round(rrIntervalQuality)}%</span>
            </div>
            <Progress value={rrIntervalQuality} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Peak Detection</div>
              <div className="font-semibold">
                {confidence > 0.7 ? 'Optimal' : confidence > 0.4 ? 'Acceptable' : 'Poor'}
              </div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Heart Rate Status</div>
              <div className="font-semibold">
                {currentBPM === 0 ? 'Not Detected' : 
                 currentBPM < 60 ? 'Bradycardia' : 
                 currentBPM > 100 ? 'Tachycardia' : 'Normal'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HeartbeatQualityCard;
