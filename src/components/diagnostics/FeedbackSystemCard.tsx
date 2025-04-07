
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeedbackSystemCardProps {
  bidirectionalActive: boolean;
  lastFeedbackTime: Date | null;
  feedbackQueue: number;
  adaptations: {component: string, timestamp: Date, adaptation: string}[];
}

const FeedbackSystemCard: React.FC<FeedbackSystemCardProps> = ({
  bidirectionalActive,
  lastFeedbackTime,
  feedbackQueue,
  adaptations
}) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          Feedback System
          <Badge variant={bidirectionalActive ? "default" : "outline"}>
            {bidirectionalActive ? 'Active' : 'Inactive'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Bidirectional feedback and system adaptations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Last Feedback</div>
              <div className="font-semibold">
                {lastFeedbackTime ? lastFeedbackTime.toLocaleTimeString() : 'Never'}
              </div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Feedback Queue</div>
              <div className="font-semibold">{feedbackQueue}</div>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium mb-2">Recent Adaptations</div>
            {adaptations.length > 0 ? (
              <div className="max-h-20 overflow-y-auto space-y-1">
                {adaptations.map((adaptation, i) => (
                  <div key={i} className="text-xs bg-blue-50 p-1 rounded">
                    <span className="font-semibold">{adaptation.component}:</span> {adaptation.adaptation}
                    <span className="text-gray-500 ml-1">
                      ({adaptation.timestamp.toLocaleTimeString()})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No recent adaptations</div>
            )}
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {bidirectionalActive
              ? 'Bidirectional feedback system is actively optimizing signal processing.'
              : 'Bidirectional feedback system is currently inactive.'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedbackSystemCard;
