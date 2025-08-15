# スプライト画像確認テストツール

スプライト実装前に、`sprite_items.png`内のスプライトを確認できるテストツールを作成しました。

## 使用方法

### 1. アプリケーション起動
```bash
npm run dev
```

### 2. テスト画面へアクセス
アプリケーション起動後、**Tキー**を押すとスプライトビューアーテストに移動します。

### 3. スプライト確認
- 画面に全56個のスプライトがグリッド形式で表示されます
- スプライトにマウスを重ねると緑色の枠でハイライトされます
- スプライトをクリックすると右側パネルに詳細情報が表示されます

### 4. 表示される情報
- **名前**: スプライトの識別名
- **説明**: スプライトの内容説明
- **位置**: sprite_items.png内での座標(x, y)
- **サイズ**: 64x64ピクセル固定
- **実装用コード**: そのスプライトを使用するためのPixiJSコード

### 5. 推奨スプライトの確認
⭐マークの付いたスプライトはゲーム実装で推奨されています：
- **プレイヤーキャラクター**: 緑の笑顔キューブ (128, 0)
- **敵キャラクター**: 赤の笑顔キューブ (128, 64)

## ファイル構成

```
src/renderer/test/
├── SpriteViewerTest.tsx    # メインのスプライトビューアーコンポーネント
└── TestPage.tsx           # テストページのラッパー
```

## 機能

### インタラクティブなスプライト表示
- ホバーエフェクト（緑色の枠線）
- クリックで詳細情報表示
- 実装用コードの自動生成

### 詳細情報パネル
- スプライトの基本情報
- 実装で使用するPixiJSコード
- 推奨スプライトの識別

### キーボードショートカット
- **Tキー**: テスト画面に移動
- **Escキー**: トップ画面に戻る

## 実装詳細

### スプライトデータ構造
```typescript
interface SpriteInfo {
  name: string;        // 識別名
  x: number;          // X座標
  y: number;          // Y座標
  description: string; // 説明文
}
```

### PixiJSでのスプライト読み込み方法
```typescript
// テクスチャ読み込み
const texture = await PIXI.Assets.load('src/renderer/assets/images/sprite_items.png');

// 特定スプライトの切り出し
const rect = new PIXI.Rectangle(x, y, 64, 64);
const spriteTexture = new PIXI.Texture({
  source: texture.source,
  frame: rect
});

// スプライト作成
const sprite = new PIXI.Sprite(spriteTexture);
sprite.anchor.set(0.5, 0.5);
```

## 注意事項

- テストツールはPixiJS v8を使用しています
- すべてのスプライトは64x64ピクセルです
- テクスチャの読み込みに失敗した場合はエラーメッセージが表示されます
- 本番実装時は、このテストコードは不要です

## 次のステップ

1. テストツールでスプライトを確認
2. 使用するスプライトを決定
3. `docs/implementation_plan_sprite_replacement.md`の実装計画に従って実装
4. 実装後はテストコードを削除