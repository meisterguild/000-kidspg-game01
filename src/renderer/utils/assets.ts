import { TIMING_CONFIG } from '@shared/utils/constants';
import * as PIXI from 'pixi.js'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { AssetKey } from '@shared/utils/constants';

export interface AssetManager {
  sounds: Record<string, HTMLAudioElement>;
  images: Record<string, HTMLImageElement>;
  isLoaded: boolean;
}

export const getSoundAssetPath = async (key: keyof typeof SOUND_ASSET_RELATIVE_PATHS): Promise<string> => {
  const relativePath = SOUND_ASSET_RELATIVE_PATHS[key];
    if (import.meta.env.PROD) {
      const electronApi = window.electronAPI;
      return await electronApi.getAssetAbsolutePath(`assets/sounds/${relativePath}`);
    } else {
      return new URL(`../assets/sounds/${relativePath}`, import.meta.url).href;
    }
  };

export const getImageAssetPath = async (key: keyof typeof IMAGE_ASSET_RELATIVE_PATHS): Promise<string> => {
  console.log('assets.ts: getImageAssetPath called with key:', key);
  
  const relativePath = IMAGE_ASSET_RELATIVE_PATHS[key];
  console.log('assets.ts: Relative path for key:', relativePath);
  
  if (import.meta.env.PROD) {
    console.log('assets.ts: Production environment detected');
    console.log('assets.ts: Checking for electronAPI availability...');
    
    const electronApi = window.electronAPI;
    if (!electronApi) {
      console.error('assets.ts: CRITICAL - electronAPI is not available!');
      throw new Error('electronAPI is not available in production environment');
    }
    
    if (!electronApi.getAssetAbsolutePath) {
      console.error('assets.ts: CRITICAL - getAssetAbsolutePath method is not available!');
      throw new Error('getAssetAbsolutePath method is not available');
    }
    
    const assetRelativePath = `assets/images/${relativePath}`;
    console.log('assets.ts: Calling electronAPI.getAssetAbsolutePath with:', assetRelativePath);
    
    try {
      const absolutePath = await electronApi.getAssetAbsolutePath(assetRelativePath);
      console.log('assets.ts: Absolute path resolved:', absolutePath);
      
      // PixiJS読み込み用のパス形式を決定
      if (typeof absolutePath === 'string') {
        // まずは直接パスを返す（Electronの場合、これが最も確実）
        console.log('assets.ts: Returning direct path for Electron:', absolutePath);
        return absolutePath;
        
        // 以下はfile://プロトコルの代替案（コメントアウト）
        // if (absolutePath.includes('\\')) {
        //   // Windows パスの場合、file:// プロトコルを付与
        //   const fileUrl = `file:///${absolutePath.replace(/\\/g, '/')}`;
        //   console.log('assets.ts: Converted to file URL:', fileUrl);
        //   return fileUrl;
        // }
      }
      
      return absolutePath;
    } catch (error) {
      console.error('assets.ts: CRITICAL - electronAPI.getAssetAbsolutePath failed:', error);
      throw error;
    }
  } else {
    console.log('assets.ts: Development environment detected');
    const url = new URL(`../assets/images/${relativePath}`, import.meta.url).href;
    console.log('assets.ts: Development URL generated:', url);
    return url;
  }
};

const SOUND_ASSET_RELATIVE_PATHS = {
  action: 'action.mp3',
  bell: 'bell.mp3',
  buttonClick: 'button_click.mp3',
  jump: 'jump.mp3',
  machine: 'machine.mp3',
  newtype: 'newtype.mp3',
  ng: 'ng.mp3',
  paltu: 'paltu.mp3',
  screenChange: 'screen_change.mp3',
  sound7: 'sound7.mp3'
} as const;

const IMAGE_ASSET_RELATIVE_PATHS = {
  spriteItems: 'sprite_items.png',
  titleImage01: 'title_image_01.png',
  titleImage02: 'title_image_02.png',
  titleImage03: 'title_image_03.png',
  titleImage04: 'title_image_04.png'
} as const;

