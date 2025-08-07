
// 日本時間のタイムスタンプを生成
export const generateJSTTimestamp = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + (jstOffset * 60 * 1000));
  
  return jstTime.toISOString().slice(0, 19).replace('T', ' ');
};

// スコアに基づくレベル計算
export const calculateLevel = (score: number): string => {
  if (score >= 1000) return 'MAX';
  if (score >= 800) return 'Lv8';
  if (score >= 600) return 'Lv7';
  if (score >= 450) return 'Lv6';
  if (score >= 300) return 'Lv5';
  if (score >= 200) return 'Lv4';
  if (score >= 120) return 'Lv3';
  if (score >= 60) return 'Lv2';
  return 'Lv1';
};

// スコアに基づく階級計算
export const calculateRank = (score: number): string => {
  if (score >= 1000) return '鬼';
  if (score >= 800) return '竜';
  if (score >= 600) return '虎';
  if (score >= 400) return '鷲';
  if (score >= 250) return '狼';
  if (score >= 150) return '豹';
  if (score >= 80) return '鹿';
  return '兎';
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

// ファイル名用の二つ名から不要な文字を除去
export const sanitizeNickname = (nickname: string): string => {
  return nickname
    .replace(/[^\w\s-]/g, '') // 特殊文字除去
    .replace(/\s+/g, '_') // スペースをアンダースコアに
    .toLowerCase();
};