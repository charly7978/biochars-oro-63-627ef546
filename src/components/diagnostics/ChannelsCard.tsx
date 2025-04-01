
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ChannelInfo {
  quality: number;
  active: boolean;
}

interface ChannelsCardProps {
  channels: {
    cardiac: ChannelInfo;
    spo2: ChannelInfo;
    glucose: ChannelInfo;
    lipids: ChannelInfo;
    bloodPressure: ChannelInfo;
  };
}

const ChannelsCard: React.FC<ChannelsCardProps> = ({ channels }) => {
  const getStatusColor = (quality: number) => {
    if (quality >= 70) return 'bg-green-500';
    if (quality >= 40) return 'bg-yellow-500';
    if (quality > 0) return 'bg-red-500';
    return 'bg-gray-300';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Signal Channels</CardTitle>
        <CardDescription>
          Specialized channel quality and status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm flex items-center">
              <div className={`h-2 w-2 rounded-full mr-1 ${channels.cardiac.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Cardiac Channel
            </span>
            <span className="text-sm font-semibold">{Math.round(channels.cardiac.quality)}%</span>
          </div>
          <Progress value={channels.cardiac.quality} className="h-2" 
            indicatorClassName={getStatusColor(channels.cardiac.quality)} />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm flex items-center">
              <div className={`h-2 w-2 rounded-full mr-1 ${channels.spo2.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              SpO2 Channel
            </span>
            <span className="text-sm font-semibold">{Math.round(channels.spo2.quality)}%</span>
          </div>
          <Progress value={channels.spo2.quality} className="h-2" 
            indicatorClassName={getStatusColor(channels.spo2.quality)} />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm flex items-center">
              <div className={`h-2 w-2 rounded-full mr-1 ${channels.bloodPressure.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Blood Pressure Channel
            </span>
            <span className="text-sm font-semibold">{Math.round(channels.bloodPressure.quality)}%</span>
          </div>
          <Progress value={channels.bloodPressure.quality} className="h-2" 
            indicatorClassName={getStatusColor(channels.bloodPressure.quality)} />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm flex items-center">
              <div className={`h-2 w-2 rounded-full mr-1 ${channels.glucose.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Glucose Channel
            </span>
            <span className="text-sm font-semibold">{Math.round(channels.glucose.quality)}%</span>
          </div>
          <Progress value={channels.glucose.quality} className="h-2" 
            indicatorClassName={getStatusColor(channels.glucose.quality)} />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm flex items-center">
              <div className={`h-2 w-2 rounded-full mr-1 ${channels.lipids.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              Lipids Channel
            </span>
            <span className="text-sm font-semibold">{Math.round(channels.lipids.quality)}%</span>
          </div>
          <Progress value={channels.lipids.quality} className="h-2" 
            indicatorClassName={getStatusColor(channels.lipids.quality)} />
        </div>
      </CardContent>
    </Card>
  );
};

export default ChannelsCard;
