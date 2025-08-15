import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PixiGameEngine } from '../game/PixiGameEngine';
import { isPixiAssetsPreloaded, playSound } from '../utils/assets';
import { useGameSession } from '../contexts/GameSessionContext';
import { useConfig } from '../contexts/ConfigContext';

const GamePage: React.FC = () => {
  const { handleGameEnd } = useGameSession();
  const { config, loading: configLoading, error: configError } = useConfig();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameEngineRef = useRef<PixiGameEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ゲームエンジンへの入力送信
  const handleMoveLeft = useCallback(() => {
    if (gameEngineRef.current) {
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      window.dispatchEvent(leftEvent);
    }
  }, []);

  const handleMoveRight = useCallback(() => {
    if (gameEngineRef.current) {
      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      window.dispatchEvent(rightEvent);
    }
  }, []);

  useEffect(() => {
    // gameContainerRef.current が利用可能になってから処理を開始
    if (!gameContainerRef.current) {
      // このエラーは通常発生しないはずですが、念のため残します
      setError('ゲーム描画エリアの準備に失敗しました。');
      setIsLoading(false);
      return;
    }

    // configがまだロードされていない、またはエラーがある場合は処理を中断
    if (configLoading || configError || !config) {
      setIsLoading(true); // configがロードされるまでローディング状態を維持
      if (configError) {
        setError(`設定の読み込みエラー: ${configError}`);
      }
      return;
    }

    const initializeGame = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        
        const initPromise = new Promise<PixiGameEngine>((resolve, reject) => {
          (async () => {
            if (abortController.signal.aborted) {
              reject(new Error('初期化がキャンセルされました'));
              return;
            }
            try {
              const gameEngine = new PixiGameEngine(config);
              // gameContainerRef.current はこの時点で存在するはず
              const container = gameContainerRef.current;
              if (!container) {
                reject(new Error('ゲームコンテナが見つかりません'));
                return;
              }
              await gameEngine.initialize(container);
              
              if (abortController.signal.aborted) {
                gameEngine.destroy();
                reject(new Error('初期化がキャンセルされました'));
                return;
              }
              resolve(gameEngine);
            } catch (err) {
              reject(err);
            }
          })();
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('初期化が15秒でタイムアウトしました'));
          }, 15000);
          abortController.signal.addEventListener('abort', () => clearTimeout(timeoutId));
        });
        
        const gameEngine = await Promise.race([initPromise, timeoutPromise]);
        
        if (abortController.signal.aborted) {
          gameEngine.destroy();
          return;
        }
        
        gameEngine.setGameOverCallback((score: number) => {
          if (!abortController.signal.aborted) {
            setTimeout(() => {
              playSound('screenChange').catch(err => {
                console.warn('結果画面遷移音の再生エラー:', err);
              });
              setTimeout(() => {
                handleGameEnd(score);
              }, 100);
            }, 1400);
          }
        });

        gameEngineRef.current = gameEngine;
        setError(null);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('ゲーム初期化エラー:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setError(`ゲームの初期化に失敗しました: ${errorMessage}`);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    initializeGame();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (gameEngineRef.current) {
        gameEngineRef.current.destroy();
        gameEngineRef.current = null;
      }
    };
  }, [handleGameEnd, config, configError, configLoading]);

  return (
    <div className="screen-container min-h-screen flex flex-col items-center p-2 sm:p-4">
      {/* メインゲーム画面（上部） */}
      <div className="w-full max-w-4xl flex flex-col items-center">
        <div className="relative w-full flex justify-center mb-4">
          {/* ローディングとエラー表示のオーバーレイ */}
          {(isLoading || error) && (
            <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-20 rounded-lg">
              {isLoading && (
                <>
                  <div className="text-2xl text-gray-300 mb-4">ゲームを読み込み中...</div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <div className="text-sm text-gray-500 mt-4">
                    {isPixiAssetsPreloaded() 
                      ? '高速初期化中...' 
                      : '初期化中... (最大15秒)'
                    }
                  </div>
                </>
              )}
              {error && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                  <div className="text-2xl text-red-400 mb-4">⚠️ ゲームエラー</div>
                  <div className="text-gray-300 max-w-md">{error}</div>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    ゲームを再読み込み
                  </button>
                  <div className="text-sm text-gray-500 mt-2">Escキーでトップ画面に戻ることもできます</div>
                </div>
              )}
            </div>
          )}
          
          {/* ゲームコンテナ */}
          <div 
            ref={gameContainerRef}
            className="border-2 border-gray-600 rounded-lg overflow-hidden bg-black w-full"
            style={{ 
              maxWidth: '800px',
              width: '100%',
              height: 'min(600px, calc(100vh - 250px))',
              aspectRatio: '4/3',
              // 初期化中はコンテナを非表示にするが、レイアウトは維持
              visibility: isLoading ? 'hidden' : 'visible'
            }}
          />
        </div>

        {/* 左右移動ボタン（横並び） */}
        <div className="flex justify-center items-center gap-8 sm:gap-20 mb-4">
          <button
            onMouseDown={handleMoveLeft}
            onTouchStart={handleMoveLeft}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-3xl sm:text-4xl rounded-lg border-2 border-gray-500 transition-colors select-none shadow-lg"
          >
            ←
          </button>
          
          <button
            onMouseDown={handleMoveRight}
            onTouchStart={handleMoveRight}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-3xl sm:text-4xl rounded-lg border-2 border-gray-500 transition-colors select-none shadow-lg"
          >
            →
          </button>
        </div>

        {/* ゲーム説明メッセージ（下部） */}
        <div className="text-center text-gray-400 space-y-2">
          <div className="text-white text-lg font-bold mb-1">
            上からおちてくるキケンなやつをよけよう！
          </div>
          <div className="text-sm space-y-1">
            <p>← / → キー または 画面ボタンで移動</p>
            <p>Escでゲーム終了</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
