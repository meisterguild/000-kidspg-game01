import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { getImageAssetPath } from '../utils/assets';

interface SpriteInfo {
  name: string;
  x: number;
  y: number;
  description: string;
}

// スプライトシート設定: 1024x1536px, 7列x11行
const SPRITE_COLS = 7;
const SPRITE_ROWS = 11;

// 余白調整パラメーター（微調整用）
const PADDING_TOP = 13;      // 上端の余白
const PADDING_LEFT = 16;     // 左端の余白
const PADDING_RIGHT = 10;    // 右端の余白
const PADDING_BOTTOM = 10;   // 下端の余白

// 実際に使用可能な領域サイズ
const USABLE_WIDTH = 1024 - PADDING_LEFT - PADDING_RIGHT;
const USABLE_HEIGHT = 1536 - PADDING_TOP - PADDING_BOTTOM;

// 調整後のスプライトサイズ
const SPRITE_WIDTH = Math.floor(USABLE_WIDTH / SPRITE_COLS) - 2;
const SPRITE_HEIGHT = Math.floor(USABLE_HEIGHT / SPRITE_ROWS) - 0;

// スプライト座標計算ヘルパー関数
const getSpriteX = (col: number) => PADDING_LEFT + col * SPRITE_WIDTH;
const getSpriteY = (row: number) => PADDING_TOP + row * SPRITE_HEIGHT;

