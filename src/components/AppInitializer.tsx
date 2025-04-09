
import React, { ReactNode } from 'react';
import { useAppInitialization } from '../hooks/useAppInitialization';
import { ErrorHandlingProvider } from './ErrorHandlingProvider';

interface AppInitializerProps {
  children: ReactNode;
}

/**
 * Component that initializes the application and provides error handling
 * with automatic dependency management and self-healing
 */
export function AppInitializer({ children }: AppInitializerProps) {
  // Initialize core systems
  const { isInitialized } = useAppInitialization();
  
  return (
    <ErrorHandlingProvider>
      {children}
    </ErrorHandlingProvider>
  );
}
