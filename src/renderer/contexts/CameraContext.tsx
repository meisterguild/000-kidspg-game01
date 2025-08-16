import React, { createContext, useContext, useEffect, useState } from 'react';
import { cameraService } from '../services/camera-service';

interface CameraContextType {
  isReady: boolean;
  isUsingDummy: boolean;
  error: string | null;
  reinitialize: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isUsingDummy, setIsUsingDummy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeCamera = async () => {
    try {
      setError(null);
      await cameraService.initialize();
      setIsReady(cameraService.isReady());
      setIsUsingDummy(cameraService.isUsingDummy());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('CameraContext - Initialization failed:', err);
    }
  };

  const reinitialize = async () => {
    setIsReady(false);
    await initializeCamera();
  };

  useEffect(() => {
    initializeCamera();

    // クリーンアップ
    return () => {
      cameraService.destroy();
    };
  }, []);

  const value = {
    isReady,
    isUsingDummy,
    error,
    reinitialize
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = (): CameraContextType => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};