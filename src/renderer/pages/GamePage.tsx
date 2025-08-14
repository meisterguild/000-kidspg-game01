import React, { useEffect, useRef, useState } from 'react';
import { PixiGameEngine } from '../game/PixiGameEngine';
import { isPixiAssetsPreloaded, playSound } from '../utils/assets';

interface GamePageProps {
  onGameEnd: (score: number) => void;
}

const GamePage: React.FC<GamePageProps> = ({ onGameEnd }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameEngineRef = useRef<PixiGameEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // onGameEndの最新値を保持するためのref
  const savedOnGameEnd = useRef(onGameEnd);
  useEffect(() => {
    savedOnGameEnd.current = onGameEnd;
  }, [onGameEnd]);

  useEffect(() => {
    // gameContainerRef.current が利用可能になってから処理を開始
    if (!gameContainerRef.current) {
      // このエラーは通常発生しないはずですが、念のため残します
      setError('ゲーム描画エリアの準備に失敗しました。');
      setIsLoading(false);
      return;
    }

    const initializeGame = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        console.log('PixiGameEngine初期化開始...');
        
        const initPromise = new Promise<PixiGameEngine>((resolve, reject) => {
          (async () => {
            if (abortController.signal.aborted) {
              reject(new Error('初期化がキャンセルされました'));
              return;
            }
            try {
              const gameEngine = new PixiGameEngine();
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
        
        // 最新の onGameEnd を参照する
        gameEngine.setGameOverCallback((score: number) => {
          if (!abortController.signal.aborted) {
            setTimeout(() => {
              // 結果画面切り替え直前に音を再生
              playSound('screenChange').catch(err => {
                console.warn('結果画面遷移音の再生エラー:', err);
              });
              
              // 音声再生後すぐに画面遷移
              setTimeout(() => {
                savedOnGameEnd.current(score);
              }, 100); // 0.1秒後に結果画面へ
            }, 1400); // 1.4秒待ってから音声再生
          }
        });

        gameEngineRef.current = gameEngine;
        setError(null);
        console.log('PixiGameEngine初期化完了');
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
  }, []); // 依存配列は空にし、マウント時に一度だけ実行する

  return (
    <div className="screen-container">
      <div className="absolute top-4 left-4 text-white text-sm space-y-1 z-10">
        <p>← → : 左右移動</p>
        <p>Esc : ゲーム終了</p>
      </div>

      <div className="flex justify-center relative">
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
          className="border-2 border-gray-600 rounded-lg overflow-hidden bg-black"
          style={{ 
            width: '800px', 
            height: '600px',
            // 初期化中はコンテナを非表示にするが、レイアウトは維持
            visibility: isLoading ? 'hidden' : 'visible'
          }}
        />
      </div>

      <div className="mt-4 text-gray-400 text-center max-w-md">
        <p>上から落ちてくる赤い障害物を避けよう！</p>
      </div>
    </div>
  );
};

export default GamePage;
