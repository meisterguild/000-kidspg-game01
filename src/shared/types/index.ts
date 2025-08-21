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
export interface AppConfig {
  game: {
    obstacle: {
      speed: {
        min: number;
        max: number;
        incrementPerLevel: number;
      };
      spawnDistance: {
        min: number;
        max: number;
        decrementPerLevel: number;
      };
    };
    lane: {
      count: number;
    };
    levelUpScoreInterval: number;
    targetFPS: number;
  };
  comfyui?: {
    baseUrl: string;
    pollingInterval: number;
    maxConcurrentJobs: number;
    timeouts: {
      upload: number;
      processing: number;
      queue: number;
    };
    retry: {
      maxAttempts: number;
      delayMs: number;
    };
    workflow: {
      templatePath: string;
      outputPrefix: string;
    };
  };
  memorialCard?: {
    enabled: boolean;
    magickTimeout: number;
    cardBaseImagesDir: string;
  };
  results?: {
    maxRecent: number;
    maxRanking: number;
  };
  ranking?: {
    pagination: {
      cardsPerPage: number;
      intervalSeconds: number;
      transitionDurationMs: number;
    };
    card: {
      tileSize: number;
    };
  };
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

// ComfyUI関連の型定義をre-export
export type {
  ComfyUIJobProgressData,
  ComfyUIStatus,
  ComfyUIActiveJob,
  ComfyUITransformResult,
  ComfyUIStatusResult,
  ComfyUIHealthResult,
  ComfyUIJobsResult,
  ComfyUIEventCallback,
  ComfyUIErrorCallback
} from './comfyui';

// Results関連の型定義をre-export
export type {
  RecentResultEntry,
  RankingResultEntry,
  ResultsData
} from './results';