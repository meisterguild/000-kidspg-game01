import React, { useEffect } from 'react';
import { playSound } from '@shared/utils/assets';

interface TopPageProps {
  onStart: () => void;
}

const TopPage: React.FC<TopPageProps> = ({ onStart }) => {
  // Spaceキーでスタート
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        playSound('buttonClick');
        onStart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onStart]);

  return (
    <div className="screen-container">
      <h1 className="game-title">
        よけまくり中
      </h1>
      
      <div className="text-center space-y-8">
        <p className="text-xl md:text-2xl text-gray-300">
          障害物をよけるチャレンジゲーム
        </p>
        
        <div className="space-y-4">
          <p className="text-lg text-gray-400">
            操作方法
          </p>
          <div className="text-base text-gray-500 space-y-2">
            <p>← / → : 左右移動</p>
            <p>Space : スタート・進行・撮影確定</p>
            <p>Esc   : いつでもトップに戻る</p>
          </div>
        </div>
        
        <button 
          className="game-button"
          onClick={() => {
            playSound('buttonClick');
            onStart();
          }}
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