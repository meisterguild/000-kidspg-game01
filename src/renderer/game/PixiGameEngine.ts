import * as PIXI from 'pixi.js';
import { GAME_CONFIG, GAME_CANVAS } from '@shared/utils/constants';
import { playSound } from '@shared/utils/assets';
import spriteSheetUrl from '../assets/images/sprite_items.png';

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
const SPRITE_COLS = 7;
const SPRITE_ROWS = 11;
const PADDING_TOP = 13;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 10;
const PADDING_BOTTOM = 10;
const USABLE_WIDTH = 1024 - PADDING_LEFT - PADDING_RIGHT;
const USABLE_HEIGHT = 1536 - PADDING_TOP - PADDING_BOTTOM;
const SPRITE_WIDTH = Math.floor(USABLE_WIDTH / SPRITE_COLS) - 2;
const SPRITE_HEIGHT = Math.floor(USABLE_HEIGHT / SPRITE_ROWS) - 0;

// スプライト座標計算
const getSpriteX = (col: number) => PADDING_LEFT + col * SPRITE_WIDTH;
const getSpriteY = (row: number) => PADDING_TOP + row * SPRITE_HEIGHT;

// プレイヤー用スプライト座標
const PLAYER_SPRITE = { x: getSpriteX(1), y: getSpriteY(4) };
// 敵用スプライト座標
const ENEMY_SPRITE = { x: getSpriteX(0), y: getSpriteY(3) };

export class PixiGameEngine {
  private app: PIXI.Application;
  private gameState: GameState;
  private character: PIXI.Sprite;
  private spriteTexture: PIXI.Texture | null = null;
  private obstacles: Obstacle[] = [];
  private scoreText: PIXI.Text;
  private levelText: PIXI.Text;
  private gameOverCallback?: (score: number) => void;
  private obstacleCreationTimer?: number;
  private obstacleSpeed: number;
  private obstacleCreationInterval: number;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private isDestroyed: boolean = false;
  private frameCount: number = 0;
  private lastGarbageCollection: number = Date.now();

  constructor() {
    this.gameState = {
      score: 0,
      level: 1,
      gameOver: false,
      currentLane: 1  // 中央レーン（lanes[1] = 0）
    };
    
    this.obstacleSpeed = GAME_CONFIG.obstacleSpeed;
    this.obstacleCreationInterval = GAME_CONFIG.obstacleCreationInterval;
    
    // PixiJS v8では初期化時にパラメータを渡さない
    this.app = new PIXI.Application();
  }

  async initialize(container: HTMLElement): Promise<void> {
    try {
      // PixiJS v8の推奨初期化方法
      await this.app.init({
        width: GAME_CANVAS.width,
        height: GAME_CANVAS.height,
        backgroundColor: 0x000000,
        antialias: true
      });
      
      // Canvas要素の存在確認
      if (!this.app.canvas) {
        throw new Error('Canvas要素が作成されませんでした');
      }
      
      container.appendChild(this.app.canvas);
      
      // スプライトシートを読み込み
      this.spriteTexture = await PIXI.Assets.load(spriteSheetUrl);
      
      // DOM更新を待つ
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      this.setupGame();
      
    } catch (error) {
      console.error('PixiJS初期化エラー:', error);
      throw error;
    }
  }

