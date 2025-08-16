import * as path from 'path';
import type { GameResult } from '../../shared/types';
import { RANK_NAMES } from '../../shared/utils/helpers';

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface TextElement {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  gravity?: string;
  bold?: boolean;
  strokeWidth?: number;
}

export interface CompositionConfig {
  backgroundImagePath: string;
  foregroundPosition: Position;
  textElements: TextElement[];
  outputFileName: string;
}

export class ImageCompositionConfig {
  private readonly cardBaseImagesDir: string;
  private readonly fontPath: string;

  constructor(cardBaseImagesDir: string = 'card_base_images') {
    this.cardBaseImagesDir = cardBaseImagesDir;
    this.fontPath = 'C:/Windows/Fonts/meiryo.ttc';
  }

  /**
   * ランクに基づいて背景画像パスを取得
   */
  getBackgroundImagePath(rank: string): string {
    const rankMapping: Record<string, string> = {
      [RANK_NAMES.BEGINNER]: 'bg-card-rank-01-beginner.png',
      [RANK_NAMES.AMATEUR]: 'bg-card-rank-02-amateur.png',
      [RANK_NAMES.ADVANCED]: 'bg-card-rank-03-advanced.png',
      [RANK_NAMES.EXPERT]: 'bg-card-rank-04-expert.png',
      [RANK_NAMES.VETERAN]: 'bg-card-rank-05-veteran.png',
      [RANK_NAMES.ELITE]: 'bg-card-rank-06-elite.png',
      [RANK_NAMES.MASTER]: 'bg-card-rank-07-master.png',
      [RANK_NAMES.LEGEND]: 'bg-card-rank-08-legend.png'
    };

    const filename = rankMapping[rank] || rankMapping[RANK_NAMES.BEGINNER]; // デフォルトはビギナー
    return path.join(this.cardBaseImagesDir, filename);
  }

  /**
   * 前景画像（photo_anime.png）の配置位置を取得
   */
  getForegroundPosition(): Position {
    return {
      x: 180,
      y: 190,
      width: 650,
      height: 650
    };
  }

  /**
   * テキスト描画要素を取得
   */
  getTextElements(gameResult: GameResult): TextElement[] {
    const elements: TextElement[] = [
      {
        text: gameResult.nickname,
        x: 140,
        y: 190,
        fontSize: 50,
        color: '#d3593a',  // darkorange in RGB
        gravity: 'Center',
        bold: true,
        strokeWidth: 1
      },
      {
        text: gameResult.rank,
        x: 140,
        y: 295,
        fontSize: 50,
        color: '#d3593a',
        gravity: 'Center',
        bold: true,
        strokeWidth: 1
      },
      {
        text: gameResult.score.toString(),
        x: 140,
        y: 400,
        fontSize: 80,
        color: '#d3593a',
        gravity: 'Center',
        bold: true,
        strokeWidth: 2  // スコアは太めに
      },
      {
        text: this.formatTimestampWithoutSeconds(gameResult.timestampJST),
        x: 140,
        y: 510,
        fontSize: 50,
        color: '#d3593a',
        gravity: 'Center',
        bold: true,
        strokeWidth: 1
      }
    ];

    return elements;
  }

  /**
   * 出力ファイル名を生成
   */
  getOutputFileName(datetime: string): string {
    return `memorial_card_${datetime}.png`;
  }

  /**
   * タイムスタンプから秒を除去してフォーマット
   * "2025-08-16 17:23:54" → "2025-08-16 17:23"
   */
  private formatTimestampWithoutSeconds(timestamp: string): string {
    try {
      // "YYYY-MM-DD HH:MM:SS" 形式を想定
      const parts = timestamp.split(' ');
      if (parts.length === 2) {
        const datePart = parts[0]; // "2025-08-16"
        const timePart = parts[1]; // "17:23:54"
        
        // 時間部分から秒を除去
        const timeWithoutSeconds = timePart.substring(0, 5); // "17:23"
        
        return `${datePart} ${timeWithoutSeconds}`;
      }
      
      // フォーマットが想定と異なる場合は元のまま返す
      return timestamp;
    } catch (error) {
      console.warn('ImageCompositionConfig - Error formatting timestamp:', error);
      return timestamp;
    }
  }

  /**
   * フォント設定を取得
   */
  getFontSettings() {
    return {
      fontPath: this.fontPath,
      defaultSize: 40,
      defaultColor: '#FF8C00'  // darkorange in RGB
    };
  }

  /**
   * 完全な合成設定を生成
   */
  generateCompositionConfig(
    gameResult: GameResult, 
    datetime: string, 
    _foregroundImagePath: string
  ): CompositionConfig {
    const backgroundImagePath = this.getBackgroundImagePath(gameResult.rank);
    const foregroundPosition = this.getForegroundPosition();
    const textElements = this.getTextElements(gameResult);
    const outputFileName = this.getOutputFileName(datetime);

    return {
      backgroundImagePath,
      foregroundPosition,
      textElements,
      outputFileName
    };
  }

  /**
   * photo_anime.pngファイルを検索して取得
   */
  findAnimePhotoPath(resultDir: string): string | null {
    const fs = require('fs');
    
    try {
      const files = fs.readdirSync(resultDir);
      const animeFile = files.find((file: string) => 
        file.startsWith('photo_anime_') && file.endsWith('.png')
      );
      
      if (animeFile) {
        return path.join(resultDir, animeFile);
      }
      
      console.warn(`ImageCompositionConfig - photo_anime file not found in ${resultDir}`);
      return null;
    } catch (error) {
      console.error('ImageCompositionConfig - Error reading result directory:', error);
      return null;
    }
  }

  /**
   * 設定値の検証
   */
  validateConfig(config: CompositionConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const fs = require('fs');

    // 背景画像の存在確認
    if (!fs.existsSync(config.backgroundImagePath)) {
      errors.push(`Background image not found: ${config.backgroundImagePath}`);
    }

    // フォントファイルの存在確認
    if (!fs.existsSync(this.fontPath)) {
      errors.push(`Font file not found: ${this.fontPath}`);
    }

    // テキスト要素の検証
    if (!config.textElements || config.textElements.length === 0) {
      errors.push('No text elements defined');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}