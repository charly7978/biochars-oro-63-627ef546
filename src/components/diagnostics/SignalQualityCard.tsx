
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SignalQualityCardProps {
  quality: number;
  status: 'good' | 'moderate' | 'poor' | 'unknown';
  noiseLevel: number;
  stabilityScore: number;
}

const SignalQualityCard: React.FC<SignalQualityCardProps> = ({
  quality,
  status,
  noiseLevel,
  stabilityScore
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          Signal Quality
          <span className={`text-sm font-normal ${getStatusColor()}`}>
            {status.toUpperCase()}
          </span>
        </CardTitle>
        <CardDescription>
          Raw signal metrics and quality assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Quality</span>
              <span className="text-sm font-semibold">{Math.round(quality)}%</span>
            </div>
            <Progress value={quality} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Noise Level</span>
              <span className="text-sm font-semibold">{noiseLevel.toFixed(4)}</span>
            </div>
            <Progress 
              value={Math.min(100, noiseLevel * 200)} 
              className="h-2 bg-gray-200" 
              indicatorClassName="bg-red-500" 
            />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Stability</span>
              <span className="text-sm font-semibold">{Math.round(stabilityScore)}%</span>
            </div>
            <Progress value={stabilityScore} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Signal Type</div>
              <div className="font-semibold">PPG</div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Processing Mode</div>
              <div className="font-semibold">Real-time</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignalQualityCard;
