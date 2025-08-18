import * as fs from 'fs/promises';
import * as path from 'path';
import type { ResultsData, RecentResultEntry, RankingResultEntry, GameResult, AppConfig } from '@shared/types';

const RESULTS_FILE = 'results.json';

export class ResultsManager {
  private resultsDir: string;
  private resultsFilePath: string;
  private config: AppConfig | null;

  constructor(resultsDir: string, config: AppConfig | null = null) {
    this.resultsDir = resultsDir;
    this.resultsFilePath = path.join(resultsDir, RESULTS_FILE);
    this.config = config;
  }

  async loadResults(): Promise<ResultsData> {
    try {
      const data = await fs.readFile(this.resultsFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      console.log('results.json not found, creating new one');
      return {
        recent: [],
        ranking_top: []
      };
    }
  }

  async saveResults(resultsData: ResultsData): Promise<void> {
    console.log(`Saving results to: ${this.resultsFilePath}`);
    await fs.writeFile(this.resultsFilePath, JSON.stringify(resultsData, null, 2), 'utf-8');
    console.log('Results file saved successfully');
  }

  async updateResults(resultDir: string, gameResult: GameResult): Promise<void> {
    const resultsData = await this.loadResults();
    
    const dirName = path.basename(resultDir);
    const resultPath = `${dirName}/result.json`;
    const memorialCardPath = `${dirName}/memorial_card_${dirName}.png`;
    
    // Format timestamp to yyyy-mm-dd hh:mm:ss
    const playedAt = this.formatTimestamp(gameResult.timestampJST);

    // Update recent list
    const recentEntry: RecentResultEntry = {
      resultPath,
      memorialCardPath,
      score: gameResult.score,
      playedAt
    };

    const maxRecent = this.config?.results?.maxRecent || 10;
    resultsData.recent.unshift(recentEntry);
    if (resultsData.recent.length > maxRecent) {
      resultsData.recent.pop();
    }

    // Update ranking list
    this.updateRanking(resultsData, {
      resultPath,
      memorialCardPath,
      score: gameResult.score
    });

    await this.saveResults(resultsData);
  }

  private updateRanking(resultsData: ResultsData, newEntry: Omit<RankingResultEntry, 'rank'>): void {
    // Find insertion position based on score (descending)
    let insertIndex = 0;
    for (let i = 0; i < resultsData.ranking_top.length; i++) {
      if (newEntry.score >= resultsData.ranking_top[i].score) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    // Insert new entry
    const entryWithRank: RankingResultEntry = {
      ...newEntry,
      rank: insertIndex + 1
    };
    
    resultsData.ranking_top.splice(insertIndex, 0, entryWithRank);

    // Update ranks for all entries
    resultsData.ranking_top.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Remove excess entries
    const maxRanking = this.config?.results?.maxRanking || 10;
    if (resultsData.ranking_top.length > maxRanking) {
      resultsData.ranking_top.splice(maxRanking);
    }
  }

  private formatTimestamp(timestampJST: string): string {
    // Convert from "2025-08-17 09:33:21" format to "2025-08-17 09:33:21" (already correct format)
    return timestampJST;
  }
}