import React, { useEffect, useCallback } from 'react';
import { SpriteViewerTest } from './SpriteViewerTest';
import { useConfig } from '../contexts/ConfigContext';
import { playSound } from '../utils/assets';

export const TestPage: React.FC = () => {
  const { config, reloadConfig, loading, error } = useConfig();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.location.href = '/'; // トップページにリダイレクト
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleConfigReload = useCallback(async () => {
    try {
      await playSound('buttonClick');
      await reloadConfig();
      alert('設定ファイル（config.json）を再読み込みしました。\n難易度調整が反映されます。');
    } catch (err) {
      console.warn('設定再読み込みエラー:', err);
      alert('設定ファイルの再読み込みに失敗しました。\nconfig.jsonファイルの内容を確認してください。');
    }
  }, [reloadConfig]);

  return (
    <div 
      className="bg-red-950" 
      style={{ 
        minHeight: '100vh', 
        height: '100vh',
        overflowY: 'scroll',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <div className="container mx-auto py-8">
        {/* ページタイトル */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">テスト・設定ページ</h1>
          <p className="text-red-200">ゲームの設定確認・調整およびスプライト表示テスト</p>
          <p className="text-sm text-red-300 mt-1">Escキーでトップページに戻ります</p>
        </div>

        {/* 設定セクション */}
        <div className="mb-12">
          <div className="bg-red-900 border border-red-700 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">⚙️</span>
              ゲーム設定 (config.json)
            </h2>
            
            {loading && (
              <div className="text-yellow-300 mb-4">設定を読み込み中...</div>
            )}
            
            {error && (
              <div className="bg-red-800 border border-red-600 rounded-md p-3 mb-4">
                <p className="text-red-200 font-medium">設定読み込みエラー</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            {config && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="border border-red-600 rounded-lg p-4 bg-red-800">
                    <h3 className="font-medium text-red-200 mb-3">基本設定</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-red-300">レーン数:</span>
                        <span className="font-mono text-yellow-300">{config.game.lane.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">レベルアップ間隔:</span>
                        <span className="font-mono text-yellow-300">{config.game.levelUpScoreInterval} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">ターゲットFPS:</span>
                        <span className="font-mono text-yellow-300">{config.game.targetFPS}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="border border-red-600 rounded-lg p-4 bg-red-800">
                    <h3 className="font-medium text-red-200 mb-3">障害物設定</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-red-300">初期速度:</span>
                        <span className="font-mono text-yellow-300">{config.game.obstacle.speed.min} - {config.game.obstacle.speed.max}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">レベル毎加速:</span>
                        <span className="font-mono text-yellow-300">+{config.game.obstacle.speed.incrementPerLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">生成間隔:</span>
                        <span className="font-mono text-yellow-300">{config.game.obstacle.spawnDistance.max} - {config.game.obstacle.spawnDistance.min}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">間隔減少:</span>
                        <span className="font-mono text-yellow-300">-{config.game.obstacle.spawnDistance.decrementPerLevel}px</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleConfigReload}
                disabled={loading}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-green-500"
              >
                <span>🔄</span>
                {loading ? '読み込み中...' : '設定ファイル再読み込み'}
              </button>
              
              <div className="text-sm text-red-300 flex items-center">
                <span>💡</span>
                <span className="ml-1">config.json編集後にクリックして反映</span>
              </div>
            </div>
          </div>
        </div>

        {/* スプライトテストセクション */}
        <div className="bg-red-900 border border-red-700 rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <span className="mr-2">🎮</span>
              スプライト表示テスト
            </h2>
            <p className="text-sm text-red-200 mt-2">
              ゲーム内で使用されるスプライトの表示確認ができます
            </p>
          </div>
          <div className="w-full overflow-auto">
            <SpriteViewerTest />
          </div>
        </div>
      </div>
    </div>
  );
};