const SPRITE_MAP: SpriteInfo[] = [
  // 行1 (Y: 0)
  { name: "blue_cube", x: getSpriteX(0), y: getSpriteY(0), description: "青いキューブ" },
  { name: "green_cube", x: getSpriteX(1), y: getSpriteY(0), description: "緑のキューブ" },
  { name: "green_smile_cube", x: getSpriteX(2), y: getSpriteY(0), description: "緑の笑顔キューブ ⭐ プレイヤー推奨" },
  { name: "green_sphere", x: getSpriteX(3), y: getSpriteY(0), description: "緑の球体" },
  { name: "red_cube", x: getSpriteX(4), y: getSpriteY(0), description: "赤いキューブ ⭐ 敵候補" },
  { name: "yellow_cube", x: getSpriteX(5), y: getSpriteY(0), description: "黄色キューブ" },
  { name: "purple_cube", x: getSpriteX(6), y: getSpriteY(0), description: "紫キューブ" },
  
  // 行2
  { name: "green_grid_cube", x: getSpriteX(0), y: getSpriteY(1), description: "緑のキューブ（グリッド）" },
  { name: "orange_cube", x: getSpriteX(1), y: getSpriteY(1), description: "オレンジキューブ" },
  { name: "red_smile_cube", x: getSpriteX(2), y: getSpriteY(1), description: "赤の笑顔キューブ ⭐ 敵推奨" },
  { name: "blue_sphere", x: getSpriteX(3), y: getSpriteY(1), description: "青い球体" },
  { name: "blue_x_cube", x: getSpriteX(4), y: getSpriteY(1), description: "青いキューブ（X印）" },
  { name: "blue_transparent_cube", x: getSpriteX(5), y: getSpriteY(1), description: "青いキューブ（透明）" },
  { name: "brown_cube", x: getSpriteX(6), y: getSpriteY(1), description: "茶色キューブ" },

  // 行3
  { name: "purple_smile", x: getSpriteX(0), y: getSpriteY(2), description: "紫の笑顔" },
  { name: "orange_smile", x: getSpriteX(1), y: getSpriteY(2), description: "オレンジの笑顔" },
  { name: "yellow_star", x: getSpriteX(2), y: getSpriteY(2), description: "黄色い星" },
  { name: "orange_triangle", x: getSpriteX(3), y: getSpriteY(2), description: "オレンジの三角" },
  { name: "blue_drop", x: getSpriteX(4), y: getSpriteY(2), description: "青い水滴" },
  { name: "blue_bird", x: getSpriteX(5), y: getSpriteY(2), description: "青い鳥" },
  { name: "blue_lightning", x: getSpriteX(6), y: getSpriteY(2), description: "青い稲妻" },

  // 行4
  { name: "red_flame", x: getSpriteX(0), y: getSpriteY(3), description: "赤い火炎" },
  { name: "pink_flower", x: getSpriteX(1), y: getSpriteY(3), description: "ピンクの花" },
  { name: "blue_water_drop", x: getSpriteX(2), y: getSpriteY(3), description: "青い水滴" },
  { name: "green_recycle", x: getSpriteX(3), y: getSpriteY(3), description: "緑のリサイクル" },
  { name: "brown_rock", x: getSpriteX(4), y: getSpriteY(3), description: "茶色の岩" },
  { name: "blue_3d_cube", x: getSpriteX(5), y: getSpriteY(3), description: "青いキューブ（3D）" },
  { name: "blue_crystal", x: getSpriteX(6), y: getSpriteY(3), description: "青い結晶" },

  // 行5
  { name: "blue_cube_5", x: getSpriteX(0), y: getSpriteY(4), description: "青いキューブ" },
  { name: "green_cat", x: getSpriteX(1), y: getSpriteY(4), description: "緑の猫" },
  { name: "orange_cat", x: getSpriteX(2), y: getSpriteY(4), description: "オレンジの猫" },
  { name: "yellow_cat", x: getSpriteX(3), y: getSpriteY(4), description: "黄色の猫" },
  { name: "beige_cat", x: getSpriteX(4), y: getSpriteY(4), description: "ベージュの猫" },
  { name: "green_potion", x: getSpriteX(5), y: getSpriteY(4), description: "緑のポーション瓶" },
  { name: "panda_face", x: getSpriteX(6), y: getSpriteY(4), description: "パンダの顔" },

  // 行6
  { name: "orange_fruit", x: getSpriteX(0), y: getSpriteY(5), description: "オレンジ" },
  { name: "red_heart", x: getSpriteX(1), y: getSpriteY(5), description: "赤いハート" },
  { name: "yellow_banana", x: getSpriteX(2), y: getSpriteY(5), description: "黄色いバナナ" },
  { name: "red_apple", x: getSpriteX(3), y: getSpriteY(5), description: "赤いリンゴ" },
  { name: "coffee_bean", x: getSpriteX(4), y: getSpriteY(5), description: "コーヒー豆" },
  { name: "eye", x: getSpriteX(5), y: getSpriteY(5), description: "目玉" },
  { name: "black_sphere", x: getSpriteX(6), y: getSpriteY(5), description: "黒い球" },

  // 行7
  { name: "brown_bear", x: getSpriteX(0), y: getSpriteY(6), description: "茶色のクマ" },
  { name: "white_rabbit", x: getSpriteX(1), y: getSpriteY(6), description: "白いウサギ" },
  { name: "yellow_smile_1", x: getSpriteX(2), y: getSpriteY(6), description: "黄色い笑顔" },
  { name: "yellow_smile_2", x: getSpriteX(3), y: getSpriteY(6), description: "黄色い笑顔（別）" },
  { name: "red_strawberry", x: getSpriteX(4), y: getSpriteY(6), description: "赤いイチゴ" },
  { name: "black_bomb", x: getSpriteX(5), y: getSpriteY(6), description: "黒い爆弾" },
  { name: "black_sphere_2", x: getSpriteX(6), y: getSpriteY(6), description: "黒い球" },

  // 行8
  { name: "blue_triangle", x: getSpriteX(0), y: getSpriteY(7), description: "青い三角" },
  { name: "blue_square", x: getSpriteX(1), y: getSpriteY(7), description: "青い四角" },
  { name: "green_circle", x: getSpriteX(2), y: getSpriteY(7), description: "緑の円" },
  { name: "orange_circle", x: getSpriteX(3), y: getSpriteY(7), description: "オレンジの円" },
  { name: "blue_c", x: getSpriteX(4), y: getSpriteY(7), description: "青い「C」" },
  { name: "yellow_b", x: getSpriteX(5), y: getSpriteY(7), description: "黄色い「B」" },
  { name: "green_c", x: getSpriteX(6), y: getSpriteY(7), description: "緑の「C」" },

  // 行9
  { name: "sprite_row9_1", x: getSpriteX(0), y: getSpriteY(8), description: "9行目1列目" },
  { name: "sprite_row9_2", x: getSpriteX(1), y: getSpriteY(8), description: "9行目2列目" },
  { name: "sprite_row9_3", x: getSpriteX(2), y: getSpriteY(8), description: "9行目3列目" },
  { name: "sprite_row9_4", x: getSpriteX(3), y: getSpriteY(8), description: "9行目4列目" },
  { name: "sprite_row9_5", x: getSpriteX(4), y: getSpriteY(8), description: "9行目5列目" },
  { name: "sprite_row9_6", x: getSpriteX(5), y: getSpriteY(8), description: "9行目6列目" },
  { name: "sprite_row9_7", x: getSpriteX(6), y: getSpriteY(8), description: "9行目7列目" },

  // 行10
  { name: "sprite_row10_1", x: getSpriteX(0), y: getSpriteY(9), description: "10行目1列目" },
  { name: "sprite_row10_2", x: getSpriteX(1), y: getSpriteY(9), description: "10行目2列目" },
  { name: "sprite_row10_3", x: getSpriteX(2), y: getSpriteY(9), description: "10行目3列目" },
  { name: "sprite_row10_4", x: getSpriteX(3), y: getSpriteY(9), description: "10行目4列目" },
  { name: "sprite_row10_5", x: getSpriteX(4), y: getSpriteY(9), description: "10行目5列目" },
  { name: "sprite_row10_6", x: getSpriteX(5), y: getSpriteY(9), description: "10行目6列目" },
  { name: "sprite_row10_7", x: getSpriteX(6), y: getSpriteY(9), description: "10行目7列目" },

  // 行11
  { name: "sprite_row11_1", x: getSpriteX(0), y: getSpriteY(10), description: "11行目1列目" },
  { name: "sprite_row11_2", x: getSpriteX(1), y: getSpriteY(10), description: "11行目2列目" },
  { name: "sprite_row11_3", x: getSpriteX(2), y: getSpriteY(10), description: "11行目3列目" },
  { name: "sprite_row11_4", x: getSpriteX(3), y: getSpriteY(10), description: "11行目4列目" },
  { name: "sprite_row11_5", x: getSpriteX(4), y: getSpriteY(10), description: "11行目5列目" },
  { name: "sprite_row11_6", x: getSpriteX(5), y: getSpriteY(10), description: "11行目6列目" },
  { name: "sprite_row11_7", x: getSpriteX(6), y: getSpriteY(10), description: "11行目7列目" },
];

