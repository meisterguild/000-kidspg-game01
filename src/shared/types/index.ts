// ゲーム画面状態の型定義
export type GameScreen = 'TOP' | 'CAMERA' | 'COUNTDOWN' | 'GAME' | 'RESULT' | 'TEST';

// プレイ結果データの型定義
export interface GameResult {
  nickname: string;
  rank: string;
  level: string;
  score: number;
  timestampJST: string;
  imagePath: string;
}

// ゲーム設定の型定義
export interface GameConfig {
  lanes: number[];
  laneWidth: number;
  obstacleSpeed: number;
  obstacleCreationInterval: number;
  levelUpScoreInterval: number;
}

// カメラ撮影用の型定義
export interface CameraCapture {
  imageData: string; // Base64エンコードされた画像データ
  timestamp: number;
}

// ニックネーム選択の型定義
export interface NicknameOption {
  id: string;
  text: string;
  category?: string;
}

// Electronメインプロセス⇔レンダラープロセス間のIPC通信用
export interface IPCMessage {
  type: string;
  payload?: unknown;
}