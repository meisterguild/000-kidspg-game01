// アセット管理システム
export interface AssetManager {
  sounds: Record<string, HTMLAudioElement>;
  images: Record<string, HTMLImageElement>;
  isLoaded: boolean;
}

// 音声ファイルの定義
export const SOUND_ASSETS = {
  action: './assets/sounds/action.mp3',
  bell: './assets/sounds/bell.mp3',
  buttonClick: './assets/sounds/button_click.mp3',
  jump: './assets/sounds/jump.mp3',
  machine: './assets/sounds/machine.mp3',
  newtype: './assets/sounds/newtype.mp3',
  ng: './assets/sounds/ng.mp3',
  paltu: './assets/sounds/paltu.mp3',
  screenChange: './assets/sounds/screen_change.mp3',
  sound7: './assets/sounds/sound7.mp3'
} as const;

// 画像ファイルの定義
export const IMAGE_ASSETS = {
  spriteItems: './assets/images/sprite_items.png'
} as const;

// グローバルアセットマネージャー
let globalAssetManager: AssetManager | null = null;

// アセットローダー関数
export const loadAssets = async (): Promise<AssetManager> => {
  if (globalAssetManager?.isLoaded) {
    return globalAssetManager;
  }

  const assetManager: AssetManager = {
    sounds: {},
    images: {},
    isLoaded: false
  };

  try {
    // 音声ファイルの読み込み
    const soundPromises = Object.entries(SOUND_ASSETS).map(async ([key, path]) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.7; // デフォルト音量
      
      return new Promise<void>((resolve, _reject) => {
        const timeoutId = setTimeout(() => {
          console.warn(`音声ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve(); // タイムアウトでもエラーにしない
        }, 10000);

        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeoutId);
          assetManager.sounds[key] = audio;
          console.log(`音声ファイル読み込み成功: ${key} -> ${path}`);
          resolve();
        });

        audio.addEventListener('loadeddata', () => {
          clearTimeout(timeoutId);
          assetManager.sounds[key] = audio;
          console.log(`音声ファイル読み込み成功(loadeddata): ${key} -> ${path}`);
          resolve();
        });

        audio.addEventListener('error', (e) => {
          clearTimeout(timeoutId);
          console.error(`音声ファイルの読み込みに失敗しました: ${path}`, e);
          resolve(); // エラーでも続行
        });

        console.log(`音声ファイル読み込み開始: ${key} -> ${path}`);
        audio.src = path;
        audio.load(); // 明示的に読み込み開始
      });
    });

    // 画像ファイルの読み込み
    const imagePromises = Object.entries(IMAGE_ASSETS).map(async ([key, path]) => {
      const img = new Image();
      
      return new Promise<void>((resolve, _reject) => {
        const timeoutId = setTimeout(() => {
          console.warn(`画像ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve(); // タイムアウトでもエラーにしない
        }, 5000);

        img.onload = () => {
          clearTimeout(timeoutId);
          assetManager.images[key] = img;
          resolve();
        };

        img.onerror = (e) => {
          clearTimeout(timeoutId);
          console.warn(`画像ファイルの読み込みに失敗しました: ${path}`, e);
          resolve(); // エラーでも続行
        };

        img.src = path;
      });
    });

    // すべてのアセットの読み込みを待つ
    await Promise.all([...soundPromises, ...imagePromises]);
    
    assetManager.isLoaded = true;
    globalAssetManager = assetManager;
    
    console.log('アセット読み込み完了:', {
      sounds: Object.keys(assetManager.sounds).length,
      images: Object.keys(assetManager.images).length
    });

    return assetManager;

  } catch (error) {
    console.error('アセット読み込みエラー:', error);
    assetManager.isLoaded = true; // エラーでも続行を許可
    globalAssetManager = assetManager;
    return assetManager;
  }
};

// アセットマネージャーを取得する関数
export const getAssetManager = (): AssetManager | null => {
  return globalAssetManager;
};

// 音声を再生する関数
export const playSound = (soundKey: keyof typeof SOUND_ASSETS, volume: number = 0.7): void => {
  console.log(`音声再生試行: ${soundKey}`);
  
  const assetManager = getAssetManager();
  if (!assetManager?.sounds[soundKey]) {
    console.warn(`音声が見つかりません: ${soundKey}`, assetManager);
    return;
  }

  try {
    const audio = assetManager.sounds[soundKey];
    audio.volume = Math.max(0, Math.min(1, volume)); // 0-1の範囲に制限
    audio.currentTime = 0; // 再生位置をリセット
    
    console.log(`音声再生開始: ${soundKey}, volume: ${audio.volume}`);
    audio.play().then(() => {
      console.log(`音声再生成功: ${soundKey}`);
    }).catch(e => {
      console.warn(`音声再生に失敗しました: ${soundKey}`, e);
    });
  } catch (error) {
    console.warn(`音声再生エラー: ${soundKey}`, error);
  }
};

// 画像を取得する関数
export const getImage = (imageKey: keyof typeof IMAGE_ASSETS): HTMLImageElement | null => {
  const assetManager = getAssetManager();
  if (!assetManager?.images[imageKey]) {
    console.warn(`画像が見つかりません: ${imageKey}`);
    return null;
  }
  return assetManager.images[imageKey];
};

// アセットの事前読み込み状況を確認する関数
export const isAssetsLoaded = (): boolean => {
  return globalAssetManager?.isLoaded ?? false;
};