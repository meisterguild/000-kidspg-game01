import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

interface AppConfig {
  game: {
    obstacle: {
      speed: {
        min: number;
        max: number;
        incrementPerLevel: number;
      };
      spawnDistance: {
        min: number;
        max: number;
        decrementPerLevel: number;
      };
    };
    lane: {
      count: number;
    };
    levelUpScoreInterval: number;
    targetFPS: number;
  };
}

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
    });

    app.on('window-all-closed', () => {
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
      height: 800,
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
      width: 1024,
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
    ipcMain.handle('save-photo', async (event, imageData: string) => {
      try {
        const dateTime = getFormattedDateTime(new Date());
        const dirPath = path.join(process.cwd(), 'results', dateTime);
        await fs.mkdir(dirPath, { recursive: true });

        const filePath = path.join(dirPath, 'photo.png');
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        await fs.writeFile(filePath, base64Data, 'base64');

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