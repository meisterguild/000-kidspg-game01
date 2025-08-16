import * as PIXI from 'pixi.js';
import { GAME_CONFIG, SPRITE_CONFIG, TIMING_CONFIG, PERFORMANCE_CONFIG, UI_CONFIG } from '@shared/utils/constants';
import { playSound } from '../utils/assets';
import spriteSheetUrl from '../assets/images/sprite_items.png';
import { AppConfig } from '@shared/types';

interface GameState {
  score: number;
  level: number;
  gameOver: boolean;
  currentLane: number;
}

interface Obstacle {
  sprite: PIXI.Sprite;
  lane: number;
}

// スプライトシート設定
const SPRITE_COLS = SPRITE_CONFIG.grid.cols;
const SPRITE_ROWS = SPRITE_CONFIG.grid.rows;
const PADDING_TOP = SPRITE_CONFIG.padding.top;
const PADDING_LEFT = SPRITE_CONFIG.padding.left;
const PADDING_RIGHT = SPRITE_CONFIG.padding.right;
const PADDING_BOTTOM = SPRITE_CONFIG.padding.bottom;
const USABLE_WIDTH = SPRITE_CONFIG.sheetSize.width - PADDING_LEFT - PADDING_RIGHT;
const USABLE_HEIGHT = SPRITE_CONFIG.sheetSize.height - PADDING_TOP - PADDING_BOTTOM;
const SPRITE_WIDTH = Math.floor(USABLE_WIDTH / SPRITE_COLS) - 2;
const SPRITE_HEIGHT = Math.floor(USABLE_HEIGHT / SPRITE_ROWS) - 0;

// スプライト座標計算
const getSpriteX = (col: number) => PADDING_LEFT + col * SPRITE_WIDTH;
const getSpriteY = (row: number) => PADDING_TOP + row * SPRITE_HEIGHT;

// プレイヤー用スプライト座標
const PLAYER_SPRITE = { x: getSpriteX(SPRITE_CONFIG.sprites.player.col), y: getSpriteY(SPRITE_CONFIG.sprites.player.row) };
// 敵用スプライト座標
const ENEMY_SPRITE = { x: getSpriteX(SPRITE_CONFIG.sprites.enemy.col), y: getSpriteY(SPRITE_CONFIG.sprites.enemy.row) };

const LINE_COLOR = UI_CONFIG.lineColor; // 薄いグレー
const LINE_THICKNESS = UI_CONFIG.lineThickness;

export class PixiGameEngine {
  private app: PIXI.Application;
  private gameState: GameState;
  private character: PIXI.Sprite;
  private spriteTexture: PIXI.Texture | null = null;
  private obstacles: Obstacle[] = [];
  private gameOverCallback?: (score: number) => void;
  private obstacleCreationTimer?: number;
  private obstacleSpeed: number;
  private obstacleCreationInterval: number;
  private currentSpawnDistance: number;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private isDestroyed: boolean = false;
  private frameCount: number = 0;
  private lastGarbageCollection: number = Date.now();
  private config: AppConfig;
  private lanes: number[];
  private trailGraphics: PIXI.Graphics[] = [];
  private trailCreationTimer?: number;
  // レスポンシブ対応用フラグ
  private responsiveEnabled: boolean = true;
  // リサイズイベント監視用
  private resizeDebounceTimer?: number;
  private lastResizeTime: number = 0;
  // レーン位置管理用
  private guidelineGraphics: PIXI.Graphics[] = [];
  private uiBackgroundGraphics?: PIXI.Graphics;

  constructor(config: AppConfig) {
    this.config = config;
    this.gameState = {
      score: 0,
      level: 1,
      gameOver: false,
      currentLane: Math.floor(config.game.lane.count / 2) // 中央レーン
    };
    
    this.obstacleSpeed = config.game.obstacle.speed.min;
    this.currentSpawnDistance = config.game.obstacle.spawnDistance.max;
    this.obstacleCreationInterval = this.calculateSpawnInterval();

    // レーン位置の初期計算（setupGame内で再計算される）
    this.lanes = [];
    
    // PixiJS v8では初期化時にパラメータを渡さない
    this.app = new PIXI.Application();
  }

