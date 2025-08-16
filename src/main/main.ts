import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ComfyUIService } from './services/comfyui-service';
import { MemorialCardService } from './services/memorial-card-service';
import type { AppConfig } from '@shared/types';
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
  private memorialCardGenerationFlags = new Set<string>(); // 重複防止用フラグ

  constructor() {
    this.initializeApp();
  }

  private async loadConfig(): Promise<AppConfig | null> {
    try {
      const configPath = path.join(app.getAppPath(), 'config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error('設定ファイルの読み込みに失敗しました:', error);
      return null;
    }
  }

  private initializeApp(): void {
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

      // resultsフォルダの存在を確認・作成
      await this.ensureDirectoryExists('results');

      this.createMainWindow();
      this.setupIPC();
      await this.initializeServices();
    });

    app.on('window-all-closed', async () => {
      if (this.comfyUIService) {
        await this.comfyUIService.destroy();
      }
      if (process.platform !== 'darwin') {
        app.quit();
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
        experimentalFeatures: false
      },
      icon: path.join(__dirname, '../../../assets/icon.png'),
      title: 'KidsPG - よけまくり中'
    });

    // 開発環境ではViteサーバー、本番環境では静的ファイルを読み込み
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    }

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
        contextIsolation: true
      },
      title: 'ランキング表示'
    });

    // ランキングHTMLファイルを読み込み
    const rankingPath = path.join(process.cwd(), 'ranking.html');
    this.rankingWindow.loadFile(rankingPath).catch(() => {
      // ファイルが存在しない場合はプレースホルダーを表示
      this.rankingWindow?.loadURL('data:text/html,<h1>ランキング準備中...</h1>');
    });

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
          const dummyPhotoPath = path.join(app.getAppPath(), 'assets', 'dummy_photo.png');
          try {
            await fs.copyFile(dummyPhotoPath, filePath);
            console.log(`Copied dummy_photo.png to: ${filePath}`);
            
            // ダミー画像用のphoto_anime_*.pngも即座に作成
            const animePhotoPath = path.join(dirPath, `photo_anime_${dateTime}.png`);
            await fs.copyFile(dummyPhotoPath, animePhotoPath);
            console.log(`Created photo_anime file from dummy_photo.png: ${animePhotoPath}`);
          } catch (copyError) {
            console.warn('Failed to copy dummy_photo.png, using generated image:', copyError);
            await fs.writeFile(filePath, base64Data, 'base64');
          }
        } else {
          // 実画像の場合、通常通り保存
          await fs.writeFile(filePath, base64Data, 'base64');
        }
        
        if (isDummy) {
          console.log(`ElectronApp - Dummy image detected for ${dateTime}, memorial card will be generated after result.json is saved`);
          // ダミー画像の場合：メモリアルカード生成はresult.json保存後に実行
        } else {
          // 実画像の場合：通常のComfyUI処理
          if (this.config?.comfyui) {
            try {
              const templatePath = path.join(app.getAppPath(), this.config.comfyui.workflow.templatePath);
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
              console.log(`Created image_generate.json with processed workflow: ${imageGeneratePath}`);

              // ComfyUIが有効な場合、即座に画像をアップロード＆変換開始
              if (this.comfyUIService) {
                try {
                  console.log(`Starting pre-upload and transform for datetime: ${dateTime}`);
                  // 1. プリアップロード
                  await this.comfyUIService.preUploadImage(base64Data, dateTime);
                  console.log(`Pre-upload completed for datetime: ${dateTime}`);
                  
                  // 2. 即座に変換開始
                  const jobId = await this.comfyUIService.transformImage({
                    imageData: base64Data,
                    datetime: dateTime,
                    resultDir: dirPath
                  });
                  console.log(`ComfyUI transformation started immediately: ${jobId} for ${dateTime}`);
                } catch (error) {
                  console.warn('Pre-upload or transform failed, will handle later:', error);
                }
              }
            } catch (error) {
              console.error('Failed to create image_generate.json:', error);
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
                console.log(`ElectronApp - Memorial card generation already in progress/completed for: ${dateTime}`);
                return { success: true, filePath: filePath };
              }
              
              this.memorialCardGenerationFlags.add(dateTime);
              console.log(`ElectronApp - Starting memorial card generation for dummy image: ${dateTime}`);
              
              setTimeout(async () => {
                try {
                  if (this.memorialCardService) {
                    await this.memorialCardService.generateFromDummyImage(dateTime, dirPath);
                  }
                } catch (error) {
                  console.error('ElectronApp - Memorial card generation error:', error);
                }
              }, 100);
            } else {
              console.log(`ElectronApp - AI-generated image detected, memorial card will be handled by ComfyUI completion`);
            }
          }
        } catch (checkError) {
          console.warn('ElectronApp - Error checking for dummy image memorial card generation:', checkError);
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
          console.log(`ComfyUI job already exists for datetime: ${datetime}`);
          return { success: false, error: `Job already exists for ${datetime}` };
        }

        const jobId = await this.comfyUIService.transformImage({
          imageData,
          datetime,
          resultDir
        });

        console.log(`ComfyUI transformation started: ${jobId} for ${datetime}`);
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
  }

  private async initializeServices(): Promise<void> {
    // メモリアルカードサービスは常に初期化（ComfyUIに依存しない）
    await this.initializeMemorialCardService();
    
    // ComfyUIサービスは設定がある場合のみ初期化
    await this.initializeComfyUI();
  }

  private async initializeMemorialCardService(): Promise<void> {
    try {
      if (!this.config?.memorialCard) {
        console.log('Memorial card configuration not found, skipping initialization');
        return;
      }

      this.memorialCardService = new MemorialCardService(
        this.config.memorialCard,
        this.mainWindow || undefined
      );
      console.log('Memorial Card Service initialized successfully');
    } catch (error) {
      console.error('Memorial Card Service initialization failed:', error);
      this.memorialCardService = null;
    }
  }

  private async initializeComfyUI(): Promise<void> {
    try {
      if (!this.config?.comfyui) {
        console.log('ComfyUI configuration not found, skipping initialization');
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
      
      console.log('ComfyUI Service initialized successfully');
    } catch (error) {
      console.error('ComfyUI initialization failed:', error);
      this.comfyUIService = null;
    }
  }


  private async handleComfyUICompletion(jobId: string, resultDir: string): Promise<void> {
    if (!this.memorialCardService) {
      console.warn('ElectronApp - Memorial card service not available for ComfyUI completion');
      return;
    }

    // 重複防止チェック（AI画像用）
    const dateTime = path.basename(resultDir);
    if (this.memorialCardGenerationFlags.has(dateTime)) {
      console.log(`ElectronApp - Memorial card generation already completed for AI image: ${dateTime}`);
      return;
    }

    try {
      this.memorialCardGenerationFlags.add(dateTime);
      console.log(`ElectronApp - Starting memorial card generation for AI image: ${jobId}`);
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

}

// アプリケーション開始
new ElectronApp();