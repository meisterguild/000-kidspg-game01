import * as path from 'path';
import * as fs from 'fs/promises';
import type { CompositionConfig, TextElement } from './image-composition-config';

export class MagickScriptGenerator {
  /**
   * ImageMagickスクリプトファイルを生成
   */
  async generateScript(
    config: CompositionConfig,
    foregroundImagePath: string,
    resultDir: string
  ): Promise<string> {
    const datetime = path.basename(resultDir);
    const scriptPath = path.join(resultDir, `magick_script_${datetime}.txt`);
    
    console.log(`MagickScriptGenerator - Generating script: ${scriptPath}`);
    
    try {
      const scriptContent = this.buildScriptContent(
        config,
        foregroundImagePath,
        resultDir
      );
      
      await fs.writeFile(scriptPath, scriptContent, 'utf-8');
      console.log('MagickScriptGenerator - Script file created successfully');
      
      return scriptPath;
      
    } catch (error) {
      console.error('MagickScriptGenerator - Script generation failed:', error);
      throw new Error(`Script generation failed: ${error}`);
    }
  }

  /**
   * スクリプト内容を構築
   */
  private buildScriptContent(
    config: CompositionConfig,
    foregroundImagePath: string,
    resultDir: string
  ): string {
    const lines: string[] = [];
    
    // ヘッダーコメント
    lines.push('# ImageMagick script for memorial card generation');
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push('');
    
    // Step 1: 背景画像と前景画像の合成
    lines.push('# Step 1: Load background image and composite foreground');
    lines.push(this.normalizePathForMagick(config.backgroundImagePath));
    lines.push(this.normalizePathForMagick(foregroundImagePath));
    
    // 前景画像の配置設定
    const geometry = this.buildGeometryString(config.foregroundPosition);
    lines.push(`-geometry ${geometry}`);
    lines.push('-composite');
    lines.push('');
    
    // Step 2: フォント設定
    lines.push('# Step 2: Configure base font');
    lines.push('-font C:/Windows/Fonts/meiryo.ttc');
    lines.push('');
    
    // Step 3: テキスト描画（各要素ごとに設定）
    lines.push('# Step 3: Draw text elements with individual settings');
    const textCommands = this.generateTextCommands(config.textElements);
    lines.push(...textCommands);
    lines.push('');
    
    // Step 4: 出力画像保存
    lines.push('# Step 4: Save final image');
    const outputPath = path.join(resultDir, config.outputFileName);
    lines.push(`-write "${this.normalizePathForMagick(outputPath)}"`);
    
    return lines.join('\n');
  }

  /**
   * Windowsパスを ImageMagick用に正規化
   */
  private normalizePathForMagick(filePath: string): string {
    // 絶対パスに変換し、バックスラッシュをスラッシュに変換
    return path.resolve(filePath).replace(/\\/g, '/');
  }

  /**
   * 画像配置のgeometry文字列を構築
   */
  private buildGeometryString(position: { x: number; y: number; width?: number; height?: number }): string {
    let geometry = '';
    
    // サイズ指定がある場合
    if (position.width && position.height) {
      geometry += `${position.width}x${position.height}`;
    }
    
    // 位置指定
    geometry += `+${position.x}+${position.y}`;
    
    return geometry;
  }

  /**
   * テキスト描画コマンドを生成（各要素ごとに個別設定）
   */
  private generateTextCommands(textElements: TextElement[]): string[] {
    const commands: string[] = [];
    
    for (const element of textElements) {
      // テキストのエスケープ処理
      const escapedText = this.escapeTextForMagick(element.text);
      
      // 各テキスト要素ごとに設定を適用
      commands.push(`-pointsize ${element.fontSize}`);
      commands.push(`-fill "${element.color}"`);
      
      // Bold効果のためのstroke設定（設定がある場合のみ）
      if (element.bold && element.strokeWidth) {
        commands.push(`-stroke "${element.color}"`);
        commands.push(`-strokewidth ${element.strokeWidth}`);
      }
      
      if (element.gravity) {
        commands.push(`-gravity ${element.gravity}`);
      }
      
      // -draw コマンドの構築
      const drawCommand = `-draw "text ${element.x},${element.y} '${escapedText}'"`;
      commands.push(drawCommand);
      
      // 次のテキスト要素との区切り
      commands.push('');
    }
    
    return commands;
  }

  /**
   * ImageMagick用にテキストをエスケープ
   */
  private escapeTextForMagick(text: string): string {
    // シングルクォート、ダブルクォート、バックスラッシュをエスケープ
    return text
      .replace(/\\/g, '\\\\')  // バックスラッシュ
      .replace(/'/g, "\\'")    // シングルクォート
      .replace(/"/g, '\\"');   // ダブルクォート
  }

  /**
   * スクリプトファイルの存在確認
   */
  async validateScriptFile(scriptPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await fs.access(scriptPath);
      const stats = await fs.stat(scriptPath);
      
      if (!stats.isFile()) {
        return { valid: false, error: 'Script path is not a file' };
      }
      
      if (stats.size === 0) {
        return { valid: false, error: 'Script file is empty' };
      }
      
      console.log(`MagickScriptGenerator - Script validation passed: ${scriptPath} (${stats.size} bytes)`);
      return { valid: true };
      
    } catch (error) {
      return { 
        valid: false, 
        error: `Script file validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * スクリプトファイルの内容をログ出力
   */
  async logScriptContent(scriptPath: string): Promise<void> {
    try {
      const content = await fs.readFile(scriptPath, 'utf-8');
      console.log('MagickScriptGenerator - Script content:');
      console.log('--- Script Start ---');
      console.log(content);
      console.log('--- Script End ---');
    } catch (error) {
      console.error('MagickScriptGenerator - Failed to read script for logging:', error);
    }
  }

  /**
   * 一時スクリプトファイルの削除
   */
  async cleanupScript(scriptPath: string): Promise<void> {
    try {
      await fs.unlink(scriptPath);
      console.log(`MagickScriptGenerator - Cleaned up script file: ${scriptPath}`);
    } catch (error) {
      console.warn(`MagickScriptGenerator - Failed to cleanup script file: ${error}`);
    }
  }
}