import { contextBridge, ipcRenderer } from 'electron';
import type { GameResult } from '@shared/types';

// Renderer側で使用可能なAPI定義
const electronAPI = {
  // ゲーム結果保存
  saveGameResult: (result: GameResult) => ipcRenderer.invoke('save-game-result', result),
  
  // 画像ファイル保存
  saveImageFile: (imageData: string, filename: string) => 
    ipcRenderer.invoke('save-image-file', imageData, filename),
  
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