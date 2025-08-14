import React, { useEffect, useState, useRef } from 'react';
import { calculateLevel, calculateRank, generateJSTTimestamp } from '@shared/utils/helpers';
import type { GameResult } from '@shared/types';
import { playSound } from '../utils/assets';

interface ResultPageProps {
  score: number;
  nickname: string;
  capturedImage: string;
  onRestart: () => void;
  resultDir: string | null;
}

const ResultPage: React.FC<ResultPageProps> = ({ 
  score, 
  nickname, 
  capturedImage, 
  onRestart, 
  resultDir 
}) => {
  const [level, setLevel] = useState('');
  const [rank, setRank] = useState('');
  const [isSaving, setIsSaving] = useState(false); // UI表示用
  const isSavingGuard = useRef(false); // 副作用ガード用
  const [autoRestartTimer, setAutoRestartTimer] = useState(30);

  useEffect(() => {
    const levelValue = calculateLevel(score);
    const rankValue = calculateRank(score);
    setLevel(levelValue);
    setRank(rankValue);

    const performSave = async () => {
      // ガードをチェックし、処理中なら中断
      if (!resultDir || isSavingGuard.current) {
        if (!resultDir) console.log('結果保存ディレクトリが指定されていないため、保存をスキップします。');
        return;
      }
      
      // ガードを立て、UIを「保存中」に更新
      isSavingGuard.current = true;
      setIsSaving(true);

      try {
        const timestamp = generateJSTTimestamp();

        const gameResult: GameResult = {
          nickname,
          rank: rankValue,
          level: levelValue,
          score,
          timestampJST: timestamp,
          imagePath: 'photo.png', // 固定ファイル名
        };

        if (window.electronAPI) {
          const resultSave = await window.electronAPI.saveJson(resultDir, gameResult);
          if (resultSave.success) {
            console.log('ゲーム結果を保存しました:', resultSave.filePath);
          } else {
            console.error('結果保存エラー:', resultSave.error);
            alert(`結果の保存に失敗しました: ${resultSave.error}`);
          }
        }
      } catch (error) {
        console.error('結果保存中にエラーが発生しました:', error);
        alert(`結果の保存中にエラーが発生しました: ${error}`);
      } finally {
        // UIとガードの状態をリセット
        setIsSaving(false);
        isSavingGuard.current = false;
      }
    };

    performSave();
  }, [score, nickname, rank, resultDir]);

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