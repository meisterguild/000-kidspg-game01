import type { GameConfig, NicknameOption } from '../types';

// ゲーム設定定数
export const GAME_CONFIG: GameConfig = {
  lanes: [-1, 0, 1], // 左、中央、右
  laneWidth: 150,
  obstacleSpeed: 4,
  obstacleCreationInterval: 1500,
  levelUpScoreInterval: 100
};

// ゲーム画面サイズ
export const GAME_CANVAS = {
  width: 800,
  height: 600
} as const;

// カメラ撮影設定
export const CAMERA_CONFIG = {
  width: 500,
  height: 500,
  format: 'image/png' as const
};

// 二つ名オプション
export const NICKNAME_OPTIONS: NicknameOption[] = [
  { id: 'random', text: 'ランダム', category: 'special' },
  { id: 'darkness', text: '漆黒の牙', category: 'dark' },
  { id: 'lightning', text: '雷光の剣士', category: 'elemental' },
  { id: 'crimson', text: '紅蓮の戦士', category: 'fire' },
  { id: 'silver', text: '銀翼の騎士', category: 'metal' },
  { id: 'mystic', text: '神秘の探求者', category: 'magic' },
  { id: 'wind', text: '疾風の忍者', category: 'elemental' },
  { id: 'ocean', text: '蒼海の守護者', category: 'water' },
  { id: 'golden', text: '黄金の覇者', category: 'metal' },
  { id: 'shadow', text: '影の暗殺者', category: 'dark' },
  { id: 'flame', text: '炎の魔法使い', category: 'fire' }
];

// ファイルパス設定
export const FILE_PATHS = {
  results: 'results/',
  cards: 'cards/',
  public: 'public/'
} as const;