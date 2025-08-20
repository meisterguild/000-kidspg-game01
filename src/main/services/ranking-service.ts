// src/main/services/ranking-service.ts

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { RankingData } from '@shared/types/ranking';
import { AppConfig } from '@shared/types'; // Import AppConfig from existing types

export class RankingService {
  private resultsPath: string;
  private configPath: string;
  private config: AppConfig | null = null;

  constructor() {
    // Determine results.json path based on environment
    this.resultsPath = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'results', 'results.json')
      : path.join(app.getAppPath(), 'results', 'results.json');

    // Determine config.json path based on environment
    this.configPath = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'config.json')
      : path.join(app.getAppPath(), 'config.json');
  }

  private async loadJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string' &&
        (error as { code: string }).code === 'ENOENT'
      ) {
        console.warn(`File not found: ${filePath}. Returning empty data.`);
        return null; // Or return an empty object/array based on T
      }
      console.error(`Failed to load JSON file ${filePath}:`, error);
      return null;
    }
  }

  public async getRankingData(): Promise<RankingData | null> {
    const data = await this.loadJsonFile<RankingData>(this.resultsPath);
    // Ensure data has 'recent' and 'ranking_top' arrays, even if empty
    return data || { recent: [], ranking_top: [] };
  }

  public async getRankingConfig(): Promise<AppConfig | null> {
    if (!this.config) {
      this.config = await this.loadJsonFile<AppConfig>(this.configPath);
    }
    return this.config;
  }

  public watchResults(callback: (data: RankingData) => void): () => void {
    try {
      const watcher = fs.watch(this.resultsPath, async (eventType) => {
        if (eventType === 'change') {
          console.log(`${this.resultsPath} has changed. Reloading ranking data.`);
          const data = await this.getRankingData();
          if (data) {
            callback(data);
          }
        }
      });

      return () => watcher.close();
    } catch (error) {
      console.error(`Failed to watch ${this.resultsPath}:`, error);
      return () => {};
    }
  }
}