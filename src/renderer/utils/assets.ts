// アセット管理システム
import type { AssetKey } from '@shared/utils/constants';

export interface AssetManager {
  sounds: Record<string, HTMLAudioElement>;
  images: Record<string, HTMLImageElement>;
  isLoaded: boolean;
}

// 音声ファイルの定義
export const SOUND_ASSETS = {
  action: new URL('../assets/sounds/action.mp3', import.meta.url).href,
  bell: new URL('../assets/sounds/bell.mp3', import.meta.url).href,
  buttonClick: new URL('../assets/sounds/button_click.mp3', import.meta.url).href,
  jump: new URL('../assets/sounds/jump.mp3', import.meta.url).href,
  machine: new URL('../assets/sounds/machine.mp3', import.meta.url).href,
  newtype: new URL('../assets/sounds/newtype.mp3', import.meta.url).href,
  ng: new URL('../assets/sounds/ng.mp3', import.meta.url).href,
  paltu: new URL('../assets/sounds/paltu.mp3', import.meta.url).href,
  screenChange: new URL('../assets/sounds/screen_change.mp3', import.meta.url).href,
  sound7: new URL('../assets/sounds/sound7.mp3', import.meta.url).href
} as const;

// 画像ファイルの定義
export const IMAGE_ASSETS = {
  spriteItems: new URL('../assets/images/sprite_items.png', import.meta.url).href,
  titleImage01: new URL('../assets/images/title_image_01.png', import.meta.url).href,
  titleImage02: new URL('../assets/images/title_image_02.png', import.meta.url).href,
  titleImage03: new URL('../assets/images/title_image_03.png', import.meta.url).href,
  titleImage04: new URL('../assets/images/title_image_04.png', import.meta.url).href
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
          resolve();
        });

        audio.addEventListener('loadeddata', () => {
          clearTimeout(timeoutId);
          assetManager.sounds[key] = audio;
          resolve();
        });

        audio.addEventListener('error', (e) => {
          clearTimeout(timeoutId);
          console.error(`音声ファイルの読み込みに失敗しました: ${path}`, e);
          resolve(); // エラーでも続行
        });

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
    

    return assetManager;

  } catch (error) {
    console.error('アセット読み込みエラー:', error);
    assetManager.isLoaded = true; // エラーでも続行を許可
    globalAssetManager = assetManager;
    return assetManager;
  }
};

// 特定のアセットをプリロードする関数
export const preloadSpecificAssets = async (assetKeys: AssetKey[]): Promise<void> => {
  if (!globalAssetManager) {
    globalAssetManager = {
      sounds: {},
      images: {},
      isLoaded: false,
    };
  }

  const promises: Promise<void>[] = [];

  for (const key of assetKeys) {
    // Sound assets
    if (key in SOUND_ASSETS) {
      const soundKey = key as keyof typeof SOUND_ASSETS;
      if (globalAssetManager.sounds[soundKey]) continue; // Already loaded

      const path = SOUND_ASSETS[soundKey];
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.7;

      const promise = new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn(`[Specific] 音声ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve();
        }, 10000);

        const onCanPlay = () => {
          clearTimeout(timeoutId);
          if(globalAssetManager) globalAssetManager.sounds[soundKey] = audio;
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve();
        };

        const onError = (e: Event) => {
          clearTimeout(timeoutId);
          console.error(`[Specific] 音声ファイルの読み込みに失敗しました: ${path}`, e);
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve(); // Resolve anyway
        };

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onError);

        audio.src = path;
        audio.load();
      });
      promises.push(promise);
    }
    // Image assets
    else if (key in IMAGE_ASSETS) {
      const imageKey = key as keyof typeof IMAGE_ASSETS;
      if (globalAssetManager.images[imageKey]) continue; // Already loaded

      const path = IMAGE_ASSETS[imageKey];
      const img = new Image();

      const promise = new Promise<void>((resolve) => {
         const timeoutId = setTimeout(() => {
          console.warn(`[Specific] 画像ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve();
        }, 5000);

        img.onload = () => {
          clearTimeout(timeoutId);
          if(globalAssetManager) globalAssetManager.images[imageKey] = img;
          resolve();
        };

        img.onerror = (e) => {
          clearTimeout(timeoutId);
          console.warn(`[Specific] 画像ファイルの読み込みに失敗しました: ${path}`, e);
          resolve();
        };
        img.src = path;
      });
      promises.push(promise);
    }
  }

  await Promise.all(promises);

  // Check if all assets are now loaded to set the global flag
  const allSoundKeys = Object.keys(SOUND_ASSETS);
  const allImageKeys = Object.keys(IMAGE_ASSETS);
  if (globalAssetManager) {
    const loadedSoundKeys = Object.keys(globalAssetManager.sounds);
    const loadedImageKeys = Object.keys(globalAssetManager.images);

    if(allSoundKeys.every(k => loadedSoundKeys.includes(k)) && allImageKeys.every(k => loadedImageKeys.includes(k))) {
      globalAssetManager.isLoaded = true;
    }
  }
};

