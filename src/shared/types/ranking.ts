// src/shared/types/ranking.ts

export interface RecentEntry {
  resultPath: string;
  memorialCardPath: string;
  score: number;
  playedAt: string; // YYYY-MM-DD HH:MM:SS format
}

export interface RankingTopEntry {
  resultPath: string;
  memorialCardPath: string;
  score: number;
  rank: number;
}

export interface RankingData {
  recent: RecentEntry[];
  ranking_top: RankingTopEntry[];
}

// This might be the structure of the individual result.json files
// The specification doesn't explicitly define GameResult, but it's implied
// by the fields in RecentEntry and RankingTopEntry.
// I'll make a basic assumption for now, and refine if needed.
export interface GameResult {
  nickname: string;
  score: number;
  level: string;
  timestamp: string; // Assuming this is the timestamp used for YYYYMMDD_HHMMSS directory
  // Add other fields if they are present in the actual result.json files
}