  private setupGame(): void {
    try {
      // スコア表示
      this.scoreText = new PIXI.Text({
        text: `スコア: ${this.gameState.score}`,
        style: new PIXI.TextStyle({
          fill: 'white', 
          fontSize: 24, 
          fontFamily: 'Arial'
        })
      });
      this.scoreText.position.set(20, 20);
      this.app.stage.addChild(this.scoreText);

      // レベル表示
      this.levelText = new PIXI.Text({
        text: `レベル: ${this.gameState.level}`,
        style: new PIXI.TextStyle({
          fill: 'white', 
          fontSize: 24, 
          fontFamily: 'Arial'
        })
      });
      this.levelText.position.set(20, 50);
      this.app.stage.addChild(this.levelText);

      // プレイヤーキャラクター（スプライト使用）
      if (this.spriteTexture) {
        const playerRect = new PIXI.Rectangle(PLAYER_SPRITE.x, PLAYER_SPRITE.y, SPRITE_WIDTH, SPRITE_HEIGHT);
        const playerTexture = new PIXI.Texture({ source: this.spriteTexture.source, frame: playerRect });
        this.character = new PIXI.Sprite(playerTexture);
        this.character.anchor.set(0.5, 0.5);
        
        // サイズ調整（50x50に統一）
        this.character.width = 50;
        this.character.height = 50;
      } else {
        // フォールバック: 元の緑四角
        const graphics = new PIXI.Graphics()
          .rect(-25, -25, 50, 50)
          .fill(0x00FF00);
        this.character = new PIXI.Sprite();
        this.character.addChild(graphics);
      }
      
      this.character.x = GAME_CANVAS.width / 2 + GAME_CONFIG.lanes[this.gameState.currentLane] * GAME_CONFIG.laneWidth;
      this.character.y = GAME_CANVAS.height - 100;
      this.app.stage.addChild(this.character);

      // ゲームループ開始
      this.app.ticker.add(this.gameLoop.bind(this));
      this.startObstacleCreation();

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

    // 5分ごとにメモリ管理を実行（60FPS想定で18000フレーム）
    if (this.frameCount % 18000 === 0) {
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
      if (obstacle.sprite.y > GAME_CANVAS.height + 50) {
        this.app.stage.removeChild(obstacle.sprite);
        // 障害物を適切に破棄してメモリリークを防ぐ
        obstacle.sprite.destroy({ children: true });
        this.obstacles.splice(i, 1);
        
        playSound('action', 0.3);
        this.addScore(10);
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
      
      // サイズ調整（50x50に統一）
      obstacle.width = 50;
      obstacle.height = 50;
    } else {
      // フォールバック: 元の赤四角
      const graphics = new PIXI.Graphics()
        .rect(-25, -25, 50, 50)
        .fill(0xFF0000);
      obstacle = new PIXI.Sprite();
      obstacle.addChild(graphics);
    }
    
    const laneIndex = Math.floor(Math.random() * 3); // 0, 1, 2
    const lane = GAME_CONFIG.lanes[laneIndex];
    obstacle.x = GAME_CANVAS.width / 2 + lane * GAME_CONFIG.laneWidth;
    obstacle.y = -50;

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
    this.scoreText.text = `スコア: ${this.gameState.score}`;

    // レベルアップ判定
    if (this.gameState.score > 0 && this.gameState.score % GAME_CONFIG.levelUpScoreInterval === 0) {
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.gameState.level++;
    this.levelText.text = `レベル: ${this.gameState.level}`;
    
    // レベルアップ音を再生
    playSound('bell');
    
    // 難易度上昇
    this.obstacleSpeed += 1.5;
    this.obstacleCreationInterval = Math.max(500, this.obstacleCreationInterval - 250);
    
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
          if (this.gameState.currentLane < 2) {  // 配列の最後のインデックス（右レーン）
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
    this.character.x = GAME_CANVAS.width / 2 + GAME_CONFIG.lanes[this.gameState.currentLane] * GAME_CONFIG.laneWidth;
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

  private endGame(): void {
    this.gameState.gameOver = true;
    this.app.ticker.stop();
    
    if (this.obstacleCreationTimer) {
      clearInterval(this.obstacleCreationTimer);
    }

    // ゲームオーバー表示
    const gameOverText = new PIXI.Text({
      text: 'GAME OVER',
      style: new PIXI.TextStyle({ 
        fill: 'red', 
        fontSize: 64, 
        fontWeight: 'bold',
        fontFamily: 'Arial'
      })
    });
    gameOverText.anchor.set(0.5);
    gameOverText.x = GAME_CANVAS.width / 2;
    gameOverText.y = GAME_CANVAS.height / 2 - 50;
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
    
    console.log('PixiGameEngine破棄開始');
    this.isDestroyed = true;
    
    // ゲーム状態を停止
    this.gameState.gameOver = true;
    
    // キーボードイベントリスナーを削除
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    
    // タイマーを停止
    if (this.obstacleCreationTimer) {
      clearInterval(this.obstacleCreationTimer);
      this.obstacleCreationTimer = undefined;
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
    
    // テキストオブジェクトを破棄
    if (this.scoreText && !this.scoreText.destroyed) {
      this.scoreText.destroy({ children: true });
    }
    if (this.levelText && !this.levelText.destroyed) {
      this.levelText.destroy({ children: true });
    }
    
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
    
    console.log('PixiGameEngine破棄完了');
  }

  private performMemoryMaintenance(): void {
    const now = Date.now();
    console.log(`メモリ保守実行 - フレーム: ${this.frameCount}, 障害物数: ${this.obstacles.length}`);
    
    // 30分ごとにフレームカウンターをリセット（オーバーフロー対策）
    if (now - this.lastGarbageCollection > 30 * 60 * 1000) {
      this.frameCount = 0;
      this.lastGarbageCollection = now;
      console.log('フレームカウンターリセット');
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

    // 障害物数が異常に多い場合の安全装置（メモリ保護）
    if (this.obstacles.length > 100) {
      console.warn(`障害物数が異常です (${this.obstacles.length})。古い障害物を強制削除します。`);
      const excessObstacles = this.obstacles.splice(50); // 最新50個を残して削除
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
}