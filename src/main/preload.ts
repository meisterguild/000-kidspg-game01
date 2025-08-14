import { contextBridge, ipcRenderer } from 'electron';
import type { GameResult } from '@shared/types';

// Renderer側で使用可能なAPI定義
const electronAPI = {
  // 写真を保存し、結果保存用のディレクトリを作成する
  savePhoto: (imageData: string) => ipcRenderer.invoke('save-photo', imageData),

  // JSONデータを指定されたディレクトリに保存する
  saveJson: (dirPath: string, jsonData: GameResult) =>
    ipcRenderer.invoke('save-json', dirPath, jsonData),

  // ランキングウィンドウ制御
  showRankingWindow: () => ipcRenderer.invoke('show-ranking-window'),
  closeRankingWindow: () => ipcRenderer.invoke('close-ranking-window'),

  // プラットフォーム情報
  platform: process.platform,
};

// contextBridgeを使ってRenderer側にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript用の型定義を追加
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}