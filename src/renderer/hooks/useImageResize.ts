import { useState, useCallback } from 'react';
import { CAMERA_CONFIG, PERFORMANCE_CONFIG } from '@shared/utils/constants';

interface UseImageResizeReturn {
  resizeToSquare: (canvas: HTMLCanvasElement, size?: number) => string;
  isProcessing: boolean;
  error: string | null;
}

/**
 * 画像リサイズ処理を管理するカスタムフック
 * Canvas要素から正方形画像を生成し、Data URLとして返します
 */
export const useImageResize = (): UseImageResizeReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resizeToSquare = useCallback((
    canvas: HTMLCanvasElement, 
    size: number = CAMERA_CONFIG.width
  ): string => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // 入力値の検証
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('有効なCanvas要素を指定してください');
      }
      
      if (size <= 0 || size > PERFORMANCE_CONFIG.imageMaxSize) {
        throw new Error(`サイズは1から${PERFORMANCE_CONFIG.imageMaxSize}の範囲で指定してください`);
      }

      // 新しいCanvas要素を作成
      const squareCanvas = document.createElement('canvas');
      const ctx = squareCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas 2D context を取得できませんでした');
      }
      
      squareCanvas.width = size;
      squareCanvas.height = size;
      
      // 元画像のアスペクト比を保持しながら正方形にフィット
      const sourceSize = Math.min(canvas.width, canvas.height);
      const sourceX = (canvas.width - sourceSize) / 2;
      const sourceY = (canvas.height - sourceSize) / 2;
      
      // 画像を描画
      ctx.drawImage(canvas, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
      
      // Data URLとして返す
      const dataUrl = squareCanvas.toDataURL('image/png');
      
      return dataUrl;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw new Error(`画像リサイズ処理でエラーが発生しました: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { 
    resizeToSquare, 
    isProcessing, 
    error 
  };
};