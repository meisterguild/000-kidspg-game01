/**
 * Memorial Card Recovery Script
 * 
 * このスクリプトは、正規版メモリアルカード（memorial_card_{datetime}.png）が
 * 作成されなかった結果データをリカバリするために使用します。
 * 
 * 必要な素材が揃っているフォルダに対して、MemorialCardServiceを使用して
 * 正規版メモリアルカードを再生成します。
 * 
 * 実行方法:
 * cd C:\Users\owner\MG\PoC_base\000-kidspg-game01
 * npx ts-node src/test/memorial-card-recovery.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { NodeMemorialCardService } from './node-memorial-card-service';
import type { GameResult } from '../shared/types';

interface RecoveryTarget {
  datetime: string;
  resultDir: string;
  hasPhotoAnime: boolean;
  hasResultJson: boolean;
  hasMagickScript: boolean;
  hasRegularCard: boolean;
  hasRecoveryMark: boolean;
  recoverable: boolean;
  lastRecoveryAttempt?: string;
  recoveryStatus?: 'success' | 'failed' | 'in_progress';
}

interface RecoveryStats {
  totalDirectories: number;
  missingRegularCards: number;
  recoverableTargets: number;
  alreadyRecovered: number;
  retryTargets: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  skippedTargets: number;
}

class MemorialCardRecovery {
  private resultsDir: string;
  private memorialCardService: NodeMemorialCardService | null = null;
  private stats: RecoveryStats = {
    totalDirectories: 0,
    missingRegularCards: 0,
    recoverableTargets: 0,
    alreadyRecovered: 0,
    retryTargets: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    skippedTargets: 0
  };

  constructor(resultsDir: string) {
    this.resultsDir = path.resolve(resultsDir);
  }

  /**
   * リカバリマークファイルのパスを取得
   */
  private getRecoveryMarkPath(resultDir: string): string {
    return path.join(resultDir, '.recovery_mark.json');
  }

  /**
   * リカバリマークファイルを作成
   */
  private async createRecoveryMark(resultDir: string, status: 'success' | 'failed' | 'in_progress'): Promise<void> {
    const markPath = this.getRecoveryMarkPath(resultDir);
    const markData = {
      timestamp: new Date().toISOString(),
      status,
      version: '1.0',
      recoveredBy: 'memorial-card-recovery-script'
    };

    try {
      await fs.writeFile(markPath, JSON.stringify(markData, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to create recovery mark: ${error}`);
    }
  }

  /**
   * リカバリマークファイルを読み取り
   */
  private async readRecoveryMark(resultDir: string): Promise<{
    exists: boolean;
    timestamp?: string;
    status?: 'success' | 'failed' | 'in_progress';
  }> {
    const markPath = this.getRecoveryMarkPath(resultDir);
    
    try {
      const content = await fs.readFile(markPath, 'utf-8');
      const data = JSON.parse(content);
      return {
        exists: true,
        timestamp: data.timestamp,
        status: data.status
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * リカバリマークファイルを削除（リセット用）
   */
  private async removeRecoveryMark(resultDir: string): Promise<void> {
    const markPath = this.getRecoveryMarkPath(resultDir);
    
    try {
      await fs.unlink(markPath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * MemorialCardServiceを初期化
   */
  private async initializeMemorialCardService(): Promise<void> {
    try {
      // 設定ファイルを読み込み
      const configPath = path.join(__dirname, '../../config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      if (!config.memorialCard) {
        throw new Error('Memorial card configuration not found in config.json');
      }

      this.memorialCardService = new NodeMemorialCardService(
        config.memorialCard,
        path.dirname(path.dirname(__dirname)) // プロジェクトルート
      );

      console.log('✅ NodeMemorialCardService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MemorialCardService:', error);
      throw error;
    }
  }

  /**
   * 結果フォルダをスキャンして復旧対象を特定
   */
  private async scanResultsDirectories(): Promise<RecoveryTarget[]> {
    console.log('🔍 Scanning results directories...');
    
    const targets: RecoveryTarget[] = [];
    
    try {
      const entries = await fs.readdir(this.resultsDir, { withFileTypes: true });
      const directories = entries.filter(entry => 
        entry.isDirectory() && /^[0-9]{8}_[0-9]{6}$/.test(entry.name)
      );

      this.stats.totalDirectories = directories.length;
      console.log(`📁 Found ${directories.length} result directories`);

      for (const dir of directories) {
        const datetime = dir.name;
        const resultDir = path.join(this.resultsDir, datetime);
        
        try {
          const files = await fs.readdir(resultDir);
          
          const hasPhotoAnime = files.some(file => file.startsWith('photo_anime_') && file.endsWith('.png'));
          const hasResultJson = files.includes('result.json');
          const hasMagickScript = files.some(file => file.startsWith('magick_script_') && file.endsWith('.txt'));
          const hasRegularCard = files.some(file => file.match(/^memorial_card_.*\.png$/) && !file.includes('.dummy.'));

          // リカバリマーク情報を取得
          const recoveryMark = await this.readRecoveryMark(resultDir);
          const hasRecoveryMark = recoveryMark.exists;

          if (!hasRegularCard) {
            this.stats.missingRegularCards++;
          }

          // 復旧可能性の判定
          const basicRecoverable = !hasRegularCard && hasPhotoAnime && hasResultJson;
          let recoverable = basicRecoverable;

          // 統計カウント
          if (basicRecoverable) {
            if (hasRecoveryMark && recoveryMark.status === 'success') {
              this.stats.alreadyRecovered++;
              recoverable = false; // 成功済みは対象外
            } else if (hasRecoveryMark && recoveryMark.status === 'failed') {
              this.stats.retryTargets++;
              recoverable = true; // 失敗したものは再試行対象
            } else if (!hasRecoveryMark) {
              this.stats.recoverableTargets++;
              recoverable = true; // 未処理は対象
            }
          }

          targets.push({
            datetime,
            resultDir,
            hasPhotoAnime,
            hasResultJson,
            hasMagickScript,
            hasRegularCard,
            hasRecoveryMark,
            recoverable,
            lastRecoveryAttempt: recoveryMark.timestamp,
            recoveryStatus: recoveryMark.status
          });

        } catch (error) {
          console.warn(`⚠️  Failed to scan directory ${datetime}:`, error);
        }
      }

      return targets;

    } catch (error) {
      console.error('❌ Failed to scan results directory:', error);
      throw error;
    }
  }

  /**
   * 復旧統計を表示
   */
  private displayStats(targets: RecoveryTarget[]): void {
    console.log('\n📊 Recovery Analysis:');
    console.log(`├── Total directories: ${this.stats.totalDirectories}`);
    console.log(`├── Missing regular cards: ${this.stats.missingRegularCards}`);
    console.log(`├── New recoverable targets: ${this.stats.recoverableTargets}`);
    console.log(`├── Already recovered (success): ${this.stats.alreadyRecovered}`);
    console.log(`├── Failed retry targets: ${this.stats.retryTargets}`);
    console.log(`└── Non-recoverable: ${this.stats.missingRegularCards - this.stats.recoverableTargets - this.stats.alreadyRecovered - this.stats.retryTargets}\n`);

    // すでに復旧済みの対象を表示
    if (this.stats.alreadyRecovered > 0) {
      console.log(`✅ Already recovered (${this.stats.alreadyRecovered} targets) - will be skipped`);
      const recovered = targets.filter(t => t.hasRecoveryMark && t.recoveryStatus === 'success');
      recovered.slice(0, 5).forEach(target => {
        const lastAttempt = target.lastRecoveryAttempt ? new Date(target.lastRecoveryAttempt).toLocaleString() : 'unknown';
        console.log(`   ${target.datetime} (recovered: ${lastAttempt})`);
      });
      if (recovered.length > 5) {
        console.log(`   ... and ${recovered.length - 5} more`);
      }
      console.log('');
    }

    // 失敗からのリトライ対象を表示
    if (this.stats.retryTargets > 0) {
      console.log(`🔄 Retry targets (${this.stats.retryTargets} failed attempts) - will be retried`);
      const retryTargets = targets.filter(t => t.hasRecoveryMark && t.recoveryStatus === 'failed');
      retryTargets.slice(0, 5).forEach(target => {
        const lastAttempt = target.lastRecoveryAttempt ? new Date(target.lastRecoveryAttempt).toLocaleString() : 'unknown';
        console.log(`   ${target.datetime} (last failed: ${lastAttempt})`);
      });
      if (retryTargets.length > 5) {
        console.log(`   ... and ${retryTargets.length - 5} more`);
      }
      console.log('');
    }

    // 非復旧可能な理由を分析
    const nonRecoverable = targets.filter(t => !t.hasRegularCard && !t.recoverable && !t.hasRecoveryMark);
    if (nonRecoverable.length > 0) {
      console.log('❌ Non-recoverable targets:');
      nonRecoverable.forEach(target => {
        const reasons: string[] = [];
        if (!target.hasPhotoAnime) reasons.push('missing photo_anime');
        if (!target.hasResultJson) reasons.push('missing result.json');
        console.log(`   ${target.datetime}: ${reasons.join(', ')}`);
      });
      console.log('');
    }
  }

  /**
   * 単一のメモリアルカードを復旧
   */
  private async recoverSingleCard(target: RecoveryTarget): Promise<boolean> {
    if (!this.memorialCardService) {
      throw new Error('NodeMemorialCardService not initialized');
    }

    try {
      console.log(`🔧 Recovering ${target.datetime}...`);

      // 処理開始マークを作成
      await this.createRecoveryMark(target.resultDir, 'in_progress');

      // result.jsonを読み込み
      const resultJsonPath = path.join(target.resultDir, 'result.json');
      const resultContent = await fs.readFile(resultJsonPath, 'utf-8');
      const gameResult: GameResult = JSON.parse(resultContent);

      // AI画像を使用したメモリアルカード生成（非ダミー）
      const result = await this.memorialCardService.generateMemorialCard(
        target.resultDir, 
        false // isDummy = false（正規版）
      );

      if (result.success) {
        console.log(`✅ Successfully recovered: ${target.datetime} (${result.duration}ms)`);
        await this.createRecoveryMark(target.resultDir, 'success');
        this.stats.successfulRecoveries++;
        return true;
      } else {
        console.log(`❌ Failed to recover ${target.datetime}: ${result.error}`);
        await this.createRecoveryMark(target.resultDir, 'failed');
        this.stats.failedRecoveries++;
        return false;
      }

    } catch (error) {
      console.error(`❌ Error recovering ${target.datetime}:`, error);
      await this.createRecoveryMark(target.resultDir, 'failed');
      this.stats.failedRecoveries++;
      return false;
    }
  }

  /**
   * バッチ復旧を実行
   */
  private async performBatchRecovery(targets: RecoveryTarget[], dryRun: boolean = false): Promise<void> {
    const recoverableTargets = targets.filter(t => t.recoverable);
    
    if (recoverableTargets.length === 0) {
      console.log('ℹ️  No recoverable targets found.');
      return;
    }

    console.log(`🚀 Starting ${dryRun ? 'DRY RUN' : 'RECOVERY'} for ${recoverableTargets.length} targets...\n`);

    for (let i = 0; i < recoverableTargets.length; i++) {
      const target = recoverableTargets[i];
      const progress = `[${i + 1}/${recoverableTargets.length}]`;
      
      console.log(`${progress} Processing ${target.datetime}...`);

      if (dryRun) {
        console.log(`${progress} DRY RUN: Would recover ${target.datetime}`);
        this.stats.skippedTargets++;
      } else {
        await this.recoverSingleCard(target);
      }

      // 進捗表示のため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🏁 Recovery completed!');
  }

  /**
   * 最終結果を表示
   */
  private displayFinalResults(): void {
    console.log('\n📈 Final Results:');
    console.log(`├── Successful recoveries: ${this.stats.successfulRecoveries}`);
    console.log(`├── Failed recoveries: ${this.stats.failedRecoveries}`);
    console.log(`├── Skipped (dry run): ${this.stats.skippedTargets}`);
    console.log(`├── Skipped (already done): ${this.stats.alreadyRecovered}`);
    
    const totalTargets = this.stats.recoverableTargets + this.stats.retryTargets;
    const recoveryRate = totalTargets > 0 ? 
      Math.round((this.stats.successfulRecoveries / totalTargets) * 100) : 0;
    
    console.log(`└── Recovery rate: ${recoveryRate}%`);

    if (this.stats.failedRecoveries > 0) {
      console.log('\n💡 Tip: Failed recoveries can be retried after fixing issues. Just run the script again!');
      console.log('   Each result directory has a .recovery_mark.json file tracking the status.');
    }
  }

  /**
   * メイン実行メソッド
   */
  async run(options: { dryRun?: boolean; reset?: boolean; forceAll?: boolean } = {}): Promise<void> {
    const { dryRun = false, reset = false, forceAll = false } = options;

    console.log('🎯 Memorial Card Recovery Script');
    console.log(`📂 Results directory: ${this.resultsDir}`);
    
    let mode = 'RECOVERY (will modify files)';
    if (dryRun) mode = 'DRY RUN (no changes)';
    if (reset) mode += ' + RESET (clear all marks)';
    if (forceAll) mode += ' + FORCE ALL (ignore success marks)';
    
    console.log(`🔄 Mode: ${mode}\n`);

    // リセットオプションが指定された場合、すべてのマークファイルを削除
    if (reset && !dryRun) {
      console.log('🔄 Resetting all recovery marks...');
      await this.resetAllMarks();
      console.log('✅ All recovery marks cleared.\n');
    }

    try {
      // 結果ディレクトリの存在確認
      await fs.access(this.resultsDir);

      // MemorialCardService初期化
      if (!dryRun) {
        await this.initializeMemorialCardService();
      }

      // ディレクトリスキャン
      const targets = await this.scanResultsDirectories();

      // 統計表示
      this.displayStats(targets);

      // 復旧実行
      await this.performBatchRecovery(targets, dryRun);

      // 最終結果表示
      this.displayFinalResults();

    } catch (error) {
      console.error('\n💥 Recovery script failed:', error);
      process.exit(1);
    }
  }

  /**
   * すべてのリカバリマークをリセット
   */
  private async resetAllMarks(): Promise<void> {
    try {
      const entries = await fs.readdir(this.resultsDir, { withFileTypes: true });
      const directories = entries.filter(entry => 
        entry.isDirectory() && /^[0-9]{8}_[0-9]{6}$/.test(entry.name)
      );

      for (const dir of directories) {
        const resultDir = path.join(this.resultsDir, dir.name);
        await this.removeRecoveryMark(resultDir);
      }
    } catch (error) {
      console.error('Failed to reset recovery marks:', error);
    }
  }
}

/**
 * スクリプト実行部分
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const reset = args.includes('--reset') || args.includes('-r');
  const forceAll = args.includes('--force-all') || args.includes('-f');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Memorial Card Recovery Script with Retry Support

Usage:
  npx ts-node src/test/memorial-card-recovery.ts [options]

Options:
  --dry-run, -d     Run in dry-run mode (no changes will be made)
  --reset, -r       Reset all recovery marks (clear history)
  --force-all, -f   Force recovery of all targets (ignore success marks)
  --help, -h        Show this help message

Recovery Status Management:
  • Success marks prevent re-processing already completed items
  • Failed marks allow automatic retry on next run
  • Use --reset to clear all marks and start fresh
  • Use --force-all to re-process everything regardless of marks

Examples:
  npx ts-node src/test/memorial-card-recovery.ts --dry-run    # Preview what will be done
  npx ts-node src/test/memorial-card-recovery.ts             # Run recovery (skips completed)
  npx ts-node src/test/memorial-card-recovery.ts --reset     # Clear marks and run fresh
  npx ts-node src/test/memorial-card-recovery.ts --force-all # Force re-process everything

Mark Files:
  Each processed directory gets a .recovery_mark.json file with status and timestamp.
`);
    process.exit(0);
  }

  // 結果ディレクトリのパス（プロジェクトルートからの相対パス）
  const resultsDir = path.join(__dirname, '../../results');
  
  const recovery = new MemorialCardRecovery(resultsDir);
  await recovery.run({ dryRun, reset, forceAll });
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { MemorialCardRecovery };