import React, { useEffect, useCallback, useState } from 'react';
import { SpriteViewerTest } from './SpriteViewerTest';
import { useConfig } from '../contexts/ConfigContext';
import { playSound } from '../utils/assets';
import type { ComfyUIStatus, ComfyUIActiveJob } from '@shared/types/comfyui';

export const TestPage: React.FC = () => {
  const { config, reloadConfig, loading, error } = useConfig();
  const [comfyUIStatus, setComfyUIStatus] = useState<ComfyUIStatus | null>(null);
  const [comfyUIHealth, setComfyUIHealth] = useState<boolean | null>(null);
  const [comfyUIJobs, setComfyUIJobs] = useState<ComfyUIActiveJob[]>([]);
  const [comfyUILoading, setComfyUILoading] = useState(false);

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

  const refreshComfyUIStatus = useCallback(async () => {
    if (!config?.comfyui) return;
    
    setComfyUILoading(true);
    try {
      const [statusResult, healthResult, jobsResult] = await Promise.all([
        window.electronAPI.comfyui.getStatus(),
        window.electronAPI.comfyui.healthCheck(),
        window.electronAPI.comfyui.getActiveJobs()
      ]);

      setComfyUIStatus(statusResult.success ? statusResult.status : null);
      setComfyUIHealth(healthResult.success ? healthResult.isHealthy : false);
      setComfyUIJobs(jobsResult.success ? jobsResult.jobs : []);
    } catch (error) {
      console.error('ComfyUI status check failed:', error);
      setComfyUIStatus(null);
      setComfyUIHealth(false);
      setComfyUIJobs([]);
    } finally {
      setComfyUILoading(false);
    }
  }, [config]);

  const handleComfyUIRefresh = useCallback(async () => {
    try {
      await playSound('buttonClick');
      await refreshComfyUIStatus();
    } catch (err) {
      console.warn('ComfyUI status refresh error:', err);
    }
  }, [refreshComfyUIStatus]);

  useEffect(() => {
    if (config?.comfyui) {
      refreshComfyUIStatus();
    }
  }, [config, refreshComfyUIStatus]);

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
                    <h3 className="font-medium text-red-200 mb-3">カメラ設定</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-red-300">撮影解像度:</span>
                        <span className="font-mono text-yellow-300">{config.camera?.width || 380} x {config.camera?.height || 380}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-300">画像フォーマット:</span>
                        <span className="font-mono text-yellow-300">{config.camera?.format || 'image/png'}</span>
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

        {/* ComfyUI監視セクション */}
        {config?.comfyui && (
          <div className="mb-12">
            <div className="bg-blue-900 border border-blue-700 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="mr-2">🎨</span>
                ComfyUI画像変換システム
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="border border-blue-600 rounded-lg p-4 bg-blue-800">
                    <h3 className="font-medium text-blue-200 mb-3">サーバー情報</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-300">ベースURL:</span>
                        <span className="font-mono text-yellow-300">{config.comfyui.baseUrl}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">ヘルスチェック:</span>
                        <span className={`font-mono ${comfyUIHealth ? 'text-green-300' : 'text-red-300'}`}>
                          {comfyUIHealth === null ? '確認中...' : comfyUIHealth ? 'OK' : 'NG'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">最大同時ジョブ数:</span>
                        <span className="font-mono text-yellow-300">{config.comfyui.maxConcurrentJobs}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="border border-blue-600 rounded-lg p-4 bg-blue-800">
                    <h3 className="font-medium text-blue-200 mb-3">システム状況</h3>
                    <div className="space-y-2 text-sm">
                      {comfyUIStatus ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-blue-300">アプリ内アクティブ:</span>
                            <span className="font-mono text-yellow-300">{comfyUIStatus.activeJobs?.length || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-300">サーバー実行中:</span>
                            <span className="font-mono text-yellow-300">{comfyUIStatus.serverQueueRunning || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-300">サーバー待機中:</span>
                            <span className="font-mono text-yellow-300">{comfyUIStatus.serverQueuePending || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-300">内部キュー:</span>
                            <span className="font-mono text-yellow-300">{comfyUIStatus.internalQueueLength || 0}</span>
                          </div>
                          {comfyUIStatus.error && (
                            <div className="text-red-300 text-xs">{comfyUIStatus.error}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-blue-300">ステータス取得中...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* アクティブジョブリスト */}
              {comfyUIJobs.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-blue-200 mb-3">アクティブジョブ</h3>
                  <div className="bg-blue-800 border border-blue-600 rounded-lg p-4">
                    <div className="space-y-2">
                      {comfyUIJobs.map((job, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-blue-300">{job.datetime}</span>
                          <span className={`font-mono px-2 py-1 rounded text-xs ${
                            job.status === 'completed' ? 'bg-green-700 text-green-200' :
                            job.status === 'error' ? 'bg-red-700 text-red-200' :
                            job.status === 'processing' ? 'bg-yellow-700 text-yellow-200' :
                            'bg-gray-700 text-gray-200'
                          }`}>
                            {job.status}
                          </span>
                          <span className="text-blue-300">{Math.floor(job.duration / 1000)}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleComfyUIRefresh}
                  disabled={comfyUILoading}
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-blue-500"
                >
                  <span>🔄</span>
                  {comfyUILoading ? 'チェック中...' : 'ステータス更新'}
                </button>
                
                <div className="text-sm text-blue-300 flex items-center">
                  <span>💡</span>
                  <span className="ml-1">ComfyUIサーバーの状態を確認できます</span>
                </div>
              </div>
            </div>
          </div>
        )}

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