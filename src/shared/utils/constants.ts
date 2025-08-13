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

// ニックネームオプション
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
  { id: 'flame', text: '炎の魔法使い', category: 'fire' },
  { id: 'icefang', text: '氷牙の狩人', category: 'water' },
  { id: 'stormbringer', text: '嵐を呼ぶ者', category: 'elemental' },
  { id: 'ironfist', text: '鋼鉄の拳', category: 'metal' },
  { id: 'phoenix', text: '不死鳥の魂', category: 'fire' },
  { id: 'nightmare', text: '奈落の影', category: 'dark' },
  { id: 'arcane', text: '秘術の賢者', category: 'magic' },
  { id: 'tidemaster', text: '潮流の支配者', category: 'water' },
  { id: 'thunderlord', text: '雷鳴の王', category: 'elemental' },
  { id: 'obsidian', text: '黒曜の刃', category: 'metal' },
  { id: 'ember', text: '余火の精霊', category: 'fire' },
  { id: 'moonshade', text: '月影の使者', category: 'dark' },
  { id: 'runeseer', text: 'ルーンの預言者', category: 'magic' },
  { id: 'frostwing', text: '氷翼の竜騎士', category: 'water' },
  { id: 'tempest', text: '嵐の化身', category: 'elemental' },
  { id: 'steelheart', text: '鋼の心臓', category: 'metal' },
  { id: 'inferno', text: '地獄の炎', category: 'fire' },
  { id: 'voidwalker', text: '虚無を歩む者', category: 'dark' },
  { id: 'spellbinder', text: '呪縛の術士', category: 'magic' },
  { id: 'wavebreaker', text: '波断ちの勇者', category: 'water' },
  { id: 'skyblade', text: '天空の剣士', category: 'elemental' },
  { id: 'platinum', text: '白金の守護者', category: 'metal' },
  { id: 'blazefang', text: '炎牙の猛者', category: 'fire' },
  { id: 'darkveil', text: '闇幕の潜行者', category: 'dark' },
  { id: 'sorcerer', text: '古代の魔導師', category: 'magic' },
  { id: 'deepsea', text: '深海の探索者', category: 'water' },
  { id: 'windrider', text: '風乗りの旅人', category: 'elemental' },
  { id: 'ironclad', text: '鉄壁の防人', category: 'metal' },
  { id: 'pyromancer', text: '炎術の召喚師', category: 'fire' },
  { id: 'grimreaper', text: '死神の契約者', category: 'dark' },
  { id: 'glacier', text: '氷河の巨人', category: 'water' },
  { id: 'stormcaller', text: '嵐を呼ぶ巫女', category: 'elemental' },
  { id: 'titanium', text: '白鋼の守人', category: 'metal' },
  { id: 'hellfire', text: '地獄火の支配者', category: 'fire' },
  { id: 'darkmoon', text: '暗月の幻影', category: 'dark' },
  { id: 'illusionist', text: '幻術の使い手', category: 'magic' },
  { id: 'whirlpool', text: '渦潮の覇者', category: 'water' },
  { id: 'gale', text: '突風の追跡者', category: 'elemental' },
  { id: 'bronzeclaw', text: '青銅の鉤爪', category: 'metal' },
  { id: 'flamelord', text: '炎帝', category: 'fire' },
  { id: 'shadewalker', text: '影渡りの狩人', category: 'dark' },
  { id: 'spellweaver', text: '魔法の織り手', category: 'magic' },
  { id: 'icelancer', text: '氷槍の兵士', category: 'water' },
  { id: 'windslayer', text: '風斬りの勇士', category: 'elemental' },
  { id: 'cobaltblade', text: '紺碧の刃', category: 'metal' },
  { id: 'emberlord', text: '炎残の王', category: 'fire' },
  { id: 'nightstalker', text: '闇夜の追跡者', category: 'dark' },
  { id: 'manacrystal', text: '魔晶の支配者', category: 'magic' },
  { id: 'tidelord', text: '潮の覇王', category: 'water' },
  { id: 'zephyr', text: '微風の旅人', category: 'elemental' },
  { id: 'ironmaiden', text: '鋼鉄の乙女', category: 'metal' },
  { id: 'wildflame', text: '荒火の戦士', category: 'fire' },
  { id: 'blackfang', text: '黒牙の暗殺者', category: 'dark' },
  { id: 'soulbinder', text: '魂縛の魔導士', category: 'magic' },
  { id: 'frozenheart', text: '凍てつく心', category: 'water' },
  { id: 'thunderfang', text: '雷牙の勇者', category: 'elemental' },
  { id: 'silverstorm', text: '銀嵐の剣士', category: 'metal' },
  { id: 'firebrand', text: '火焔の闘士', category: 'fire' },
  { id: 'darkflame', text: '闇炎の術師', category: 'dark' }
];

// ファイルパス設定
export const FILE_PATHS = {
  results: 'results/',
  cards: 'cards/',
  public: 'public/'
} as const;