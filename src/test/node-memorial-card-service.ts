/**
 * Node.js環境用のMemorialCardService
 * Electronに依存しない独立したメモリアルカード生成サービス
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import type { GameResult } from '../shared/types';
import { CommandExecutor, type ExecutionResult, type MagickError } from '../main/services/command-executor';
import { MagickScriptGenerator } from '../main/services/magick-script-generator';
import { NodeImageCompositionConfig, type CompositionConfig } from './node-image-composition-config';

export interface MemorialCardResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration: number;
}

export interface MemorialCardConfig {
  enabled: boolean;
  magickTimeout: number;
  cardBaseImagesDir: string;
}

export class NodeMemorialCardService {
  private readonly config: MemorialCardConfig;
  private readonly commandExecutor: CommandExecutor;
  private readonly imageConfig: NodeImageCompositionConfig;
  private readonly scriptGenerator: MagickScriptGenerator;

  constructor(config: MemorialCardConfig, projectRoot?: string) {
    this.config = config;
    this.commandExecutor = new CommandExecutor(config.magickTimeout);
    this.imageConfig = new NodeImageCompositionConfig(config.cardBaseImagesDir, projectRoot);
    this.scriptGenerator = new MagickScriptGenerator();
  }

  /**
   * 記念カード生成のメイン処理
   */
  async generateMemorialCard(resultDir: string, isDummy: boolean = false): Promise<MemorialCardResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: 入力検証
      const validation = await this.validateInputs(resultDir);
      if (!validation.valid) {
        return {
          success: false,
          error: `Input validation failed: ${validation.errors?.join(', ') || 'Unknown validation error'}`,
          duration: Date.now() - startTime
        };
      }

      const { gameResult, animePhotoPath } = validation;
      
      if (!gameResult || !animePhotoPath) {
        return {
          success: false,
          error: 'Game result or anime photo path is missing',
          duration: Date.now() - startTime
        };
      }
      
      // Step 2: 合成設定生成
      const datetime = path.basename(resultDir);
      const compositionConfig = isDummy 
        ? this.imageConfig.generateDummyCompositionConfig(gameResult, datetime, animePhotoPath)
        : this.imageConfig.generateCompositionConfig(gameResult, datetime, animePhotoPath);

      // Step 3: 設定検証
      const configValidation = this.imageConfig.validateConfig(compositionConfig);
      if (!configValidation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${configValidation.errors.join(', ')}`,
          duration: Date.now() - startTime
        };
      }

      // Step 4: ImageMagickスクリプト生成
      const scriptPath = await this.scriptGenerator.generateScript(
        compositionConfig,
        animePhotoPath,
        resultDir
      );

      // Step 5: スクリプト検証
      const scriptValidation = await this.scriptGenerator.validateScriptFile(scriptPath);
      if (!scriptValidation.valid) {
        return {
          success: false,
          error: `Script validation failed: ${scriptValidation.error}`,
          duration: Date.now() - startTime
        };
      }

      // Step 6: デバッグ用ログ出力
      await this.scriptGenerator.logScriptContent(scriptPath);

      // Step 7: ImageMagickコマンド実行
      const executionResult = await this.commandExecutor.executeMagickScript(scriptPath);

      // Step 8: 実行結果の処理
      const result = await this.processExecutionResult(
        executionResult,
        compositionConfig,
        resultDir,
        startTime
      );

      return result;

    } catch (error) {
      console.error('NodeMemorialCardService - Generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 入力ファイルの検証
   */
  private async validateInputs(resultDir: string): Promise<{
    valid: boolean;
    errors?: string[];
    gameResult?: GameResult;
    animePhotoPath?: string;
  }> {
    const errors: string[] = [];

    try {
      // result.jsonの存在確認と読み込み
      const resultJsonPath = path.join(resultDir, 'result.json');
      let gameResult: GameResult;
      
      try {
        const resultContent = await fs.readFile(resultJsonPath, 'utf-8');
        gameResult = JSON.parse(resultContent);
      } catch (error) {
        errors.push(`Failed to read result.json: ${error}`);
        return { valid: false, errors };
      }

      // photo_anime.pngの存在確認
      const animePhotoPath = this.imageConfig.findAnimePhotoPath(resultDir);
      if (!animePhotoPath) {
        errors.push('photo_anime file not found in result directory');
        return { valid: false, errors };
      }

      return {
        valid: true,
        gameResult,
        animePhotoPath
      };

    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return { valid: false, errors };
    }
  }

  /**
   * ImageMagick実行結果の処理
   */
  private async processExecutionResult(
    executionResult: ExecutionResult,
    config: CompositionConfig,
    resultDir: string,
    startTime: number
  ): Promise<MemorialCardResult> {
    const duration = Date.now() - startTime;

    if (executionResult.success) {
      const outputPath = path.join(resultDir, config.outputFileName);
      
      // 出力ファイルの存在確認
      try {
        await fs.access(outputPath);
        
        return {
          success: true,
          outputPath,
          duration
        };
        
      } catch (error) {
        return {
          success: false,
          error: `Output file not created: ${error}`,
          duration
        };
      }
      
    } else {
      // エラー解析
      const magickError = this.commandExecutor.parseError(executionResult.stderr);
      const errorMessage = this.formatErrorMessage(magickError, executionResult);
      
      return {
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * エラーメッセージのフォーマット
   */
  private formatErrorMessage(magickError: MagickError, executionResult: ExecutionResult): string {
    let message = magickError.message;
    
    if (executionResult.exitCode !== null) {
      message += ` (Exit code: ${executionResult.exitCode})`;
    }
    
    if (executionResult.stderr) {
      message += `\nDetails: ${executionResult.stderr}`;
    }
    
    return message;
  }

  /**
   * サービスの設定を取得
   */
  getConfig(): MemorialCardConfig {
    return { ...this.config };
  }

  /**
   * サービスの状態を取得
   */
  getStatus(): { enabled: boolean; ready: boolean } {
    return {
      enabled: this.config.enabled,
      ready: true
    };
  }
}