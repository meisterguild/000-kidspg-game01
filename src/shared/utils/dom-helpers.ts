// DOM操作が必要なヘルパー関数（レンダラープロセス専用）

// Canvas要素から500x500の正方形画像を生成
export const resizeToSquare = (canvas: HTMLCanvasElement, size: number = 500): HTMLCanvasElement => {
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
  
  ctx.drawImage(canvas, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  
  return squareCanvas;
};