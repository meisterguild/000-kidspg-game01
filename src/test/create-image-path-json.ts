/**
 * Image Path JSON Generator Script
 *
 * このスクリプトは、`results`ディレクトリ内をスキャンし、
 * 画像ギャラリー表示に必要な画像ファイルのパス（サムネイル含む）をまとめたJSONファイルを生成します。
 *
 * 実行方法:
 * cd C:\Users\owner\MG\PoC_base\000-kidspg-game01
 * npx ts-node --compiler-options '{\"module\": \"CommonJS\"}' src/test/create-image-path-json.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ImageSet {
  directory: string;
  memorial_card: string | null;
  dummy_memorial_card: string | null;
  photo: string | null;
  anime_photo: string | null;
  photo_thumb: string | null; // サムネイル用のパスを追加
}

class ImagePathJsonGenerator {
  private resultsDir: string;
  private outputJsonPath: string;

  constructor(resultsDir: string, outputJsonPath: string) {
    this.resultsDir = path.resolve(resultsDir);
    this.outputJsonPath = path.resolve(outputJsonPath);
  }

  /**
   * メインの実行メソッド
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Image Path JSON Generator...');
    console.log(`🔍 Scanning directory: ${this.resultsDir}`);

    try {
      const imageSets = await this.scanDirectories();
      await this.writeJsonFile(imageSets);

      console.log(`✅ Successfully generated ${path.basename(this.outputJsonPath)} with ${imageSets.length} entries.`);
      console.log(`   Output file located at: ${this.outputJsonPath}`);

    } catch (error) {
      console.error('❌ An error occurred during JSON generation:', error);
      process.exit(1);
    }
  }

  /**
   * ディレクトリをスキャンして画像セットを収集
   */
  private async scanDirectories(): Promise<ImageSet[]> {
    const entries = await fs.readdir(this.resultsDir, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory() && /^[0-9]{8}_[0-9]{6}$/.test(entry.name))
      .sort((a, b) => b.name.localeCompare(a.name)); // 日付が新しい順にソート

    const imageSets: ImageSet[] = [];

    for (const dir of directories) {
      const resultDir = path.join(this.resultsDir, dir.name);
      const files = await fs.readdir(resultDir);

      const imageSet: ImageSet = {
        directory: dir.name,
        memorial_card: this.findFile(files, dir.name, /^memorial_card_.*\.png$/, name => !name.includes('.dummy.')),
        dummy_memorial_card: this.findFile(files, dir.name, /^memorial_card_.*\.dummy\.png$/),
        photo: this.findFile(files, dir.name, /^photo_.*\.png$/, name => !name.includes('_anime_') && !name.endsWith('.thumb.png')),
        anime_photo: this.findFile(files, dir.name, /^photo_anime_.*\.png$/),
        photo_thumb: this.findFile(files, dir.name, /^photo_.*\.thumb\.png$/) // サムネイル画像を検索
      };
      
      imageSets.push(imageSet);
    }
    return imageSets;
  }

  /**
   * ファイルリストから特定のパターンに一致するファイルを探す
   */
  private findFile(files: string[], dirName: string, pattern: RegExp, additionalCheck?: (name: string) => boolean): string | null {
    const found = files.find(file => {
        const match = pattern.test(file);
        return additionalCheck ? match && additionalCheck(file) : match;
    });
    return found ? path.join(dirName, found).replace(/\\/g, '/') : null;
  }

  /**
   * 収集した画像セットをJSONファイルに書き出す
   */
  private async writeJsonFile(data: ImageSet[]): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(this.outputJsonPath, jsonContent, 'utf-8');
  }
}

/**
 * スクリプト実行部分
 */
async function main() {
  const projectRoot = path.resolve(__dirname, '../../');
  const resultsDir = path.join(projectRoot, 'results');
  const outputJsonPath = path.join(resultsDir, 'image-paths.json');

  const generator = new ImagePathJsonGenerator(resultsDir, outputJsonPath);
  await generator.run();
}

if (require.main === module) {
  main();
}