  async initialize(container: HTMLElement): Promise<void> {
    try {
      // コンテナのサイズを取得
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // PixiJS v8の推奨初期化方法（レスポンシブサイズ）
      await this.app.init({
        width: containerWidth,
        height: containerHeight,
        backgroundColor: 0x000000,
        antialias: true,
        resizeTo: container // 自動リサイズ
      });
      
      // Canvas要素の存在確認
      if (!this.app.canvas) {
        throw new Error('Canvas要素が作成されませんでした');
      }
      
      container.appendChild(this.app.canvas);
      
      // スプライトシートを読み込み（プリロード済みの場合は即座に取得）
      try {
        // まずキャッシュから取得を試行
        this.spriteTexture = PIXI.Assets.get(spriteSheetUrl);
        
        if (!this.spriteTexture) {
          // キャッシュにない場合は改めて読み込み
          this.spriteTexture = await PIXI.Assets.load(spriteSheetUrl);
        } else {
          // スプライトテクスチャは既にキャッシュされている
        }
      } catch (loadError) {
        console.warn('スプライトシート読み込みでエラーが発生しました:', loadError);
        // フォールバック: 直接読み込みを試行
        this.spriteTexture = await PIXI.Assets.load(spriteSheetUrl);
      }
      
      // DOM更新を待つ
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      this.setupGame();
      
      // Phase 1: 初期化時にテスト用ログ出力
      // Phase 6: 初期化時のみログ出力（パフォーマンス最適化）
      this.logResponsiveCalculations();
      
      // Phase 3: リサイズハンドラーのセットアップ
      this.setupResizeHandler();
      
    } catch (error) {
      console.error('PixiJS初期化エラー:', error);
      throw error;
    }
  }

  private setupGame(): void {
    try {
      // 実際のキャンバスサイズを取得
      const canvasWidth = this.app.screen.width;
      
      // レーン位置を動的に計算（レスポンシブ対応）
      const responsiveLaneWidth = Math.min(GAME_CONFIG.laneWidth, canvasWidth / (this.config.game.lane.count + 1));
      this.lanes = Array.from({ length: this.config.game.lane.count }, (_, i) => {
        const totalWidth = (this.config.game.lane.count - 1) * responsiveLaneWidth;
        const startX = (canvasWidth - totalWidth) / 2;
        return startX + i * responsiveLaneWidth;
      });

      // Phase 4: 初期ガイドライン描画（再描画システムで管理）
      this.redrawGuidelines();

      // Phase 4: 初期UI背景描画（再描画システムで管理）
      this.redrawUIBackground();

      // スコア・レベル表示は HTML側に移管（PixiJS側は削除）

      // プレイヤーキャラクター（スプライト使用）
      if (this.spriteTexture) {
        const playerRect = new PIXI.Rectangle(PLAYER_SPRITE.x, PLAYER_SPRITE.y, SPRITE_WIDTH, SPRITE_HEIGHT);
        const playerTexture = new PIXI.Texture({ source: this.spriteTexture.source, frame: playerRect });
        this.character = new PIXI.Sprite(playerTexture);
        this.character.anchor.set(0.5, 0.5);
        
        // レスポンシブサイズ調整
        const { characterSize } = this.calculateResponsiveSizes();
        this.character.width = characterSize;
        this.character.height = characterSize;
      } else {
        // フォールバック: 元の緑四角（レスポンシブサイズ）
        const { characterSize } = this.calculateResponsiveSizes();
        const halfSize = characterSize / 2;
        const graphics = new PIXI.Graphics()
          .rect(-halfSize, -halfSize, characterSize, characterSize)
          .fill(0x00FF00);
        this.character = new PIXI.Sprite();
        this.character.addChild(graphics);
      }
      
      this.character.x = this.lanes[this.gameState.currentLane];
      this.character.y = this.calculateCharacterY();
      this.app.stage.addChild(this.character);

      // ゲームループ開始
      this.app.ticker.add(this.gameLoop.bind(this));
      this.startObstacleCreation();
      this.startTrailCreation(); // New: Start trail creation

      // キーボード入力設定
      this.setupKeyboardControls();
      
    } catch (error) {
      console.error('setupGame内エラー:', error);
      throw error;
    }
  }

