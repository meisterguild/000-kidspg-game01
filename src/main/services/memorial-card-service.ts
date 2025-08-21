import * as path from 'path';
import * as fs from 'fs/promises';
import { BrowserWindow } from 'electron';
import type { GameResult } from '@shared/types';
import { CommandExecutor, type ExecutionResult, type MagickError } from './command-executor';
import { ImageCompositionConfig, type CompositionConfig } from './image-composition-config';
import { MagickScriptGenerator } from './magick-script-generator';

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

export class MemorialCardService {
  private readonly config: MemorialCardConfig;
  private readonly commandExecutor: CommandExecutor;
  private readonly imageConfig: ImageCompositionConfig;
  private readonly scriptGenerator: MagickScriptGenerator;
  private readonly mainWindow: BrowserWindow | null;

  constructor(config: MemorialCardConfig, mainWindow?: BrowserWindow) {
    this.config = config;
    this.commandExecutor = new CommandExecutor(config.magickTimeout);
    this.imageConfig = new ImageCompositionConfig(config.cardBaseImagesDir);
    this.scriptGenerator = new MagickScriptGenerator();
    this.mainWindow = mainWindow || null;
  }

  /**
   * ダミー画像を使ったメモリアルカード事前生成
   */
  async generateDummyMemorialCard(datetime: string, resultDir: string, gameResult: GameResult): Promise<MemorialCardResult> {
    const startTime = Date.now();
    
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Memorial card generation is disabled',
        duration: Date.now() - startTime
      };
    }

    try {
      // Step 1: ダミー画像パスを取得
      const dummyPhotoPath = this.imageConfig.getDummyPhotoPath();
      
      // Step 2: ダミー画像の存在確認
      try {
        await fs.access(dummyPhotoPath);
      } catch {
        return {
          success: false,
          error: `Dummy photo not found: ${dummyPhotoPath}`,
          duration: Date.now() - startTime
        };
      }

      // Step 3: 合成設定生成（ダミー用ファイル名）
      const compositionConfig = this.imageConfig.generateCompositionConfig(
        gameResult,
        datetime,
        dummyPhotoPath
      );
      
      // ダミー用ファイル名に変更
      compositionConfig.outputFileName = this.imageConfig.getDummyOutputFileName(datetime);

      // Step 4: 設定検証
      const configValidation = this.imageConfig.validateConfig(compositionConfig);
      if (!configValidation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${configValidation.errors.join(', ')}`,
          duration: Date.now() - startTime
        };
      }

      // Step 5: ImageMagickスクリプト生成
      const scriptPath = await this.scriptGenerator.generateScript(
        compositionConfig,
        dummyPhotoPath,
        resultDir
      );

      // Step 6: スクリプト検証
      const scriptValidation = await this.scriptGenerator.validateScriptFile(scriptPath);
      if (!scriptValidation.valid) {
        return {
          success: false,
          error: `Script validation failed: ${scriptValidation.error}`,
          duration: Date.now() - startTime
        };
      }

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
      console.error('MemorialCardService - Dummy card generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * ダミー画像用のメモリアルカード生成（既存メソッド - 後方互換性のため残存）
   */
  async generateFromDummyImage(datetime: string, resultDir: string): Promise<void> {
    
    if (!this.config.enabled) {
      return;
    }

    try {
      const result = await this.generateMemorialCard(resultDir, true); // ダミーフラグを追加
      
      if (result.success) {
        this.sendToRenderer('memorial-card-generated', {
          success: true,
          datetime,
          outputPath: result.outputPath,
          duration: result.duration
        });
      } else {
        console.error(`MemorialCardService - Dummy memorial card generation failed: ${result.error}`);
        this.sendToRenderer('memorial-card-error', {
          success: false,
          datetime,
          error: result.error,
          duration: result.duration
        });
      }
      
    } catch (error) {
      console.error('MemorialCardService - Unexpected error during dummy image memorial card generation:', error);
      this.sendToRenderer('memorial-card-error', {
        success: false,
        datetime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * AI変換画像用のメモリアルカード生成
   */
  async generateFromAIImage(jobId: string, resultDir: string): Promise<void> {
    
    if (!this.config.enabled) {
      return;
    }
    

    try {
      const result = await this.generateMemorialCard(resultDir, false); // AI用（非ダミー）
      
      if (result.success) {
        this.sendToRenderer('memorial-card-generated', {
          success: true,
          datetime: jobId,
          outputPath: result.outputPath,
          duration: result.duration
        });
      } else {
        console.error(`MemorialCardService - AI image memorial card generation failed: ${result.error}`);
        this.sendToRenderer('memorial-card-error', {
          success: false,
          datetime: jobId,
          error: result.error,
          duration: result.duration
        });
      }
      
    } catch (error) {
      console.error('MemorialCardService - Unexpected error during AI image memorial card generation:', error);
      this.sendToRenderer('memorial-card-error', {
        success: false,
        datetime: jobId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 廃止予定: ComfyUI完了イベントのハンドリング（後方互換性のために残存）
   */
  async handleComfyUICompletion(datetime: string, resultDir: string): Promise<void> {
    console.warn('MemorialCardService - handleComfyUICompletion is deprecated, use generateFromAIImage instead');
    await this.generateFromAIImage(datetime, resultDir);
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

      // Step 9: スクリプトファイルのクリーンアップ（オプション）
      // await this.scriptGenerator.cleanupScript(scriptPath);

      return result;

    } catch (error) {
      console.error('MemorialCardService - Generation error:', error);
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
   * レンダラープロセスへの通知
   */
  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
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
      ready: true // 基本的に常に準備完了状態
    };
  }
}