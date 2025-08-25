/**
 * HTML Gallery Generator Script
 *
 * このスクリプトは、`image-paths.json`と`gallery-template.html`を元に、
 * 最終的な画像ギャラリーHTMLファイルを生成します。
 * 一覧ではサムネイルやアニメ画像を指定サイズで表示し、クリックでフルサイズ画像を表示します。
 *
 * 実行方法:
 * 1. `create-image-path-json.ts` を実行して `image-paths.json` を最新の状態にする
 *    npx ts-node --compiler-options '{"module": "CommonJS"}' src/test/create-image-path-json.ts
 * 2. このスクリプトを実行してHTMLを生成する
 *    npx ts-node --compiler-options '{"module": "CommonJS"}' src/test/generate-gallery.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ImageSet {
  directory: string;
  memorial_card: string | null;
  dummy_memorial_card: string | null;
  photo: string | null;
  anime_photo: string | null;
  photo_thumb: string | null;
}

class HtmlGalleryGenerator {
  private templatePath: string;
  private jsonPath: string;
  private outputPath: string;
  private resultsDir: string;

  constructor(templatePath: string, jsonPath: string, outputPath: string, resultsDir: string) {
    this.templatePath = path.resolve(templatePath);
    this.jsonPath = path.resolve(jsonPath);
    this.outputPath = path.resolve(outputPath);
    this.resultsDir = path.resolve(resultsDir);
  }

  /**
   * メインの実行メソッド
   */
  async run(): Promise<void> {
    console.log('🚀 Starting HTML Gallery Generator...');

    try {
      // 1. 必要なファイルを読み込む
      const template = await this.readFile('Template', this.templatePath);
      const jsonData = await this.readFile('JSON data', this.jsonPath);
      const imageSets: ImageSet[] = JSON.parse(jsonData);
      console.log(`📂 Found ${imageSets.length} image sets in JSON file.`);

      // 2. HTMLコンテンツを生成
      const galleryContent = this.generateGalleryContent(imageSets);

      // 3. テンプレートにコンテンツを注入
      const finalHtml = template.replace('<!-- GALLERY_CONTENT -->', galleryContent);

      // 4. 最終的なHTMLファイルを書き出す
      await fs.writeFile(this.outputPath, finalHtml, 'utf-8');

      console.log(`✅ Successfully generated gallery.html.`);
      console.log(`   Output file located at: ${this.outputPath}`);

    } catch (error) {
      console.error('❌ An error occurred during HTML generation:', error);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`💡 Hint: Make sure '${path.basename(this.jsonPath)}' and '${path.basename(this.templatePath)}' exist before running this script.`);
        console.error(`   You can generate '${path.basename(this.jsonPath)}' by running: npx ts-node --compiler-options '{"module": "CommonJS"}' src/test/create-image-path-json.ts`);
      }
      process.exit(1);
    }
  }

  /**
   * ファイルを読み込む汎用メソッド
   */
  private async readFile(fileType: string, filePath: string): Promise<string> {
    try {
      console.log(`📄 Reading ${fileType} file from: ${filePath}`);
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.error(`❌ Error reading ${fileType} file: ${filePath}`);
      throw error;
    }
  }

  /**
   * 画像セットのデータからHTMLの断片を生成
   */
  private generateGalleryContent(imageSets: ImageSet[]): string {
    let content = '\n';
    // 表示順序を変更し、ラベルを定義
    const labels: Record<string, string> = {
        //dummy_memorial_card: 'メモリアルカード(dummy)',
        memorial_card: 'メモリアルカード(正規)',
        //photo: '写真(カメラ撮影)',
        //anime_photo: '写真(アニメ風)'
    };

    for (const imageSet of imageSets) {
      content += `        <div class="image-set">\n`;
      content += `            <h2>${imageSet.directory}</h2>\n`;
      content += `            <div class="image-container">\n`;

      for (const [key, label] of Object.entries(labels)) {
        const isSample = (key === 'dummy_memorial_card' || key === 'anime_photo');
        const wrapperClass = isSample ? 'image-wrapper sample-background' : 'image-wrapper';

        content += `                <div class="${wrapperClass}">\n`;
        
        const imagePath = imageSet[key as keyof Omit<ImageSet, 'directory'>];
        
        if (key === 'photo') {
            const thumbPath = imageSet.photo_thumb;
            const fullPath = imageSet.photo;
            
            if (thumbPath && fullPath) {
                const displaySrc = this.getRelativePath(thumbPath);
                const lightboxSrc = this.getRelativePath(fullPath);
                content += `                    <img src="${displaySrc}" alt="${label}" class="photo-thumbnail-display" onclick="openLightbox('${lightboxSrc}')">\n`;
                content += `                    <p>${label}</p>\n`;
            } else if (fullPath) { // サムネイルがない場合はフルサイズを表示
                const displaySrc = this.getRelativePath(fullPath);
                content += `                    <img src="${displaySrc}" alt="${label}" onclick="openLightbox('${displaySrc}')">\n`;
                content += `                    <p>${label}</p>\n`;
            } else {
                content += `                    <p class="missing-image">${label}<br>(なし)</p>\n`;
            }
        } else if (imagePath) {
            const relativePath = this.getRelativePath(imagePath as string);
            const cssClass = (key === 'anime_photo') ? ' class="photo-thumbnail-display"' : '';
            content += `                    <img src="${relativePath}" alt="${label}"${cssClass} onclick="openLightbox(this.src)">\n`;
            content += `                    <p>${label}</p>\n`;
        } else {
            content += `                    <p class="missing-image">${label}<br>(なし)</p>\n`;
        }
        content += '                </div>\n';
      }

      content += `            </div>\n`;
      content += `        </div>\n\n`;
    }

    return content;
  }

  private getRelativePath(absolutePath: string): string {
      return path.relative(this.resultsDir, path.join(this.resultsDir, absolutePath)).replace(/\\/g, '/');
  }
}

/**
 * スクリプト実行部分
 */
async function main() {
  const projectRoot = path.resolve(__dirname, '../../');
  const resultsDir = path.join(projectRoot, 'results');
  
  const config = {
    templatePath: path.join(projectRoot, 'src', 'test', 'templates', 'gallery-template.html'),
    jsonPath: path.join(resultsDir, 'image-paths.json'),
    outputPath: path.join(resultsDir, 'gallery.html'),
    resultsDir: resultsDir
  };

  const generator = new HtmlGalleryGenerator(config.templatePath, config.jsonPath, config.outputPath, config.resultsDir);
  await generator.run();
}

if (require.main === module) {
  main();
}