  private gameLoop(): void {
    if (this.gameState.gameOver || this.isDestroyed) return;

    this.frameCount++;

    // 5分ごとにメモリ管理を実行（60FPS想定でTIMING_CONFIG.gameMemoryCheckIntervalフレーム）
    if (this.frameCount % TIMING_CONFIG.gameMemoryCheckInterval === 0) {
      this.performMemoryMaintenance();
    }

    // 障害物の更新
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.sprite.y += this.obstacleSpeed;

      // 衝突判定
      if (this.checkCollision(obstacle)) {
        playSound('ng');
        this.endGame();
        return;
      }

      // 画面下端を超えた障害物を削除してスコア加算
      if (obstacle.sprite.y > this.app.screen.height + UI_CONFIG.obstacleOffscreenOffset) {
        this.app.stage.removeChild(obstacle.sprite);
        // 障害物を適切に破棄してメモリリークを防ぐ
        obstacle.sprite.destroy({ children: true });
        this.obstacles.splice(i, 1);
        
        playSound('action', 0.3);
        this.addScore(10);
      }
    }

    // トレイルの更新
    for (let i = this.trailGraphics.length - 1; i >= 0; i--) {
      const trail = this.trailGraphics[i];
      trail.alpha -= PERFORMANCE_CONFIG.trailAlphaDecrement; // 徐々に透明にする
      trail.scale.x *= PERFORMANCE_CONFIG.trailScaleDecrement; // 徐々に小さくする
      trail.scale.y *= PERFORMANCE_CONFIG.trailScaleDecrement;
      trail.y += this.obstacleSpeed; // 下に移動

      if (trail.alpha <= PERFORMANCE_CONFIG.trailAlphaDecrement / 2 || trail.y > this.app.screen.height + UI_CONFIG.obstacleOffscreenOffset) {
        this.app.stage.removeChild(trail);
        trail.destroy();
        this.trailGraphics.splice(i, 1);
      }
    }
  }

  private createObstacle(): void {
    if (this.gameState.gameOver || this.isDestroyed) return;

    let obstacle: PIXI.Sprite;
    
    // 敵キャラクター（スプライト使用）
    if (this.spriteTexture) {
      const enemyRect = new PIXI.Rectangle(ENEMY_SPRITE.x, ENEMY_SPRITE.y, SPRITE_WIDTH, SPRITE_HEIGHT);
      const enemyTexture = new PIXI.Texture({ source: this.spriteTexture.source, frame: enemyRect });
      obstacle = new PIXI.Sprite(enemyTexture);
      obstacle.anchor.set(0.5, 0.5);
      
      // レスポンシブサイズ調整
      const { obstacleSize } = this.calculateResponsiveSizes();
      obstacle.width = obstacleSize;
      obstacle.height = obstacleSize;
    } else {
      // フォールバック: 元の赤四角（レスポンシブサイズ）
      const { obstacleSize } = this.calculateResponsiveSizes();
      const halfSize = obstacleSize / 2;
      const graphics = new PIXI.Graphics()
        .rect(-halfSize, -halfSize, obstacleSize, obstacleSize)
        .fill(0xFF0000);
      obstacle = new PIXI.Sprite();
      obstacle.addChild(graphics);
    }
    
    const laneIndex = Math.floor(Math.random() * this.config.game.lane.count); // 0, 1, ..., lane.count - 1
    obstacle.x = this.lanes[laneIndex];
    obstacle.y = -UI_CONFIG.obstacleOffscreenOffset;

    this.app.stage.addChild(obstacle);
    this.obstacles.push({ sprite: obstacle, lane: laneIndex });
  }

  private checkCollision(obstacle: Obstacle): boolean {
    if (obstacle.lane !== this.gameState.currentLane) {
      return false;
    }

    const charBounds = this.character.getBounds();
    const obsBounds = obstacle.sprite.getBounds();

    return (
      charBounds.x < obsBounds.x + obsBounds.width &&
      charBounds.x + charBounds.width > obsBounds.x &&
      charBounds.y < obsBounds.y + obsBounds.height &&
      charBounds.y + charBounds.height > obsBounds.y
    );
  }

  private addScore(points: number): void {
    this.gameState.score += points;
    
    // レベルアップ判定
    if (this.gameState.score > 0 && this.gameState.score % this.config.game.levelUpScoreInterval === 0) {
      this.levelUp();
    }
  }

  private calculateSpawnInterval(): number {
    // 距離ベースの出現間隔計算
    // 間隔(ms) = 距離(px) / 速度(px/frame) / FPS(frame/s) * 1000(ms/s)
    const distance = this.currentSpawnDistance;
    const speed = this.obstacleSpeed;
    const fps = this.config.game.targetFPS;
    return Math.round(distance / speed / fps * 1000);
  }

  private levelUp(): void {
    this.gameState.level++;
    
    // レベルアップ音を再生
    playSound('bell');
    
    // 難易度上昇（速度増加 + 距離減少）
    this.obstacleSpeed = Math.min(
      this.config.game.obstacle.speed.max,
      this.obstacleSpeed + this.config.game.obstacle.speed.incrementPerLevel
    );
    
    this.currentSpawnDistance = Math.max(
      this.config.game.obstacle.spawnDistance.min,
      this.currentSpawnDistance - this.config.game.obstacle.spawnDistance.decrementPerLevel
    );
    
    // 新しい間隔を計算
    this.obstacleCreationInterval = this.calculateSpawnInterval();
    
    // 障害物生成間隔を更新
    this.restartObstacleCreation();
  }

  private setupKeyboardControls(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (this.gameState.gameOver || this.isDestroyed) return;

      switch (event.key) {
        case 'ArrowLeft':
          if (this.gameState.currentLane > 0) {  // 配列の最初のインデックス（左レーン）
            this.gameState.currentLane--;
            this.updateCharacterPosition();
            playSound('jump', 0.5);
          }
          break;
        case 'ArrowRight':
          if (this.gameState.currentLane < this.config.game.lane.count - 1) {  // 配列の最後のインデックス（右レーン）
            this.gameState.currentLane++;
            this.updateCharacterPosition();
            playSound('jump', 0.5);
          }
          break;
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
  }

  private updateCharacterPosition(): void {
    if (this.lanes.length > this.gameState.currentLane) {
      this.character.x = this.lanes[this.gameState.currentLane];
    }
  }

  private createTrailSegment(x: number, y: number): void {
    const trail = new PIXI.Graphics();
    const { trailSize } = this.calculateResponsiveSizes(); // Phase 6: 最適化されたサイズ取得
    trail.circle(0, 0, trailSize).fill(0xFFFF00); // 黄色の円
    trail.alpha = 1.0; // 透過なし
    trail.x = x;
    trail.y = y + this.character.height / 2; // キャラクターの下に表示
    this.app.stage.addChild(trail);
    this.trailGraphics.push(trail);
  }

  private startObstacleCreation(): void {
    this.obstacleCreationTimer = setInterval(() => {
      this.createObstacle();
    }, this.obstacleCreationInterval);
  }

  private restartObstacleCreation(): void {
    if (this.obstacleCreationTimer) {
      clearInterval(this.obstacleCreationTimer);
    }
    this.startObstacleCreation();
  }

  private startTrailCreation(): void {
    this.trailCreationTimer = setInterval(() => {
      if (!this.gameState.gameOver && !this.isDestroyed) {
        this.createTrailSegment(this.character.x, this.character.y);
      }
    }, TIMING_CONFIG.trailCreationInterval); // 0.3秒ごとに生成
  }

  private endGame(): void {
    this.gameState.gameOver = true;
    this.app.ticker.stop();
    
    if (this.obstacleCreationTimer) {
      clearInterval(this.obstacleCreationTimer);
    }

    // ゲームオーバー表示（レスポンシブフォントサイズ）
    const responsiveFontSize = Math.max(32, Math.min(64, this.app.screen.width / 12));
    const gameOverText = new PIXI.Text({
      text: 'GAME OVER',
      style: new PIXI.TextStyle({ 
        fill: 'red', 
        fontSize: responsiveFontSize, 
        fontWeight: 'bold',
        fontFamily: 'Arial'
      })
    });
    gameOverText.anchor.set(0.5);
    gameOverText.x = this.app.screen.width / 2;
    gameOverText.y = this.app.screen.height / 2 - UI_CONFIG.gameOverOffset;
    this.app.stage.addChild(gameOverText);

    // コールバック実行
    if (this.gameOverCallback) {
      this.gameOverCallback(this.gameState.score);
    }
  }

  public setGameOverCallback(callback: (score: number) => void): void {
    this.gameOverCallback = callback;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // ゲーム状態を停止
    this.gameState.gameOver = true;
    
    // キーボードイベントリスナーを削除
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    
    // Phase 3: リサイズイベントリスナーを削除
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = undefined;
    }
    
    try {
      this.app.renderer.off('resize', this.handleResize.bind(this));
    } catch {
      // エラーは無視（既に削除済みの場合）
    }
    
    // タイマーを停止
    if (this.obstacleCreationTimer) {
      clearInterval(this.obstacleCreationTimer);
      this.obstacleCreationTimer = undefined;
    }
    if (this.trailCreationTimer) {
      clearInterval(this.trailCreationTimer);
      this.trailCreationTimer = undefined;
    }
    
    // PixiJS Tickerを停止
    if (this.app.ticker) {
      this.app.ticker.stop();
    }
    
    // 全ての障害物を破棄
    this.obstacles.forEach(obstacle => {
      if (obstacle.sprite && !obstacle.sprite.destroyed) {
        obstacle.sprite.destroy({ children: true });
      }
    });
    this.obstacles = [];

    // 全てのトレイルを破棄
    this.trailGraphics.forEach(trail => {
      if (trail && !trail.destroyed) {
        trail.destroy();
      }
    });
    this.trailGraphics = [];
    
    // Phase 4: ガイドラインとUI背景を破棄
    this.guidelineGraphics.forEach(guideline => {
      if (guideline && !guideline.destroyed) {
        guideline.destroy();
      }
    });
    this.guidelineGraphics = [];
    
    if (this.uiBackgroundGraphics && !this.uiBackgroundGraphics.destroyed) {
      this.uiBackgroundGraphics.destroy();
    }
    
    // スコア・レベルテキストは削除済み（HTML側に移管）
    
    // キャラクターを破棄
    if (this.character && !this.character.destroyed) {
      this.character.destroy({ children: true });
    }
    
    // PixiJSアプリケーションを完全に破棄
    if (this.app && !this.app.destroyed) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
    }
    
    // コールバック参照を削除
    this.gameOverCallback = undefined;
    
  }

  private performMemoryMaintenance(): void {
    const now = Date.now();
    
    // 30分ごとにフレームカウンターをリセット（オーバーフロー対策）
    if (now - this.lastGarbageCollection > PERFORMANCE_CONFIG.memoryMaintenanceInterval) {
      this.frameCount = 0;
      this.lastGarbageCollection = now;
    }
    
    // PixiJSのテクスチャキャッシュをクリーンアップ
    try {
      // PixiJS v8では直接アクセス可能
      if (typeof PIXI !== 'undefined' && PIXI.Assets) {
        // アセットキャッシュをクリーンアップ
        PIXI.Assets.cache.reset();
      }
    } catch (error) {
      console.warn('テクスチャキャッシュクリーンアップに失敗:', error);
    }

    // Phase 6: 障害物数の最適化（メモリ保護強化）
    if (this.obstacles.length > PERFORMANCE_CONFIG.maxObstacles) {
      const excessObstacles = this.obstacles.splice(PERFORMANCE_CONFIG.obstacleCleanupThreshold); // 最新40個を残して削除
      excessObstacles.forEach(obstacle => {
        if (obstacle.sprite.parent) {
          this.app.stage.removeChild(obstacle.sprite);
        }
        obstacle.sprite.destroy({ children: true });
      });
    }
  }

  public getScore(): number {
    return this.gameState.score;
  }

  public getLevel(): number {
    return this.gameState.level;
  }

  // Phase 1: 基盤メソッド（計算のみ、適用しない）
  private calculateResponsiveSizes(): {
    characterSize: number;
    obstacleSize: number;
    trailSize: number;
    uiFontSize: number;
    uiPadding: number;
    uiBackgroundHeight: number;
  } {
    const canvasWidth = this.app.screen.width;
    const canvasHeight = this.app.screen.height;
    
    // キャラクターと障害物のサイズを統一
    const gameObjectSize = Math.max(30, Math.min(60, canvasWidth / 15));
    
    return {
      characterSize: gameObjectSize,
      obstacleSize: gameObjectSize, // 同じサイズに統一
      trailSize: Math.max(5, Math.min(15, canvasWidth / 80)),
      uiFontSize: Math.max(14, Math.min(24, canvasWidth / 35)),
      uiPadding: Math.max(10, canvasWidth * 0.02),
      uiBackgroundHeight: Math.max(60, canvasHeight * 0.12)
    };
  }

  private updateLayoutCalculations(): {
    lanes: number[];
    responsiveLaneWidth: number;
    guidelineWidth: number;
  } {
    const canvasWidth = this.app.screen.width;
    const responsiveLaneWidth = Math.min(GAME_CONFIG.laneWidth, canvasWidth / (this.config.game.lane.count + 1));
    
    const lanes = Array.from({ length: this.config.game.lane.count }, (_, i) => {
      const totalWidth = (this.config.game.lane.count - 1) * responsiveLaneWidth;
      const startX = (canvasWidth - totalWidth) / 2;
      return startX + i * responsiveLaneWidth;
    });
    
    return {
      lanes,
      responsiveLaneWidth,
      guidelineWidth: responsiveLaneWidth
    };
  }

  // Phase 6: テスト用ログ出力メソッド（最適化版）
  private logResponsiveCalculations(): void {
    if (!this.responsiveEnabled) return;
    
    try {
      const sizes = this.calculateResponsiveSizes();
      const layout = this.updateLayoutCalculations();
      
      // Phase 6: 統合テスト用の簡素化ログ
      console.log('🎯 Responsive System Active:', {
        canvas: `${this.app.screen.width}x${this.app.screen.height}`,
        gameObjectSize: sizes.characterSize,
        lanes: layout.lanes.length,
        obstacles: this.obstacles.length
      });
    } catch (error) {
      console.warn('レスポンシブ計算エラー:', error);
    }
  }

  // UIテキスト更新メソッドは削除（HTML側に移管）

  // Phase 3: リサイズイベント監視システム
  private setupResizeHandler(): void {
    if (!this.responsiveEnabled) return;
    
    // PixiJS v8のリサイズイベントを監視
    this.app.renderer.on('resize', this.handleResize.bind(this));
    // Phase 6: パフォーマンス最適化のためログ削除
  }

  private handleResize(): void {
    if (!this.responsiveEnabled) return;
    
    const now = Date.now();
    this.lastResizeTime = now;
    
    // Phase 6: 最適化されたデバウンス処理（TIMING_CONFIG.resizeDebounceDelay ms）
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }
    
    this.resizeDebounceTimer = setTimeout(() => {
      // 最新のリサイズから指定時間経過後に実行（パフォーマンス最適化）
      if (Date.now() - this.lastResizeTime >= TIMING_CONFIG.resizeDebounceDelay) {
        this.onResizeComplete();
      }
    }, TIMING_CONFIG.resizeDebounceDelay);
  }

  private onResizeComplete(): void {
    if (!this.responsiveEnabled || this.gameState.gameOver || this.isDestroyed) return;
    
    try {
      // Phase 6: パフォーマンス最適化のためログ削除
      // const newSize = { width: this.app.screen.width, height: this.app.screen.height };
      // console.log('📐 Resize detected:', newSize);
      
      // Phase 4: レーンレイアウト更新を実行
      this.updateLaneLayout();
      
    } catch (error) {
      console.warn('リサイズ処理エラー:', error);
    }
  }

  // Phase 4: レーン位置とガイドラインの動的更新
  private updateLaneLayout(): void {
    if (!this.responsiveEnabled) return;
    
    try {
      const layout = this.updateLayoutCalculations();
      
      // レーン位置を更新
      this.lanes = layout.lanes;
      
      // キャラクター位置を更新
      this.updateCharacterPosition();
      
      // 既存障害物の位置とサイズを更新
      this.updateExistingObstacles();
      
      // キャラクターサイズを更新
      this.updateCharacterSize();
      
      // ガイドラインを再描画
      this.redrawGuidelines();
      
      // UI背景を再描画
      this.redrawUIBackground();
      
    } catch (error) {
      console.warn('レーンレイアウト更新エラー:', error);
    }
  }

  private redrawGuidelines(): void {
    // 既存のガイドラインを削除
    this.guidelineGraphics.forEach(guideline => {
      if (guideline.parent) {
        this.app.stage.removeChild(guideline);
      }
      guideline.destroy();
    });
    this.guidelineGraphics = [];
    
    // 新しいガイドラインを描画
    const canvasWidth = this.app.screen.width;
    const canvasHeight = this.app.screen.height;
    const layout = this.updateLayoutCalculations();
    
    for (let i = 0; i <= this.config.game.lane.count; i++) {
      const totalWidth = (this.config.game.lane.count - 1) * layout.responsiveLaneWidth;
      const startX = (canvasWidth - totalWidth) / 2;
      const lineX = startX + i * layout.responsiveLaneWidth - layout.responsiveLaneWidth / 2;
      
      const alpha = (i === 0 || i === this.config.game.lane.count) ? 0.2 : 0.4;
      
      const guideline = new PIXI.Graphics();
      guideline.moveTo(lineX, 0);
      guideline.lineTo(lineX, canvasHeight);
      guideline.stroke({ width: LINE_THICKNESS, color: LINE_COLOR, alpha });
      
      this.app.stage.addChild(guideline);
      this.guidelineGraphics.push(guideline);
    }
  }

  private redrawUIBackground(): void {
    // UI背景は削除（HTML側にスコア・レベル表示を移管したため不要）
    if (this.uiBackgroundGraphics && this.uiBackgroundGraphics.parent) {
      this.app.stage.removeChild(this.uiBackgroundGraphics);
      this.uiBackgroundGraphics.destroy();
      this.uiBackgroundGraphics = undefined;
    }
  }

  // 既存障害物の位置とサイズを更新
  private updateExistingObstacles(): void {
    if (!this.responsiveEnabled || !this.obstacles.length) return;
    
    try {
      const { obstacleSize } = this.calculateResponsiveSizes();
      
      this.obstacles.forEach(obstacle => {
        // レーン位置を更新
        if (obstacle.lane >= 0 && obstacle.lane < this.lanes.length) {
          obstacle.sprite.x = this.lanes[obstacle.lane];
        }
        
        // サイズを更新
        obstacle.sprite.width = obstacleSize;
        obstacle.sprite.height = obstacleSize;
      });
      
    } catch (error) {
      console.warn('障害物更新エラー:', error);
    }
  }

  // キャラクターサイズを更新
  private updateCharacterSize(): void {
    if (!this.responsiveEnabled || !this.character) return;
    
    try {
      const { characterSize } = this.calculateResponsiveSizes();
      this.character.width = characterSize;
      this.character.height = characterSize;
    } catch (error) {
      console.warn('キャラクターサイズ更新エラー:', error);
    }
  }

  // キャラクターY位置を動的に計算（プレイエリア下端から指定%の位置）
  private calculateCharacterY(): number {
    const canvasHeight = this.app.screen.height;
    return canvasHeight * UI_CONFIG.characterYPosition; // 下端から指定%の位置
  }
}