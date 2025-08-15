import React, { useEffect } from 'react';
import { preloadSpecificAssets, isAssetsLoaded, playSound } from './utils/assets';
import { ALL_BACKGROUND_ASSETS } from '@shared/utils/constants';
import { ScreenProvider, useScreen } from './contexts/ScreenContext';
import { GameSessionProvider, useGameSession } from './contexts/GameSessionContext';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';

// ページコンポーネントのインポート
import TopPage from './pages/TopPage';
import CameraPage from './pages/CameraPage';
import CountdownPage from './pages/CountdownPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import { TestPage } from './test/TestPage';

// 画面のレンダリングと副作用を担当するコンポーネント
const AppContent: React.FC = () => {
  const { currentScreen, setCurrentScreen, assetsLoaded, setAssetsLoaded } = useScreen();
  const { resetGameState } = useGameSession();
  const { loading: configLoading, error: configError } = useConfig();

  // アセット読み込み
  useEffect(() => {
    const initializeAssets = async () => {
      try {
        if (!isAssetsLoaded()) {
          await preloadSpecificAssets(ALL_BACKGROUND_ASSETS);
        }
        setAssetsLoaded(true);
      } catch (error) {
        console.error('バックグラウンドアセット読み込みエラー:', error);
        setAssetsLoaded(true); // エラーでも続行
      }
    };
    initializeAssets();
  }, [setAssetsLoaded]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        playSound('paltu');
        setCurrentScreen('TOP');
        resetGameState();
      } else if (event.key === 't' || event.key === 'T') {
        setCurrentScreen('TEST');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentScreen, resetGameState]);

  // アセット読み込み中の表示
  if (!assetsLoaded || configLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">読み込み中...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  // Display error if config loading failed
  if (configError) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500">
        <div className="text-center">
          <div className="text-2xl mb-4">設定ファイルの読み込みエラー:</div>
          <div className="text-lg">{configError}</div>
          <div className="text-sm text-gray-400 mt-4">アプリケーションを再起動してください。</div>
        </div>
      </div>
    );
  }

  // 現在の画面に応じたコンポーネントをレンダリング
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'TOP':
        return <TopPage />;
      case 'CAMERA':
        return <CameraPage />;
      case 'COUNTDOWN':
        return <CountdownPage />;
      case 'GAME':
        return <GamePage />;
      case 'RESULT':
        return <ResultPage />;
      case 'TEST':
        return <TestPage />;
      default:
        return <TopPage />;
    }
  };

  return <div className="app">{renderCurrentScreen()}</div>;
};

// AppコンポーネントはProviderをまとめる役割
const App: React.FC = () => {
  return (
    <ScreenProvider>
      <GameSessionProvider>
        <ConfigProvider>
          <AppContent />
        </ConfigProvider>
      </GameSessionProvider>
    </ScreenProvider>
  );
};

export default App;