// アセットマネージャーを取得する関数
export const getAssetManager = (): AssetManager | null => {
  return globalAssetManager;
};

// AudioContextの管理
let audioContext: AudioContext | null = null;
let audioInitialized = false;

const getAudioContext = (): AudioContext | null => {
  if (audioContext) return audioContext;
  
  const AudioCtx = window.AudioContext || (window as Window & typeof globalThis).webkitAudioContext;
  if (AudioCtx) {
    audioContext = new AudioCtx();
    return audioContext;
  }
  
  console.warn('AudioContext is not supported in this browser.');
  return null;
};

// 音声システムを初期化する関数（最初のユーザーインタラクション時に呼び出し）
export const initializeAudioSystem = async (): Promise<void> => {
  if (audioInitialized) {
    return;
  }

  const context = getAudioContext();
  if (context && context.state === 'suspended') {
    try {
      await context.resume();
      audioInitialized = true;
    } catch (e) {
      console.error('❌ Failed to resume AudioContext:', e);
    }
  } else if (context) {
    // 状態が 'running' または 'closed' の場合
    audioInitialized = true;
  }
};

// 音声を再生する関数
export const playSound = async (soundKey: keyof typeof SOUND_ASSETS, volume: number = 0.7): Promise<void> => {
  
  // ユーザー操作によるAudioContextの初期化を試みる
  await initializeAudioSystem();

  if (!audioInitialized) {
    console.warn(`⚠️ 音声システムが初期化されていません。ユーザー操作後に再試行してください。`);
    // 初期化に失敗しても、play()を試みる（一部ブラウザでは動作するため）
  }

  const assetManager = getAssetManager();
  if (!assetManager || !assetManager.sounds || !assetManager.sounds[soundKey]) {
    console.error(`❌ 音声アセットが見つかりません: ${soundKey}`);
    return;
  }

  try {
    const audio = assetManager.sounds[soundKey];

    audio.muted = false;
    audio.volume = Math.max(0, Math.min(1, volume)); // 0も許容
    audio.currentTime = 0;

    
    await audio.play();

  } catch (error) {
    const e = error as Error;
    console.error(`❌ 音声再生に失敗しました: ${soundKey}`, {
      errorName: e.name,
      errorMessage: e.message,
    });
    
    if (e.name === 'NotAllowedError') {
      console.warn('👉 ブラウザの自動再生ポリシーによりブロックされました。ユーザーの操作（クリックなど）を待ってから再度試行してください。');
    }
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

// PixiJSアセットのプリロード管理
let pixiAssetsPreloaded = false;
let pixiPreloadPromise: Promise<void> | null = null;

// PixiJSアセットを事前読み込みする関数
export const preloadPixiAssets = async (): Promise<void> => {
  if (pixiAssetsPreloaded) {
    return Promise.resolve();
  }
  
  if (pixiPreloadPromise) {
    return pixiPreloadPromise;
  }

  pixiPreloadPromise = (async () => {
    try {
      
      // PixiJS.Assets を動的インポート
      const PIXI = await import('pixi.js');
      
      // スプライトシートを事前読み込み
      const spriteUrl = IMAGE_ASSETS.spriteItems;
      
      // タイムアウト付きで読み込み
      await Promise.race([
        PIXI.Assets.load(spriteUrl),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PixiJSプリロードタイムアウト')), 30000)
        )
      ]);
      
      pixiAssetsPreloaded = true;
      
    } catch (error) {
      console.warn('PixiJSアセットのプリロードに失敗しました:', error);
      // エラーでも続行（後でGamePageで再試行）
      pixiAssetsPreloaded = false;
    }
  })();
  
  return pixiPreloadPromise;
};

// PixiJSアセットがプリロード済みかチェック
export const isPixiAssetsPreloaded = (): boolean => {
  return pixiAssetsPreloaded;
};
