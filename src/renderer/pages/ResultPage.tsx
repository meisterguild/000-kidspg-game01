import React, { useEffect, useState } from 'react';
import { calculateLevel, calculateRank, generateJSTTimestamp, generateSafeFileName } from '@shared/utils/helpers';
import type { GameResult } from '@shared/types';
import { playSound } from '../utils/assets';

interface ResultPageProps {
  score: number;
  nickname: string;
  capturedImage: string;
  onRestart: () => void;
}

const ResultPage: React.FC<ResultPageProps> = ({ 
  score, 
  nickname, 
  capturedImage, 
  onRestart 
}) => {
  const [level, setLevel] = useState('');
  const [rank, setRank] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [autoRestartTimer, setAutoRestartTimer] = useState(30);

  useEffect(() => {
    const levelValue = calculateLevel(score);
    const rankValue = calculateRank(score);
    setLevel(levelValue);
    setRank(rankValue);

    const performSave = async () => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const timestamp = generateJSTTimestamp();
        const fileName = generateSafeFileName(nickname, timestamp);
        
        let imagePath = '';
        if (capturedImage && window.electronAPI) {
          const imageResult = await window.electronAPI.saveImageFile(
            capturedImage, 
            `${fileName}.png`
          );
          if (imageResult.success) {
            imagePath = imageResult.filepath;
          }
        }

        const gameResult: GameResult = {
          nickname,
          rank: rankValue,
          level: levelValue,
          score,
          timestampJST: timestamp,
          imagePath: imagePath
        };

        if (window.electronAPI) {
          const resultSave = await window.electronAPI.saveGameResult(gameResult);
          if (resultSave.success) {
            console.log('ゲーム結果を保存しました:', resultSave.filepath);
          } else {
            console.error('結果保存エラー:', resultSave.error);
          }
        }
      } catch (error) {
        console.error('結果保存中にエラーが発生しました:', error);
      } finally {
        setIsSaving(false);
      }
    };

    performSave();
  }, [score, nickname, capturedImage, isSaving]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setAutoRestartTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          onRestart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [onRestart]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        // スペースバー/Enter押下時にbuttonClick音を再生
        playSound('buttonClick').catch(err => {
          console.warn('ボタンクリック音の再生エラー:', err);
        });
        onRestart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onRestart]);

  return (
    <div className="screen-container">
      <h1 className="game-title">ゲーム終了！</h1>
      <div className="result-card">
        {capturedImage && (
          <div className="mb-6">
            <img 
              src={capturedImage} 
              alt="プレイヤー"
              className="w-32 h-32 rounded-full mx-auto border-4 border-yellow-400"
            />
          </div>
        )}
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">{nickname}</h2>
        <div className="score-display text-center">スコア: {score.toLocaleString()}</div>
        <div className="level-display text-center">レベル: {level}</div>
        <div className="rank-display text-center">ランク: {rank}</div>
        {isSaving && (
          <div className="text-center text-blue-400 mt-4">記録を保存中...</div>
        )}
      </div>
      <div className="mt-8 space-y-4 text-center">
        <button 
          className="game-button"
          onClick={() => {
            playSound('buttonClick');
            onRestart();
          }}
        >
          もう一度プレイ (Space)
        </button>
        <p className="text-gray-400">{autoRestartTimer}秒後に自動的にトップ画面に戻ります</p>
        <p className="text-sm text-gray-500">Escキーでいつでもトップに戻れます</p>
      </div>
    </div>
  );
};

export default ResultPage;