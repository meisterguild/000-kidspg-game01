import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ComfyUIService } from './services/comfyui-service';
import { MemorialCardService } from './services/memorial-card-service';
import { RankingService } from './services/ranking-service';
import { ResultsManager } from './services/results-manager';
import type { AppConfig, GameResult } from '@shared/types';
import { WINDOW_CONFIG } from '../shared/utils/constants';

// 日付を YYYYMMDD_HHMMSS 形式の文字列にフォーマットする
const getFormattedDateTime = (date: Date): string => {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${Y}${M}${D}_${h}${m}${s}`;
};

// Electronメインプロセス
class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private rankingWindow: BrowserWindow | null = null;
  private config: AppConfig | null = null;
  private comfyUIService: ComfyUIService | null = null;
  private memorialCardService: MemorialCardService | null = null;
  private resultsManager: ResultsManager | null = null;
  private rankingService: RankingService | null = null; // ADDED
  private memorialCardGenerationFlags = new Set<string>(); // 重複防止用フラグ
  private exitConfirmed = false; // 終了確認済みフラグ

  constructor() {
    this.initializeApp();
  }

  private async loadConfig(): Promise<AppConfig | null> {
    try {
      let configPath: string;
      if (app.isPackaged) {
        // 本番環境: exeファイルと同じディレクトリにあるconfig.jsonを指す
        configPath = path.join(path.dirname(app.getPath('exe')), 'config.json');
      } else {
        // 開発環境: プロジェクトルートにあるconfig.jsonを指す
        configPath = path.join(app.getAppPath(), 'config.json');
      }
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      
      return JSON.parse(configContent);
    } catch (error) {
      console.error('設定ファイルの読み込みに失敗しました:', error);
      return null;
    }
  }

  private initializeApp(): void {
    // 終了前確認イベントハンドラー
    app.on('before-quit', async (event) => {
      if (!this.exitConfirmed) {
        event.preventDefault();
        await this.showExitConfirmation();
      }
    });

    // GPU プロセス クラッシュ対策のコマンドラインスイッチ
    app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    
    app.whenReady().then(async () => {
      // 設定ファイルを読み込む
      this.config = await this.loadConfig();

      // Media権限の設定（カメラ・マイクアクセスを許可）
      app.on('web-contents-created', (event, contents) => {
        contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
          if (permission === 'media') {
            callback(true); // カメラ・マイクアクセスを許可
          } else {
            callback(false);
          }
        });
      });

      // ResultsManagerを初期化
      const resultsDir = app.isPackaged 
        ? path.join(path.dirname(app.getPath('exe')), 'results')
        : path.join(app.getAppPath(), 'results');
      
      // resultsフォルダの存在を確認・作成（正しいパスで）
      await this.ensureDirectoryExistsAbsolute(resultsDir);
      
      this.resultsManager = new ResultsManager(resultsDir, this.config);

      this.createMainWindow();
      this.setupIPC();
      await this.initializeServices();
    });

    app.on('window-all-closed', async () => {
      // macOS以外では、すべてのウィンドウが閉じられた時の処理
      // ただし、exitConfirmedがtrueの場合のみ実際に終了する
      if (process.platform !== 'darwin') {
        if (this.exitConfirmed) {
          if (this.comfyUIService) {
            await this.comfyUIService.destroy();
          }
          app.quit();
        }
        // exitConfirmedがfalseの場合は何もしない（ユーザーがキャンセルした場合）
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: WINDOW_CONFIG.main.height,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        // 音声自動再生を許可
        autoplayPolicy: 'no-user-gesture-required',
        // カメラとマイクアクセスを許可
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        // GPU プロセス クラッシュ対策
        backgroundThrottling: false
      },
      icon: path.join(__dirname, '../../../assets/icon.ico'),
      title: 'KidsPG - よけまくり中'
    });

    // 開発環境ではViteサーバー、本番環境では静的ファイルを読み込み
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadURL(
        `file://${path.join(__dirname, "../../renderer/index.html")}`
      );
    }

    // ウィンドウのXボタンクリック時に終了確認を表示
    this.mainWindow.on('close', async (event) => {
      if (!this.exitConfirmed) {
        event.preventDefault();
        await this.showExitConfirmation();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private createRankingWindow(): void {
    if (this.rankingWindow) {
      this.rankingWindow.focus();
      return;
    }

    this.rankingWindow = new BrowserWindow({
      width: WINDOW_CONFIG.main.width,
      height: 768,
      autoHideMenuBar: true,
      parent: this.mainWindow || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      title: 'ランキング表示'
    });

    // 開発環境ではViteサーバー、本番環境では静的ファイルを読み込み
    if (process.env.NODE_ENV === 'development') {
      this.rankingWindow.loadURL('http://localhost:3000/ranking.html');
      this.rankingWindow.webContents.openDevTools();
    } else {
      const rankingPath = path.join(__dirname, '../../renderer/ranking.html');
      this.rankingWindow.loadFile(rankingPath).catch((error) => {
        console.error(`Ranking file not found: ${rankingPath}`, error);
        // ファイルが存在しない場合はプレースホルダーを表示
        this.rankingWindow?.loadURL('data:text/html,<h1>ランキング準備中...</h1>');
      });
      this.rankingWindow.webContents.openDevTools();
    }

    this.rankingWindow.on('closed', () => {
      this.rankingWindow = null;
    });
  }

  private setupIPC(): void {
    // 写真を保存し、結果保存用のディレクトリを作成する
    ipcMain.handle('save-photo', async (event, imageData: string, isDummy: boolean = false) => {
      try {
        const dateTime = getFormattedDateTime(new Date());
        const dirPath = path.join(process.cwd(), 'results', dateTime);
        await fs.mkdir(dirPath, { recursive: true });

        const photoFileName = `photo_${dateTime}.png`;
        const filePath = path.join(dirPath, photoFileName);
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        
        if (isDummy) {
          // ダミー画像の場合、dummy_photo.pngを直接コピー
          let dummyPhotoPath: string;
          if (app.isPackaged) {
            // 本番環境: exeファイルと同じディレクトリの assets フォルダ
            dummyPhotoPath = path.join(path.dirname(app.getPath('exe')), 'assets', 'dummy_photo.png');
          } else {
            // 開発環境: プロジェクトルートの assets フォルダ
            dummyPhotoPath = path.join(app.getAppPath(), 'src', 'renderer', 'assets', 'images', 'dummy_photo.png');
          }
          
          try {
            await fs.copyFile(dummyPhotoPath, filePath);
            // ダミー画像用のphoto_anime_*.pngも即座に作成
            const animePhotoPath = path.join(dirPath, `photo_anime_${dateTime}.png`);
            await fs.copyFile(dummyPhotoPath, animePhotoPath);
          } catch (copyError) {
            console.warn('Failed to copy dummy_photo.png, using generated image:', copyError);
            await fs.writeFile(filePath, base64Data, 'base64');
            
            // catchブロックでもphoto_anime_*.pngを作成
            try {
              const animePhotoPath = path.join(dirPath, `photo_anime_${dateTime}.png`);
              await fs.writeFile(animePhotoPath, base64Data, 'base64');
            } catch (animeError) {
              console.error('Failed to create photo_anime file:', animeError);
            }
          }
        } else {
          // 実画像の場合、通常通り保存
          await fs.writeFile(filePath, base64Data, 'base64');
        }
        
        if (isDummy) {
          // ダミー画像の場合：メモリアルカード生成はresult.json保存後に実行
        } else {
          // 実画像の場合：通常のComfyUI処理
          if (this.config?.comfyui) {
            try {
              // テンプレートファイルのパス解決（開発環境・本番環境対応）
              let templatePath: string;
              if (app.isPackaged) {
                // 本番環境: exeファイルと同じディレクトリの assets フォルダ
                templatePath = path.join(path.dirname(app.getPath('exe')), this.config.comfyui.workflow.templatePath);
              } else {
                // 開発環境: プロジェクトルートの assets フォルダ
                templatePath = path.join(app.getAppPath(), this.config.comfyui.workflow.templatePath);
              }
              
              const templateContent = await fs.readFile(templatePath, 'utf-8');
              const workflowTemplate = JSON.parse(templateContent);

              // 変数置換
              // SaveImageノード(node 9)のfilename_prefixを更新（日時付き）
              if (workflowTemplate['9'] && workflowTemplate['9'].inputs) {
                const saveImageInputs = workflowTemplate['9'].inputs;
                const outputPrefix = `${this.config.comfyui.workflow.outputPrefix}_${dateTime}`;
                if (typeof saveImageInputs.filename_prefix === 'string' && saveImageInputs.filename_prefix.includes('${filename_prefix}')) {
                  saveImageInputs.filename_prefix = saveImageInputs.filename_prefix.replace('${filename_prefix}', outputPrefix);
                } else {
                  saveImageInputs.filename_prefix = outputPrefix;
                }
              }
              
              // LoadImageノード(node 10)のimageファイル名を更新（日時付き）
              if (workflowTemplate['10'] && workflowTemplate['10'].inputs) {
                const loadImageInputs = workflowTemplate['10'].inputs;
                if (typeof loadImageInputs.image === 'string' && loadImageInputs.image.includes('${photo_png}')) {
                  loadImageInputs.image = loadImageInputs.image.replace('${photo_png}', photoFileName);
                } else {
                  loadImageInputs.image = photoFileName;
                }
              }

              const imageGeneratePath = path.join(dirPath, 'image_generate.json');
              await fs.writeFile(imageGeneratePath, JSON.stringify(workflowTemplate, null, 2));

              // ComfyUIが有効な場合、即座に画像をアップロード＆変換開始
              if (this.comfyUIService) {
                try {
                  // 1. プリアップロード
                  await this.comfyUIService.preUploadImage(base64Data, dateTime);
                  
                  // 2. 即座に変換開始
                  await this.comfyUIService.transformImage({
                    imageData: base64Data,
                    datetime: dateTime,
                    resultDir: dirPath
                  });
                } catch (error) {
                  console.warn('Pre-upload or transform failed, will handle later:', error);
                }
              }
            } catch (error) {
              console.error('[ComfyUI] CRITICAL - Failed to process template or start transformation:', error);
              console.error('[ComfyUI] Template path attempted:', this.config.comfyui.workflow.templatePath);
              console.error('[ComfyUI] Error details:', {
                type: typeof error,
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack'
              });
              
              // ComfyUIが利用できない場合でも、ゲーム自体は継続する
              console.warn('[ComfyUI] ComfyUI処理をスキップして続行します。画像生成は行われません。');
            }
          }
        }

        return { success: true, dirPath: dirPath };
      } catch (error) {
        console.error('Failed to save photo:', error);
        return { success: false, error: String(error) };
      }
    });

    // JSONデータを指定されたディレクトリに保存する
    ipcMain.handle('save-json', async (event, dirPath: string, jsonData: object) => {
      try {
        const filePath = path.join(dirPath, 'result.json');
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        
        // result.json保存後、ダミー画像の場合はメモリアルカード生成を実行
        const dateTime = path.basename(dirPath);
        const photoPath = path.join(dirPath, `photo_${dateTime}.png`);
        const animePhotoPath = path.join(dirPath, `photo_anime_${dateTime}.png`);
        
        // photo_anime_*.pngが存在し、ComfyUIによる生成でない場合（ダミー画像）
        try {
          const animeExists = await fs.access(animePhotoPath).then(() => true).catch(() => false);
          if (animeExists && this.memorialCardService) {
            // ファイルサイズでダミー画像かどうかを簡易判定
            const photoStats = await fs.stat(photoPath);
            const animeStats = await fs.stat(animePhotoPath);
            
            // 同じサイズならダミー画像からのコピー
            if (photoStats.size === animeStats.size) {
              // 重複防止チェック
              if (this.memorialCardGenerationFlags.has(dateTime)) {
                console.warn(`ElectronApp - Memorial card generation already in progress/completed for: ${dateTime}`);
                return { success: true, filePath: filePath };
              }
              
              this.memorialCardGenerationFlags.add(dateTime);
              
              setTimeout(async () => {
                try {
                  if (this.memorialCardService) {
                    await this.memorialCardService.generateFromDummyImage(dateTime, dirPath);
                  }
                } catch (error) {
                  console.error('ElectronApp - Memorial card generation error:', error);
                  // エラー時はフラグを削除してリトライ可能にする
                  this.memorialCardGenerationFlags.delete(dateTime);
                }
              }, 100);
            }
          }
        } catch (checkError) {
          console.warn('ElectronApp - Error checking for dummy image memorial card generation:', checkError);
        }
        
        // Update results.json
        if (this.resultsManager) {
          try {
            console.log(`Updating results index for: ${dirPath}`);
            await this.resultsManager.updateResults(dirPath, jsonData as GameResult);
            console.log('Results index updated successfully');
          } catch (error) {
            console.error('Failed to update results index:', error);
          }
        } else {
          console.error('ResultsManager not initialized');
        }
        
        return { success: true, filePath: filePath };
      } catch (error) {
        console.error('Failed to save JSON:', error);
        return { success: false, error: String(error) };
      }
    });

    // ランキングウィンドウ表示
    ipcMain.handle('show-ranking-window', () => {
      this.createRankingWindow();
    });

    // ランキングウィンドウ閉じる
    ipcMain.handle('close-ranking-window', () => {
      if (this.rankingWindow) {
        this.rankingWindow.close();
      }
    });

    // ランキングデータ取得
    ipcMain.handle('ranking:get-data', async () => {
      if (!this.rankingService) {
        console.error('RankingService not initialized.');
        return null;
      }
      return await this.rankingService.getRankingData();
    });

    // ランキング設定取得
    ipcMain.handle('ranking:get-config', async () => {
      if (!this.rankingService) {
        console.error('RankingService not initialized.');
        return null;
      }
      return await this.rankingService.getRankingConfig();
    });

    // 設定情報を取得
    ipcMain.handle('get-config', () => {
      return this.config;
    });

    // 設定ファイルを再読み込み
    ipcMain.handle('reload-config', async () => {
      try {
        this.config = await this.loadConfig();
        return { success: true, config: this.config };
      } catch (error) {
        console.error('設定ファイルの再読み込みに失敗しました:', error);
        return { success: false, error: String(error) };
      }
    });

    // ComfyUI画像変換リクエスト
    ipcMain.handle('comfyui-transform', async (event, imageData: string, datetime: string, resultDir: string) => {
      try {
        if (!this.comfyUIService) {
          return { success: false, error: 'ComfyUI service not initialized' };
        }

        // 既存のジョブをdatetimeで重複チェック
        const activeJobs = this.comfyUIService.getActiveJobs();
        const existingJob = activeJobs.find(job => job.datetime === datetime);
        if (existingJob) {
          return { success: false, error: `Job already exists for ${datetime}` };
        }

        const jobId = await this.comfyUIService.transformImage({
          imageData,
          datetime,
          resultDir
        });

        return { success: true, jobId };
      } catch (error) {
        console.error('ComfyUI transformation failed:', error);
        return { success: false, error: String(error) };
      }
    });

    // ComfyUIステータス取得
    ipcMain.handle('comfyui-status', async () => {
      try {
        if (!this.comfyUIService) {
          return { success: false, error: 'ComfyUI service not initialized' };
        }

        const status = await this.comfyUIService.getStatus();
        return { success: true, status };
      } catch (error) {
        console.error('ComfyUI status check failed:', error);
        return { success: false, error: String(error) };
      }
    });

    // ComfyUIヘルスチェック
    ipcMain.handle('comfyui-health-check', async () => {
      try {
        if (!this.comfyUIService) {
          return { success: false, isHealthy: false };
        }

        const isHealthy = await this.comfyUIService.healthCheck();
        return { success: true, isHealthy };
      } catch (error) {
        console.error('ComfyUI health check failed:', error);
        return { success: false, isHealthy: false };
      }
    });

    // ComfyUIアクティブジョブ取得
    ipcMain.handle('comfyui-active-jobs', async () => {
      try {
        if (!this.comfyUIService) {
          return { success: false, jobs: [] };
        }

        const jobs = this.comfyUIService.getActiveJobs();
        return { success: true, jobs };
      } catch (error) {
        console.error('ComfyUI active jobs check failed:', error);
        return { success: false, jobs: [] };
      }
    });

    // ComfyUIジョブキャンセル
    ipcMain.handle('comfyui-cancel-job', async (event, datetime: string) => {
      try {
        if (!this.comfyUIService) {
          return { success: false, error: 'ComfyUI service not initialized' };
        }

        const canceled = await this.comfyUIService.cancelJob(datetime);
        return { success: canceled };
      } catch (error) {
        console.error('ComfyUI job cancel failed:', error);
        return { success: false, error: String(error) };
      }
    });

    // 新しいIPCハンドラ: アセットの絶対パスを取得
    ipcMain.handle('get-asset-absolute-path', async (event, relativePath: string) => {
      
      try {
        let assetPath: string;
        
        if (app.isPackaged) {
          // 本番環境: ASARパッケージ内のdist/renderer/assetsフォルダのアセットにアクセス
          // relativePath例: "assets/sounds/action.mp3" -> "dist/renderer/assets/action.mp3"
          const assetFileName = relativePath.replace(/^assets\/(sounds|images)\//, '');
          
          assetPath = path.join(__dirname, '../../renderer/assets', assetFileName);
          
          // ファイル存在確認
          try {
            await fs.access(assetPath);
          } catch (accessError) {
            console.error(`main.ts: [PACKAGED] ❌ Asset file NOT FOUND: ${assetPath}`);
            console.error(`main.ts: [PACKAGED] Access error:`, accessError);
            
            // 代替パスをいくつか試行
            const alternativePaths = [
              path.join(__dirname, '../renderer/assets', assetFileName),
              path.join(__dirname, 'renderer/assets', assetFileName),
              path.join(__dirname, '../../assets', assetFileName),
              path.join(path.dirname(app.getPath('exe')), 'resources', relativePath)
            ];
            
            let foundAlternative = false;
            
            for (const altPath of alternativePaths) {
              try {
                await fs.access(altPath);
                assetPath = altPath;
                foundAlternative = true;
                break;
              } catch {
                // Continue to next alternative
              }
            }
            
            if (!foundAlternative) {
              console.error(`main.ts: [PACKAGED] CRITICAL - No valid asset path found for: ${relativePath}`);
            }
          }
        } else {
          // 開発環境: src/renderer/assetsフォルダのアセットにアクセス
          assetPath = path.join(app.getAppPath(), 'src/renderer', relativePath);
          
          // 開発環境でもファイル存在確認
          try {
            await fs.access(assetPath);
          } catch (accessError) {
            console.error(`main.ts: [DEV] ❌ Asset file NOT FOUND: ${assetPath}`);
            console.error(`main.ts: [DEV] Access error:`, accessError);
          }
        }
        
        return assetPath;
        
      } catch (error) {
        console.error('main.ts: CRITICAL - Error resolving asset path:', error);
        console.error('main.ts: Error details:', {
          type: typeof error,
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        });
        
        // フォールバック: 従来の方法
        const appPath = app.isPackaged
          ? path.dirname(app.getPath('exe'))
          : app.getAppPath();

        const resourcesPath = app.isPackaged
          ? path.join(appPath, 'resources')
          : appPath;

        const absoluteAssetPath = path.join(resourcesPath, relativePath);
        
        // フォールバックパスも存在確認
        try {
          await fs.access(absoluteAssetPath);
        } catch (fallbackError) {
          console.error(`main.ts: [FALLBACK] ❌ Fallback path also not found: ${absoluteAssetPath}`, fallbackError);
        }
        
        return absoluteAssetPath;
      }
    });

    // 終了確認関連のIPCハンドラー
    ipcMain.handle('get-comfyui-status-for-exit', async () => {
      if (this.comfyUIService) {
        try {
          const activeJobs = this.comfyUIService.getActiveJobs();
          return {
            activeJobs,
            internalQueueLength: activeJobs.length,
            serverQueueRunning: 0,
            serverQueuePending: 0
          };
        } catch (error) {
          console.error('Failed to get ComfyUI status for exit:', error);
          return { 
            activeJobs: [], 
            internalQueueLength: 0,
            serverQueueRunning: 0,
            serverQueuePending: 0
          };
        }
      }
      return { 
        activeJobs: [], 
        internalQueueLength: 0,
        serverQueueRunning: 0,
        serverQueuePending: 0
      };
    });

    ipcMain.handle('confirm-exit', async (event, confirmed: boolean) => {
      if (confirmed) {
        this.exitConfirmed = true;
        app.quit();
      }
    });
  }

  private async initializeServices(): Promise<void> {
    // メモリアルカードサービスは常に初期化（ComfyUIに依存しない）
    await this.initializeMemorialCardService();
    
    // ComfyUIサービスは設定がある場合のみ初期化
    await this.initializeComfyUI();

    // RankingServiceを初期化
    this.rankingService = new RankingService();
    this.setupRankingWatcher();
  }

  private async initializeMemorialCardService(): Promise<void> {
    try {
      if (!this.config?.memorialCard) {
        return;
      }

      this.memorialCardService = new MemorialCardService(
        this.config.memorialCard,
        this.mainWindow || undefined
      );
    } catch (error) {
      console.error('Memorial Card Service initialization failed:', error);
      this.memorialCardService = null;
    }
  }

  private async initializeComfyUI(): Promise<void> {
    try {
      if (!this.config?.comfyui) {
        return;
      }

      // ComfyUIServiceは画像変換のみを担当（記念カード機能を除去）
      this.comfyUIService = new ComfyUIService(
        this.config.comfyui,
        undefined, // memorialCardConfigを除去
        this.mainWindow || undefined
      );
      await this.comfyUIService.initialize();
      
      // ComfyUI完了時のメモリアルカード生成コールバックを設定
      this.comfyUIService.setMemorialCardCallback(this.handleComfyUICompletion.bind(this));
      
    } catch (error) {
      console.error('[ComfyUI] Service initialization failed:', error);
      console.error('[ComfyUI] Config details:', {
        hasConfig: !!this.config?.comfyui,
        baseUrl: this.config?.comfyui?.baseUrl,
        templatePath: this.config?.comfyui?.workflow?.templatePath
      });
      console.error('[ComfyUI] Error details:', {
        type: typeof error,
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      });
      this.comfyUIService = null;
      console.warn('[ComfyUI] ComfyUI機能は無効化されました。ゲームは画像生成なしで動作します。');
    }
  }

  private setupRankingWatcher(): void { // ADDED
    if (this.rankingService) {
      this.rankingService.watchResults((data) => {
        console.log('Ranking data updated, sending to renderer');
        if (this.rankingWindow && !this.rankingWindow.isDestroyed()) {
          this.rankingWindow.webContents.send('ranking:data-updated', data);
        }
      });
    }
  } // ADDED


  private async handleComfyUICompletion(jobId: string, resultDir: string): Promise<void> {
    if (!this.memorialCardService) {
      console.warn('ElectronApp - Memorial card service not available for ComfyUI completion');
      return;
    }

    // 重複防止チェック（AI画像用）
    const dateTime = path.basename(resultDir);
    if (this.memorialCardGenerationFlags.has(dateTime)) {
      return;
    }

    try {
      this.memorialCardGenerationFlags.add(dateTime);
      await this.memorialCardService.generateFromAIImage(jobId, resultDir);
    } catch (error) {
      console.error('ElectronApp - Memorial card generation failed after ComfyUI completion:', error);
    }
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    const dirPath = path.join(process.cwd(), dir);
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async ensureDirectoryExistsAbsolute(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  private async showExitConfirmation(): Promise<void> {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // ComfyUI状態を取得
        let comfyUIStatus = { 
          activeJobs: [] as Array<{datetime: string, status: string, duration: number}>, 
          internalQueueLength: 0,
          serverQueueRunning: 0,
          serverQueuePending: 0
        };
        if (this.comfyUIService) {
          try {
            const activeJobs = this.comfyUIService.getActiveJobs();
            comfyUIStatus = {
              activeJobs,
              internalQueueLength: activeJobs.length,
              serverQueueRunning: 0,
              serverQueuePending: 0
            };
          } catch (error) {
            console.error('Failed to get ComfyUI status for exit confirmation:', error);
          }
        }

        // レンダラープロセスに終了確認ダイアログの表示を要求
        this.mainWindow.webContents.send('show-exit-confirmation', comfyUIStatus);
      }
    } catch (error) {
      console.error('Failed to show exit confirmation:', error);
      // エラー時は強制終了を許可
      this.exitConfirmed = true;
      app.quit();
    }
  }

}

// アプリケーション開始
new ElectronApp();