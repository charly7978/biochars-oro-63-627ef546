
import React, { useState, useEffect, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorDetection } from '@/hooks/useErrorDetection';
import ErrorBoundary from './ErrorBoundary';

interface ErrorHandlingProviderProps {
  children: ReactNode;
}

/**
 * Error handling provider component that wraps an application
 * with error boundary and monitoring capabilities
 */
export function ErrorHandlingProvider({ children }: ErrorHandlingProviderProps) {
  const {
    errorState,
    attemptRecovery,
    checkForIssues,
    updateStatus
  } = useErrorDetection();
  
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState<boolean>(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);
  
  // Check for issues periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const { hasIssues, criticalIssues, message } = checkForIssues();
      
      setShowWarning(hasIssues);
      setIssueMessage(message);
      setIsCritical(criticalIssues);
      
      // Auto-recovery attempt for non-critical issues
      if (hasIssues && !criticalIssues && !recoveryAttempted) {
        console.log("ErrorHandlingProvider: Auto-recovery attempt for non-critical issue");
        handleRecovery();
        setRecoveryAttempted(true);
        
        // Reset recovery attempt flag after 30 seconds
        setTimeout(() => {
          setRecoveryAttempted(false);
        }, 30000);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [checkForIssues, errorState, recoveryAttempted]);
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    const success = await attemptRecovery();
    if (success) {
      setShowWarning(false);
      updateStatus();
      console.log("ErrorHandlingProvider: Recovery successful");
      
      // Reset arrhythmia detection services if possible
      try {
        if (typeof window !== 'undefined') {
          // Reset any global detection services
          if ((window as any).heartBeatProcessor) {
            (window as any).heartBeatProcessor.reset();
            console.log("ErrorHandlingProvider: Reset heartBeatProcessor");
          }
          
          // Clear any stale RR interval data
          if (localStorage) {
            localStorage.removeItem('arrhythmia_detection_state');
            console.log("ErrorHandlingProvider: Cleared persisted arrhythmia state");
          }
        }
      } catch (error) {
        console.error("ErrorHandlingProvider: Error during additional recovery steps", error);
      }
    } else {
      console.log("ErrorHandlingProvider: Recovery failed");
    }
  };
  
  return (
    <ErrorBoundary
      resetOnPropsChange={false}
      onError={(error) => {
        setShowWarning(true);
        setIssueMessage("React error: " + error.message);
        setIsCritical(true);
      }}
    >
      {/* Show warning banner for non-fatal issues */}
      {showWarning && (
        <Alert
          variant={isCritical ? "destructive" : "warning"}
          className="mb-4 sticky top-0 z-50"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {isCritical ? 'System Error Detected' : 'Warning'}
          </AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between">
            <span>{issueMessage || 'System issues detected'}</span>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
              onClick={handleRecovery}
            >
              <RefreshCw className="h-3 w-3" /> Attempt Recovery
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Render children */}
      {children}
    </ErrorBoundary>
  );
}