// 画像パスオブジェクトを非同期で取得する関数
export const getImageAssets = async () => {
  return {
    titleImage01: await getImageAssetPath('titleImage01'),
    titleImage02: await getImageAssetPath('titleImage02'),
    titleImage03: await getImageAssetPath('titleImage03'),
    titleImage04: await getImageAssetPath('titleImage04'),
    spriteItems: await getImageAssetPath('spriteItems')
  } as const;
};

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
    const soundPromises = Object.entries(SOUND_ASSET_RELATIVE_PATHS).map(async ([key, _]) => {
      const path = await getSoundAssetPath(key as keyof typeof SOUND_ASSET_RELATIVE_PATHS);
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.7;
      
      return new Promise<void>((resolve, _reject) => {
        const timeoutId = setTimeout(() => {
          console.warn(`音声ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve();
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
          resolve();
        });

        audio.src = path;
        audio.load();
      });
    });

    const imagePromises = Object.entries(IMAGE_ASSET_RELATIVE_PATHS).map(async ([key, _]) => {
      const path = await getImageAssetPath(key as keyof typeof IMAGE_ASSET_RELATIVE_PATHS);
      const img = new Image();

      return new Promise<void>((resolve, _reject) => {
        const timeoutId = setTimeout(() => {
          console.warn(`画像ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve();
        }, TIMING_CONFIG.comfyuiTimeout);

        img.onload = () => {
          clearTimeout(timeoutId);
          assetManager.images[key] = img;
          resolve();
        };

        img.onerror = (e) => {
          clearTimeout(timeoutId);
          console.warn(`画像ファイルの読み込みに失敗しました: ${path}`, e);
          resolve();
        };

        img.src = path;
      });
    });

    await Promise.all([...soundPromises, ...imagePromises]);
    
    assetManager.isLoaded = true;
    globalAssetManager = assetManager;
    

    return assetManager;

  } catch (error) {
    console.error('アセット読み込みエラー:', error);
    assetManager.isLoaded = true;
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
    if (key in SOUND_ASSET_RELATIVE_PATHS) {
      const soundKey = key as keyof typeof SOUND_ASSET_RELATIVE_PATHS;
      if (globalAssetManager.sounds[soundKey]) continue;

      const path = await getSoundAssetPath(soundKey);
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
          resolve();
        };

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onError);

        audio.src = path;
        audio.load();
      });
      promises.push(promise);
    }
    else if (key in IMAGE_ASSET_RELATIVE_PATHS) {
      const imageKey = key as keyof typeof IMAGE_ASSET_RELATIVE_PATHS;
      if (globalAssetManager.images[imageKey]) continue;

      const path = await getImageAssetPath(imageKey);
      const img = new Image();

      const promise = new Promise<void>((resolve) => {
         const timeoutId = setTimeout(() => {
          console.warn(`[Specific] 画像ファイルの読み込みがタイムアウトしました: ${path}`);
          resolve();
        }, TIMING_CONFIG.comfyuiTimeout);

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

  const allSoundKeys = Object.keys(SOUND_ASSET_RELATIVE_PATHS);
  const allImageKeys = Object.keys(IMAGE_ASSET_RELATIVE_PATHS);
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
export const playSound = async (soundKey: keyof typeof SOUND_ASSET_RELATIVE_PATHS, volume: number = 0.7): Promise<void> => {
  
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
export const getImage = (imageKey: keyof typeof IMAGE_ASSET_RELATIVE_PATHS): HTMLImageElement | null => {
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
      
      const PixiGlobal = PIXI;

      // スプライトシートを事前読み込み
      const spriteUrl = await getImageAssetPath('spriteItems');

      // タイムアウト付きで読み込み
      await Promise.race([
        PixiGlobal.Assets.load(spriteUrl),
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
