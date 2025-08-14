import React, { useState, useCallback, useEffect } from 'react';
import type { GameScreen } from '@shared/types';
import { preloadSpecificAssets, isAssetsLoaded, playSound } from './utils/assets';
import { ALL_BACKGROUND_ASSETS } from '@shared/utils/constants';

// ページコンポーネントのインポート
import TopPage from './pages/TopPage';
import CameraPage from './pages/CameraPage';
import CountdownPage from './pages/CountdownPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';
import { TestPage } from './test/TestPage';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('TOP');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [selectedNickname, setSelectedNickname] = useState<string>('');
  const [gameScore, setGameScore] = useState<number>(0);
  const [assetsLoaded, setAssetsLoaded] = useState<boolean>(false);
  const [resultDir, setResultDir] = useState<string | null>(null); // 結果保存ディレクトリのパス

  // 状態をまとめてリセットする関数
  const resetGameState = useCallback(() => {
    setCapturedImage('');
    setSelectedNickname('');
    setGameScore(0);
    setResultDir(null);
  }, []);

  // 画面遷移ハンドラー
  const handleScreenTransition = useCallback((screen: GameScreen) => {
    setCurrentScreen(screen);
  }, []);

  // カメラで撮影した画像を保存
  const handleImageCapture = useCallback((imageData: string) => {
    setCapturedImage(imageData);
  }, []);

  // ニックネーム選択を保存
  const handleNicknameSelect = useCallback((nickname: string) => {
    setSelectedNickname(nickname);
  }, []);

  // ゲーム終了時のスコア保存
  const handleGameEnd = useCallback((score: number) => {
    setGameScore(score);
    setCurrentScreen('RESULT');
  }, []);

  // アセット読み込み
  useEffect(() => {
    const initializeAssets = async () => {
      try {
        if (!isAssetsLoaded()) {
          console.log('バックグラウンドアセット読み込み開始...');
          await preloadSpecificAssets(ALL_BACKGROUND_ASSETS);
          console.log('バックグラウンドアセット読み込み完了');
        }
        setAssetsLoaded(true);
      } catch (error) {
        console.error('バックグラウンドアセット読み込みエラー:', error);
        setAssetsLoaded(true); // エラーでも続行
      }
    };

    initializeAssets();
  }, []);

  // ESCキーでトップ画面に戻る、Tキーでテスト画面へ
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        playSound('paltu');
        setCurrentScreen('TOP');
        resetGameState(); // 状態をリセット
      } else if (event.key === 't' || event.key === 'T') {
        setCurrentScreen('TEST');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGameState]);

  // 現在の画面に応じたコンポーネントをレンダリング
  const renderCurrentScreen = () => {
    // アセット読み込み中の表示
    if (!assetsLoaded) {
      return (
        <div className="flex items-center justify-center h-screen bg-black text-white">
          <div className="text-center">
            <div className="text-2xl mb-4">読み込み中...</div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      );
    }

    switch (currentScreen) {
      case 'TOP':
        return (
          <TopPage 
            onStart={() => handleScreenTransition('CAMERA')} 
          />
        );
      
      case 'CAMERA':
        return (
          <CameraPage
            onImageCapture={handleImageCapture}
            onNicknameSelect={handleNicknameSelect}
            selectedNickname={selectedNickname}
            onConfirm={() => handleScreenTransition('COUNTDOWN')}
            capturedImage={capturedImage}
            setResultDir={setResultDir} // setResultDir を渡す
          />
        );
      
      case 'COUNTDOWN':
        return (
          <CountdownPage 
            onCountdownEnd={() => handleScreenTransition('GAME')} 
          />
        );
      
      case 'GAME':
        return (
          <GamePage 
            onGameEnd={handleGameEnd}
          />
        );
      
      case 'RESULT':
        return (
          <ResultPage
            score={gameScore}
            nickname={selectedNickname}
            capturedImage={capturedImage}
            resultDir={resultDir} // resultDir を渡す
            onRestart={() => {
              resetGameState(); // 状態をリセット
              handleScreenTransition('TOP');
            }}
          />
        );
      
      case 'TEST':
        return <TestPage />;
      
      default:
        return <TopPage onStart={() => handleScreenTransition('CAMERA')} />;
    }
  };

  return (
    <div className="app">
      {renderCurrentScreen()}
    </div>
  );
};

export default App;