import React, { useEffect, useState, useCallback } from 'react';
import { calculateLevel, calculateRank, generateJSTTimestamp } from '@shared/utils/helpers';
import type { GameResult, GameRank, GameLevel } from '@shared/types';
import { playSound } from '../utils/assets';
import { useScreen } from '../contexts/ScreenContext';
import { useGameSession } from '../contexts/GameSessionContext';
import { useConfig } from '../contexts/ConfigContext';
import { useSaveGameResult } from '../hooks/useSaveGameResult';

const ResultPage: React.FC = () => {
  const { setCurrentScreen } = useScreen();
  const { config } = useConfig();
  const {
    gameScore,
    selectedNickname,
    capturedImage,
    resultDir,
    resetGameState,
  } = useGameSession();

  const [level, setLevel] = useState<GameLevel | '' >('');
  const [rank, setRank] = useState<GameRank | '' >('');
  const { saveGameResult, isSaving: isSavingHook, error: saveError } = useSaveGameResult();
  const [autoRestartTimer, setAutoRestartTimer] = useState(30);

  const handleRestart = useCallback(() => {
    resetGameState();
    setCurrentScreen('TOP');
  }, [resetGameState, setCurrentScreen]);

  useEffect(() => {
    if (!config) return; // configが読み込まれるまで待機
    
    const levelValue = calculateLevel(gameScore, config.game.levelUpScoreInterval);
    const rankValue = calculateRank(gameScore);
    setLevel(levelValue);
    setRank(rankValue);

    const performSave = async () => {
      if (!resultDir || isSavingHook) {
        return;
      }
      
      // isSavingGuard.current = true; // No longer needed
      // setIsSaving(true); // No longer needed

      try {
        const timestamp = generateJSTTimestamp();

        const gameResult: GameResult = {
          nickname: selectedNickname,
          rank: rankValue,
          level: levelValue,
          score: gameScore,
          timestampJST: timestamp,
          imagePath: 'photo.png',
        };

        const resultSave = await saveGameResult(resultDir, gameResult);
        if (resultSave.success) {
          // 保存成功 - 特に追加処理なし
        } else {
          console.error('結果保存エラー:', saveError || resultSave.error);
          alert(`結果の保存に失敗しました: ${saveError || resultSave.error}`);
        }
      } catch (error) {
        console.error('結果保存中にエラーが発生しました:', error);
        alert(`結果の保存中にエラーが発生しました: ${error}`);
      } finally {
        // setIsSaving(false); // No longer needed
        // isSavingGuard.current = false; // No longer needed
      }
    };

    performSave();
  }, [gameScore, selectedNickname, resultDir, isSavingHook, saveError, saveGameResult, config]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setAutoRestartTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          handleRestart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [handleRestart]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        playSound('buttonClick').catch(err => {
          console.warn('ボタンクリック音の再生エラー:', err);
        });
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleRestart]);

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
        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-400">{selectedNickname}</h2>
        <div className="score-display text-center">スコア: {gameScore.toLocaleString()}</div>
        <div className="level-display text-center">レベル: {level}</div>
        <div className="rank-display text-center">ランク: {rank}</div>
        {isSavingHook && (
          <div className="text-center text-blue-400 mt-4">記録を保存中...</div>
        )}
      </div>
      <div className="mt-8 space-y-4 text-center">
        <button 
          className="game-button"
          onClick={() => {
            playSound('buttonClick');
            handleRestart();
          }}
        >
          おしまい (Space)
        </button>
        <p className="text-gray-400">{autoRestartTimer}秒後に自動的にトップ画面に戻ります</p>
        <p className="text-sm text-gray-500">Escキーでいつでもトップに戻れます</p>
      </div>
    </div>
  );
};

export default ResultPage;
