import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppConfig } from '@shared/types';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  reloadConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (window.electronAPI) {
        const fetchedConfig = await window.electronAPI.getConfig();
        setConfig(fetchedConfig);
      } else {
        // ブラウザ環境でのフォールバック（開発用）
        console.warn('Electron API not available. Using dummy config for browser environment.');
        setConfig({
          game: {
            obstacle: {
              speed: { min: 2.0, max: 50.0, incrementPerLevel: 1.0 },
              spawnDistance: { min: 200, max: 500, decrementPerLevel: 20 },
            },
            lane: { count: 3 },
            levelUpScoreInterval: 50,
            targetFPS: 60,
          },
        });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (window.electronAPI) {
        const result = await window.electronAPI.reloadConfig();
        if (result.success) {
          setConfig(result.config);
        } else {
          setError(result.error || '設定ファイルの再読み込みに失敗しました');
        }
      } else {
        // ブラウザ環境では再読み込みをスキップ
        console.warn('Config reload not available in browser environment.');
      }
    } catch (err) {
      console.error('Failed to reload config:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <ConfigContext.Provider value={{ config, loading, error, reloadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
