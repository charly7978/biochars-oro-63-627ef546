
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProcessingPipelineCardProps {
  framesProcessed: number;
  framesPerSecond: number;
  activeProcessors: string[];
}

const ProcessingPipelineCard: React.FC<ProcessingPipelineCardProps> = ({
  framesProcessed,
  framesPerSecond,
  activeProcessors
}) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Processing Pipeline</CardTitle>
        <CardDescription>
          Signal processing metrics and status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 p-3 rounded text-center">
              <div className="text-xs text-gray-500">Frames Processed</div>
              <div className="text-xl font-bold">{framesProcessed.toLocaleString()}</div>
            </div>
            
            <div className="bg-gray-100 p-3 rounded text-center">
              <div className="text-xs text-gray-500">Frames/Second</div>
              <div className="text-xl font-bold">{framesPerSecond}</div>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium mb-2">Active Processors</div>
            <div className="flex flex-wrap gap-2">
              {activeProcessors.length > 0 ? (
                activeProcessors.map((processor, index) => (
                  <Badge key={index} variant="outline" className="bg-green-50">
                    {processor}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-gray-500">No active processors</div>
              )}
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {framesPerSecond >= 15 
              ? 'Processing pipeline running at optimal speed.'
              : framesPerSecond >= 5
              ? 'Processing pipeline running at acceptable speed.'
              : 'Processing pipeline running slowly.'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingPipelineCard;
