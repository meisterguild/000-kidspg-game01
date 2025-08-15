import React, { useEffect, useCallback } from 'react';
import { playSound, preloadSpecificAssets, preloadPixiAssets, initializeAudioSystem } from '../utils/assets';
import TitleImageCarousel from '../components/TitleImageCarousel';
import { TOP_PAGE_ASSETS } from '@shared/utils/constants';
import { useScreen } from '../contexts/ScreenContext';

const TopPage: React.FC = () => {
  const { setCurrentScreen } = useScreen();

  // トップページアセットのプリロード
  useEffect(() => {
    preloadSpecificAssets(TOP_PAGE_ASSETS);
  }, []);

  // トップページ表示時にnewtype音を自動再生
  // useEffect(() => {
  //   const playWelcomeSound = async () => {
  //     // 少し遅延してから再生（アセット読み込み完了を待つ）
  //     setTimeout(async () => {
  //       try {
  //         await initializeAudioSystem();
  //         await playSound('newtype', 0.1); // 音量0.5で再生
  //         console.log('🎵 ウェルカム音声（newtype）を再生しました');
  //       } catch (error) {
  //         console.warn('ウェルカム音声の再生に失敗:', error);
  //       }
  //     }, 500); // 1.5秒後に再生
  //   };

  //   playWelcomeSound();
  // }, []);

  // PixiJSアセットのバックグラウンドプリロード（ゲーム準備）
  useEffect(() => {
    const preloadBackground = async () => {
      // 少し遅延してからPixiJSアセットをプリロード（UI応答性を保つため）
      setTimeout(() => {
        preloadPixiAssets().catch(err => {
          console.warn('バックグラウンドPixiJSプリロード失敗:', err);
        });
      }, 2000); // 2秒後に開始
    };
    
    preloadBackground();
  }, []);

  const handleStart = useCallback(async () => {
    try {
      await initializeAudioSystem();
      //await playSound('newtype', 0.1);
      await playSound('buttonClick');
    } catch (err) {
      console.warn('スタート時の音声再生エラー:', err);
    } finally {
      setCurrentScreen('CAMERA');
    }
  }, [setCurrentScreen]);


  // Spaceキーでスタート
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleStart]);

  return (
    <div className="screen-container">
      <TitleImageCarousel />
      
      <div className="text-center space-y-8">
        <p className="text-xl md:text-2xl text-gray-300">
          キケンなやつをよけるチャレンジゲーム
        </p>
        
        <div className="space-y-4">
          <p className="text-lg text-gray-400">
            操作方法
          </p>
          <div className="text-base text-gray-500 space-y-2">
            <p>← / → : 左右移動</p>
            <p>Space : スタート・すすむ・さつえい</p>
            <p>Esc   : いつでもトップにもどる</p>
          </div>
        </div>
        
        <button 
          className="game-button"
          onClick={handleStart}
        >
          スタート（Spaceキー）
        </button>
        
        <div className="absolute top-4 right-4">
          <button 
            className="text-blue-400 hover:text-blue-300 underline"
            onClick={() => window.electronAPI?.showRankingWindow()}
          >
            ランキング表示
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopPage;