/**
 * Thumbnail Generator Script (Overwrite Mode)
 *
 * このスクリプトは、`results`フォルダ内のすべての写真（photo_*.png）を検索し、
 * 指定された幅でアスペクト比を維持したサムネイルを生成します。
 * 既存のサムネイルは常に上書きされます。
 *
 * 依存関係: ImageMagick v7以降がインストールされ、`magick`コマンドが実行可能である必要があります。
 *
 * 実行方法:
 * cd C:\Users\owner\MG\PoC_base\000-kidspg-game01
 * npx ts-node --compiler-options '{"module": "CommonJS"}' src/test/create-thumbnails.ts <width>
 *
 * 例 (幅300pxでサムネイルを生成):
 * npx ts-node --compiler-options '{"module": "CommonJS"}' src/test/create-thumbnails.ts 300
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ThumbnailTarget {
  sourcePath: string;
  outputPath: string;
}

interface GenerationStats {
  foundPhotos: number;
  successfullyCreated: number;
  failedCreations: number;
}

class ThumbnailGenerator {
  private resultsDir: string;
  private targetWidth: number;
  private stats: GenerationStats = {
    foundPhotos: 0,
    successfullyCreated: 0,
    failedCreations: 0,
  };

  constructor(resultsDir: string, width: number) {
    this.resultsDir = path.resolve(resultsDir);
    this.targetWidth = width;
  }

  /**
   * メインの実行メソッド
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Thumbnail Generator (Overwrite Mode)...');
    console.log(`- Target Width: ${this.targetWidth}px`);
    console.log(`- Scanning Directory: ${this.resultsDir}\n`);

    try {
      const targets = await this.findTargets();
      
      if (targets.length === 0) {
        console.log('✅ No photos found to create thumbnails for.');
        return;
      }

      console.log(`🎯 Found ${targets.length} photos to process. Existing thumbnails will be overwritten.\n`);
      await this.generateThumbnails(targets);
      this.displayFinalResults();

    } catch (error) {
      console.error('❌ An unexpected error occurred:', error);
      process.exit(1);
    }
  }

  /**
   * サムネイル生成対象のファイルを検索
   */
  private async findTargets(): Promise<ThumbnailTarget[]> {
    const targets: ThumbnailTarget[] = [];
    const entries = await fs.readdir(this.resultsDir, { withFileTypes: true });
    const directories = entries.filter(entry => entry.isDirectory() && /^[0-9]{8}_[0-9]{6}$/.test(entry.name));

    for (const dir of directories) {
      const resultDir = path.join(this.resultsDir, dir.name);
      const files = await fs.readdir(resultDir);

      const photos = files.filter(file => 
        file.startsWith('photo_') && 
        file.endsWith('.png') && 
        !file.includes('_anime_') && 
        !file.endsWith('.thumb.png')
      );

      for (const photo of photos) {
        const sourcePath = path.join(resultDir, photo);
        const thumbName = photo.replace('.png', '.thumb.png');
        const outputPath = path.join(resultDir, thumbName);
        
        // 存在チェックをせず、常に対象として追加
        targets.push({ sourcePath, outputPath });
      }
    }
    this.stats.foundPhotos = targets.length;
    return targets;
  }

  /**
   * 見つかったターゲットに対してサムネイルを生成
   */
  private async generateThumbnails(targets: ThumbnailTarget[]): Promise<void> {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = `[${i + 1}/${targets.length}]`;
      const relativePath = path.relative(this.resultsDir, target.sourcePath);

      console.log(`${progress} Processing ${relativePath}...`);

      try {
        // ImageMagick v7の推奨構文に変更
        const command = `magick "${target.sourcePath}" -resize ${this.targetWidth}x "${target.outputPath}"`;
        
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
          // ImageMagickは警告をstderrに出力することがあるため、エラーとして扱わない
          console.warn(`-  ⚠️  Warning for ${relativePath}: ${stderr}`);
        }

        this.stats.successfullyCreated++;

      } catch (error) {
        console.error(`-  ❌ ERROR for ${relativePath}:`, error);
        this.stats.failedCreations++;
      }
    }
  }

  /**
   * 最終結果を表示
   */
  private displayFinalResults(): void {
    console.log('\n🏁 Thumbnail generation completed!');
    console.log('\n📊 Final Results:');
    console.log(`├── Total photos processed: ${this.stats.foundPhotos}`);
    console.log(`├── Successfully created/overwritten: ${this.stats.successfullyCreated}`);
    console.log(`└── Failed to create: ${this.stats.failedCreations}`);
  }
}

/**
 * スクリプト実行部分
 */
async function main() {
  const args = process.argv.slice(2);
  const widthArg = parseInt(args[0], 10);

  if (isNaN(widthArg) || widthArg <= 0) {
    console.error('❌ Error: Please provide a valid positive number for the width.');
    console.error('   Example: npx ts-node src/test/create-thumbnails.ts 300');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '../../');
  const resultsDir = path.join(projectRoot, 'results');
  
  const generator = new ThumbnailGenerator(resultsDir, widthArg);
  await generator.run();
}

if (require.main === module) {
  main();
}
