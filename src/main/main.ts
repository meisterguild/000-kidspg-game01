import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

// Electronメインプロセス
class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private rankingWindow: BrowserWindow | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(() => {
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
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../../assets/icon.png'),
      title: 'KidsPG - よけまくり中'
    });

    // 開発環境ではViteサーバー、本番環境では静的ファイルを読み込み
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
      parent: this.mainWindow || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      title: 'ランキング表示'
    });

    // ランキングHTMLファイルを読み込み
    const rankingPath = path.join(process.cwd(), 'public', 'index.html');
    this.rankingWindow.loadFile(rankingPath).catch(() => {
      // ファイルが存在しない場合はプレースホルダーを表示
      this.rankingWindow?.loadURL('data:text/html,<h1>ランキング準備中...</h1>');
    });

    this.rankingWindow.on('closed', () => {
      this.rankingWindow = null;
    });
  }

  private setupIPC(): void {
    // ゲーム結果保存
    ipcMain.handle('save-game-result', async (event, result) => {
      try {
        await this.ensureDirectoryExists('results');
        const filename = `result_${Date.now()}.json`;
        const filepath = path.join(process.cwd(), 'results', filename);
        
        await fs.writeFile(filepath, JSON.stringify(result, null, 2));
        return { success: true, filepath };
      } catch (error) {
        console.error('Failed to save game result:', error);
        return { success: false, error: String(error) };
      }
    });

    // 画像ファイル保存
    ipcMain.handle('save-image-file', async (event, imageData, filename) => {
      try {
        await this.ensureDirectoryExists('cards');
        const filepath = path.join(process.cwd(), 'cards', filename);
        
        // Base64データをバイナリに変換して保存
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        await fs.writeFile(filepath, base64Data, 'base64');
        
        return { success: true, filepath };
      } catch (error) {
        console.error('Failed to save image file:', error);
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