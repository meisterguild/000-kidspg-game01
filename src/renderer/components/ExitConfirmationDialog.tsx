import React, { useEffect, useCallback } from 'react';
import './ExitConfirmationDialog.css';

interface ComfyUIStatus {
  activeJobs: Array<{
    datetime: string;
    status: string;
    promptId: string;
    duration: number;
  }>;
  internalQueueLength: number;
  serverQueueRunning: number;
  serverQueuePending: number;
}

interface ExitConfirmationDialogProps {
  isOpen: boolean;
  step: 1 | 2;
  comfyUIStatus: ComfyUIStatus;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ExitConfirmationDialog: React.FC<ExitConfirmationDialogProps> = ({
  isOpen,
  step,
  comfyUIStatus,
  onConfirm,
  onCancel,
}) => {
  // すべてのキーボードイベントをインターセプト（モーダル化）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    // すべてのキーイベントを停止して背景のゲームに伝わらないようにする
    e.stopPropagation();
    e.preventDefault();
    
    // ESCキーのみ許可してキャンセル処理
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [isOpen, onCancel]);

  

  // 背景クリック時の処理
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // ダイアログ自体をクリックした場合は何もしない
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    if (isOpen) {
      // キーボードイベントを最上位でキャプチャ
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyDown, true);
      document.addEventListener('keypress', handleKeyDown, true);
      
      // ページのスクロールを無効化
      document.body.style.overflow = 'hidden';
      
      // ダイアログにフォーカス
      const dialog = document.querySelector('.exit-confirmation-dialog') as HTMLElement;
      if (dialog) {
        dialog.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyDown, true);
      document.removeEventListener('keypress', handleKeyDown, true);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const totalJobs = (comfyUIStatus?.serverQueueRunning || 0) + 
                   (comfyUIStatus?.serverQueuePending || 0) +
                   (comfyUIStatus?.internalQueueLength || 0);

  const processingJobs = comfyUIStatus?.serverQueueRunning || 0;
  const pendingJobs = (comfyUIStatus?.serverQueuePending || 0) + 
                     (comfyUIStatus?.internalQueueLength || 0);

  return (
    <div className="exit-confirmation-overlay" onClick={handleBackgroundClick}>
      <div 
        className="exit-confirmation-dialog"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <div className="dialog-header">
              <h2>よけまくり中アプリを終了しますか？</h2>
            </div>
            
            <div className="dialog-content">
              <div className="comfyui-status">
                <h3>未処理のComfyUIジョブ:</h3>
                <div className="status-item">
                  <span className="status-label">• 処理中:</span>
                  <span className="status-value">{processingJobs}件</span>
                </div>
                <div className="status-item">
                  <span className="status-label">• 待機中:</span>
                  <span className="status-value">{pendingJobs}件</span>
                </div>
                <div className="status-item total">
                  <span className="status-label">• 合計:</span>
                  <span className="status-value">{totalJobs}件</span>
                </div>
              </div>
              
              {totalJobs > 0 && (
                <div className="warning-message">
                  <span className="warning-icon">⚠️</span>
                  <span>終了すると処理が中断されます</span>
                </div>
              )}
            </div>
            
            <div className="dialog-footer">
              <button 
                className="cancel-button"
                onClick={onCancel}
                tabIndex={0}
              >
                いいえ
              </button>
              <button 
                className="confirm-button"
                onClick={onConfirm}
                tabIndex={-1}
              >
                はい
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dialog-header">
              <h2>よけまくり中アプリを本当に終了？</h2>
            </div>
            
            <div className="dialog-content">
              <p className="final-warning">この操作は取り消せません</p>
              
              <div className="warning-message">
                <span className="warning-icon">📷</span>
                <span>画像生成処理が中断される可能性があります</span>
              </div>
            </div>
            
            <div className="dialog-footer">
              <button 
                className="cancel-button"
                onClick={onCancel}
                tabIndex={0}
              >
                やっぱりやめます
              </button>
              <button 
                className="confirm-button danger"
                onClick={onConfirm}
                tabIndex={-1}
              >
                問題ない
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};