export const SpriteViewerTest: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [, setApp] = useState<PIXI.Application | null>(null);
  const [selectedSprite, setSelectedSprite] = useState<SpriteInfo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pixiApp: PIXI.Application | null = null;
    let isDestroyed = false;

    const initializePixi = async () => {
      try {
        // 既に破棄されている場合は処理しない
        if (isDestroyed) return;

        // PIXI Application の初期化
        pixiApp = new PIXI.Application();
        await pixiApp.init({
          width: 800,
          height: 800,
          backgroundColor: 0x2c2c2c,
          antialias: true
        });

        // 初期化後に破棄されていないかチェック
        if (isDestroyed || !pixiApp) {
          pixiApp?.destroy(true);
          return;
        }

        if (canvasRef.current && pixiApp.canvas) {
          canvasRef.current.appendChild(pixiApp.canvas as HTMLCanvasElement);
        }

        // スプライトシートを読み込み
        const spriteSheetUrl = await getImageAssetPath('spriteItems');
        const texture = await PIXI.Assets.load(spriteSheetUrl);
        
        // グリッド表示用の背景
        const background = new PIXI.Graphics()
          .rect(0, 0, 800, 800)
          .fill(0x1a1a1a);
        pixiApp.stage.addChild(background);

        // タイトルテキスト
        const titleText = new PIXI.Text({
          text: 'Sprite Viewer Test - スプライトをクリックして確認',
          style: new PIXI.TextStyle({
            fill: 'white',
            fontSize: 20,
            fontFamily: 'Arial',
            align: 'center'
          })
        });
        titleText.x = 400;
        titleText.y = 20;
        titleText.anchor.set(0.5, 0);
        pixiApp.stage.addChild(titleText);

        // スプライトを配置
        const gridStartX = 50;
        const gridStartY = 80;
        const spacing = 80;
        const spritesPerRow = 7;

        SPRITE_MAP.forEach((spriteInfo, index) => {
          // スプライトテクスチャを切り出し
          const rect = new PIXI.Rectangle(spriteInfo.x, spriteInfo.y, SPRITE_WIDTH, SPRITE_HEIGHT);
          const spriteTexture = new PIXI.Texture({ source: texture.source, frame: rect });
          
          // スプライト作成
          const sprite = new PIXI.Sprite(spriteTexture);
          
          // グリッド配置（表示用サイズ調整）
          const displaySize = 64; // 表示用サイズ
          const row = Math.floor(index / spritesPerRow);
          const col = index % spritesPerRow;
          sprite.x = gridStartX + col * spacing;
          sprite.y = gridStartY + row * spacing;
          
          // スプライトサイズを表示用に調整
          sprite.width = displaySize;
          sprite.height = displaySize;
          
          // インタラクティブに設定
          sprite.eventMode = 'static';
          sprite.cursor = 'pointer';
          
          // ボーダー描画
          const border = new PIXI.Graphics()
            .rect(-2, -2, displaySize + 4, displaySize + 4)
            .stroke({ width: 2, color: 0x666666 });
          border.x = sprite.x;
          border.y = sprite.y;
          pixiApp.stage.addChild(border);
          
          // クリックイベント
          sprite.on('pointerdown', () => {
            setSelectedSprite(spriteInfo);
          });
          
          // ホバーエフェクト
          sprite.on('pointerenter', () => {
            border.clear()
              .rect(-2, -2, displaySize + 4, displaySize + 4)
              .stroke({ width: 3, color: 0x00ff00 });
          });
          
          sprite.on('pointerleave', () => {
            border.clear()
              .rect(-2, -2, displaySize + 4, displaySize + 4)
              .stroke({ width: 2, color: 0x666666 });
          });
          
          pixiApp.stage.addChild(sprite);
        });

        // 再度破棄チェック
        if (isDestroyed) {
          pixiApp?.destroy(true);
          return;
        }

        setApp(pixiApp);
        setIsLoaded(true);

      } catch (err) {
        console.error('PIXI初期化エラー:', err);
        setError(err instanceof Error ? err.message : '未知のエラー');
        // エラー時もpixiAppを破棄
        if (pixiApp && !isDestroyed) {
          pixiApp.destroy(true);
          pixiApp = null;
        }
      }
    };

    initializePixi();

    return () => {
      isDestroyed = true;
      if (pixiApp && pixiApp.renderer) {
        try {
          pixiApp.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (error) {
          console.warn('PIXI destroy error (can be ignored):', error);
        }
        pixiApp = null;
      }
    };
  }, []);

  return (
    <div className="sprite-viewer-test p-4">
      <div className="mb-4 bg-gray-800">
        <h2 className="text-2xl font-bold mb-2">スプライト画像確認テスト</h2>
        <p className="text-gray-300">
          sprite_items.pngの全スプライトを確認できます。スプライトをクリックすると詳細情報が表示されます。
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>エラー:</strong> {error}
        </div>
      )}

      {!isLoaded && !error && (
        <div className="text-center py-8">
          <div className="text-lg">読み込み中...</div>
        </div>
      )}

      <div className="flex gap-4">
        <div 
          ref={canvasRef} 
          className="border border-gray-300 rounded"
          style={{ minHeight: '800px' }}
        />
        
        {selectedSprite && (
          <div className="w-80 bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-bold mb-3">選択されたスプライト</h3>
            <div className="space-y-2">
              <div><strong>名前:</strong> {selectedSprite.name}</div>
              <div><strong>説明:</strong> {selectedSprite.description}</div>
              <div><strong>位置:</strong> ({selectedSprite.x}, {selectedSprite.y})</div>
              <div><strong>サイズ:</strong> {SPRITE_WIDTH}x{SPRITE_HEIGHT}</div>
              
              <div className="mt-4 p-3 bg-white rounded border">
                <h4 className="font-bold mb-2">実装用コード:</h4>
                <pre className="text-sm bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
{`// テクスチャ作成
const texture = PIXI.Texture.from('sprite_items.png');
const rect = new PIXI.Rectangle(${selectedSprite.x}, ${selectedSprite.y}, ${SPRITE_WIDTH}, ${SPRITE_HEIGHT});
const spriteTexture = new PIXI.Texture({
  source: texture.source,
  frame: rect
});

// スプライト作成
const sprite = new PIXI.Sprite(spriteTexture);
sprite.anchor.set(0.5, 0.5);`}
                </pre>
              </div>

              {(selectedSprite.description.includes('⭐') || selectedSprite.description.includes('推奨')) && (
                <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded">
                  <div className="text-blue-800 font-semibold">推奨スプライト</div>
                  <div className="text-sm text-blue-600">
                    このスプライトはゲーム実装で推奨されています。
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-100 bg-gray-800">
        <p>
          <strong>操作方法:</strong> スプライトにマウスを重ねると緑色の枠が表示されます。
          クリックすると右側に詳細情報と実装用コードが表示されます。
        </p>
      </div>
    </div>
  );
};