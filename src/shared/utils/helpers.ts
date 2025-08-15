
// 日本時間のタイムスタンプを生成
export const generateJSTTimestamp = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + (jstOffset * 60 * 1000));
  
  return jstTime.toISOString().slice(0, 19).replace('T', ' ');
};

// スコアに基づくレベル計算 (config.jsonのlevelUpScoreIntervalに基づく)
export const calculateLevel = (score: number, levelUpScoreInterval: number): string => {
  const level = Math.floor(score / levelUpScoreInterval) + 1;
  if (level >= 20) return 'MAX';
  return `Lv${level}`;
};

// スコアに基づくランク計算
export const calculateRank = (score: number): string => {
  if (score >= 1000) return '伝説級 レジェンド';
  if (score >= 800) return '達人級 マスター';
  if (score >= 600) return '精鋭級 エリート';
  if (score >= 400) return '古参級 ベテラン';
  if (score >= 250) return '熟練級 エキスパート';
  if (score >= 150) return '上級 アドバンス';
  if (score >= 80) return 'アマチュア';
  return '初心者';
};

// ファイル名用の安全な文字列生成
export const generateSafeFileName = (nickname: string, timestamp?: string): string => {
  const cleanNickname = nickname
    .replace(/[^\w\s-]/g, '') // 特殊文字除去
    .replace(/\s+/g, '_') // スペースをアンダースコアに
    .toLowerCase();
  
  const timeStr = timestamp 
    ? timestamp.replace(/[:\s-]/g, '_').substring(0, 15)
    : new Date().toISOString().slice(0, 16).replace(/[:\-T]/g, '_');
  
  return `${cleanNickname}_${timeStr}`;
};

// ファイル名用のニックネームから不要な文字を除去
export const sanitizeNickname = (nickname: string): string => {
  return nickname
    .replace(/[^\w\s-]/g, '') // 特殊文字除去
    .replace(/\s+/g, '_') // スペースをアンダースコアに
    .toLowerCase();
};