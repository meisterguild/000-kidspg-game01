import { contextBridge, ipcRenderer } from 'electron';
import type { GameResult } from '@shared/types';
import type { RankingData } from '@shared/types/ranking';
import type { 
  ComfyUIEventCallback, 
  ComfyUIErrorCallback,
  ComfyUITransformResult,
  ComfyUIStatusResult,
  ComfyUIHealthResult,
  ComfyUIJobsResult
} from '@shared/types/comfyui';

// Renderer側で使用可能なAPI定義
const electronAPI = {
  // 写真を保存し、結果保存用のディレクトリを作成する
  savePhoto: (imageData: string, isDummy?: boolean) => ipcRenderer.invoke('save-photo', imageData, isDummy),

  // JSONデータを指定されたディレクトリに保存する
  saveJson: (dirPath: string, jsonData: GameResult) =>
    ipcRenderer.invoke('save-json', dirPath, jsonData),

  // ランキングウィンドウ制御
  showRankingWindow: () => ipcRenderer.invoke('show-ranking-window'),
  closeRankingWindow: () => ipcRenderer.invoke('close-ranking-window'),

  // 設定情報を取得
  getConfig: () => ipcRenderer.invoke('get-config'),

  // 設定ファイルを再読み込み
  reloadConfig: () => ipcRenderer.invoke('reload-config'),

  // ランキング関連API
  getRankingData: () => ipcRenderer.invoke('ranking:get-data'),
  getRankingConfig: () => ipcRenderer.invoke('ranking:get-config'),
  onRankingDataUpdated: (callback: (data: RankingData) => void) => {
    ipcRenderer.on('ranking:data-updated', (_, data) => callback(data));
  },

  // ComfyUI API
  comfyui: {
    transform: (imageData: string, datetime: string, resultDir: string): Promise<ComfyUITransformResult> =>
      ipcRenderer.invoke('comfyui-transform', imageData, datetime, resultDir),
    getStatus: (): Promise<ComfyUIStatusResult> => ipcRenderer.invoke('comfyui-status'),
    healthCheck: (): Promise<ComfyUIHealthResult> => ipcRenderer.invoke('comfyui-health-check'),
    getActiveJobs: (): Promise<ComfyUIJobsResult> => ipcRenderer.invoke('comfyui-active-jobs'),
    cancelJob: (datetime: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('comfyui-cancel-job', datetime),
    onJobQueued: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-queued', (_, data) => callback(data));
    },
    onJobStarted: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-started', (_, data) => callback(data));
    },
    onJobProcessing: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-processing', (_, data) => callback(data));
    },
    onJobQueueUpdate: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-queue-update', (_, data) => callback(data));
    },
    onJobCompleted: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-completed', (_, data) => callback(data));
    },
    onJobError: (callback: ComfyUIEventCallback) => {
      ipcRenderer.on('comfyui-job-error', (_, data) => callback(data));
    },
    onError: (callback: ComfyUIErrorCallback) => {
      ipcRenderer.on('comfyui-error', (_, data) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('comfyui-job-queued');
      ipcRenderer.removeAllListeners('comfyui-job-started');
      ipcRenderer.removeAllListeners('comfyui-job-processing');
      ipcRenderer.removeAllListeners('comfyui-job-queue-update');
      ipcRenderer.removeAllListeners('comfyui-job-completed');
      ipcRenderer.removeAllListeners('comfyui-job-error');
      ipcRenderer.removeAllListeners('comfyui-error');
    }
  },

  // プラットフォーム情報
  platform: process.platform,

  // 新しいAPI: アセットの絶対パスを取得
  getAssetAbsolutePath: (relativePath: string) => ipcRenderer.invoke('get-asset-absolute-path', relativePath),

  // 終了確認関連API
  getComfyUIStatusForExit: () => ipcRenderer.invoke('get-comfyui-status-for-exit'),
  confirmExit: (confirmed: boolean) => ipcRenderer.invoke('confirm-exit', confirmed),
  onShowExitConfirmation: (callback: (comfyUIStatus: unknown) => void) => {
    ipcRenderer.on('show-exit-confirmation', (_, data) => callback(data));
  },
  removeExitConfirmationListener: () => {
    ipcRenderer.removeAllListeners('show-exit-confirmation');
  },
};

// contextBridgeを使ってRenderer側にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript用の型定義を追加
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}