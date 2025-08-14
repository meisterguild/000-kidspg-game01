import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NICKNAME_OPTIONS, CAMERA_CONFIG } from '@shared/utils/constants';
import { resizeToSquare } from '@shared/utils/dom-helpers';
import { playSound } from '../utils/assets';

interface CameraPageProps {
  onImageCapture: (imageData: string) => void;
  onNicknameSelect: (nickname: string) => void;
  selectedNickname: string;
  onConfirm: () => void;
  capturedImage: string;
  setResultDir: (dir: string) => void;
}

const CameraPage: React.FC<CameraPageProps> = ({
  onImageCapture,
  onNicknameSelect,
  selectedNickname,
  onConfirm,
  capturedImage,
  setResultDir,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPhotoTaken, setIsPhotoTaken] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 保存中フラグ

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('利用可能なビデオデバイス:', videoDevices.length);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('カメラアクセスエラー:', error);
      let errorMessage = 'カメラにアクセスできませんでした。';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'カメラの許可を確認してください。';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'カメラデバイスが見つかりません。';
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'カメラが他のアプリケーションで使用中です。Zoom、Teams、OBSなどを終了してください。';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage += 'カメラの設定に問題があります。';
        } else {
          errorMessage += `エラー詳細: ${error.name} - ${error.message}`;
        }
      } else {
        errorMessage += `予期せぬエラーが発生しました: ${String(error)}`;
      }
      
      alert(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 500);
    
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    playSound('buttonClick');

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas 2D context を取得できませんでした');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const squareCanvas = resizeToSquare(canvas, CAMERA_CONFIG.width);
    const imageData = squareCanvas.toDataURL(CAMERA_CONFIG.format);

    onImageCapture(imageData);
    setIsPhotoTaken(true);
    stopCamera();
  }, [onImageCapture, stopCamera]);

  const retakePhoto = useCallback(() => {
    setIsPhotoTaken(false);
    onImageCapture('');
    startCamera();
  }, [onImageCapture, startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!capturedImage || isSaving) return;

    playSound('buttonClick');
    setIsSaving(true);

    // ブラウザ環境 (vite dev) と Electron 環境の分岐処理
    if (window.electronAPI) {
      // Electron 環境: ファイル保存を実行
      try {
        console.log('写真の保存を開始します...');
        const result = await window.electronAPI.savePhoto(capturedImage);
        if (result.success && result.dirPath) {
          console.log('写真の保存に成功しました:', result.dirPath);
          setResultDir(result.dirPath);
          onConfirm(); // 保存が成功したら画面遷移
        } else {
          console.error('写真の保存に失敗しました:', result.error);
          alert(`写真の保存に失敗しました: ${result.error}`);
          setIsSaving(false);
        }
      } catch (error) {
        console.error('写真の保存中に予期せぬエラーが発生しました:', error);
        if (error instanceof Error) {
            alert(`写真の保存中にエラーが発生しました: ${error.message}`);
        } else {
            alert(`写真の保存中に予期せぬエラーが発生しました: ${String(error)}`);
        }
        setIsSaving(false);
      }
    } else {
      // ブラウザ環境: ファイル保存をスキップ
      console.log('ブラウザ環境のため、ファイル保存をスキップします。');
      setResultDir('browser-dummy-path'); // ダミーのパスを設定
      onConfirm();
    }
  }, [capturedImage, onConfirm, setResultDir, isSaving]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (!isPhotoTaken) {
          capturePhoto();
        } else if (capturedImage) {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPhotoTaken, capturedImage, onConfirm, capturePhoto, handleConfirm]);

  const getRandomNickname = useCallback(() => {
    const nonRandomOptions = NICKNAME_OPTIONS.filter(opt => opt.id !== 'random');
    const randomOption = nonRandomOptions[Math.floor(Math.random() * nonRandomOptions.length)];
    return randomOption.text;
  }, []);

  useEffect(() => {
    if (!selectedNickname || selectedNickname === 'ランダム') {
      const initialNickname = getRandomNickname();
      onNicknameSelect(initialNickname);
    }
  }, [selectedNickname, onNicknameSelect, getRandomNickname]);

  const handleNicknameClick = useCallback((nickname: string) => {
    playSound('buttonClick');
    const finalNickname = nickname === 'ランダム' ? getRandomNickname() : nickname;
    onNicknameSelect(finalNickname);
  }, [onNicknameSelect, getRandomNickname]);

  return (
    <div className="camera-layout">
      <div className="camera-nicknames">
        <h2 className="text-2xl font-bold mb-4">ニックネームを選択してください</h2>
        <div className="flex flex-wrap">
          {NICKNAME_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`nickname-button ${
                selectedNickname === option.text
                  ? 'nickname-button--selected' 
                  : 'nickname-button--unselected'
              } ${
                option.id === 'random' ? 'is-random' : ''
              }`}
              onClick={() => handleNicknameClick(option.text)}
            >
              {option.text}
            </button>
          ))}
        </div>
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <p className="text-lg">
            選択中: <span className="font-bold text-yellow-400">{selectedNickname}</span>
          </p>
        </div>
      </div>

      <div className="camera-preview">
        <h2 className="text-xl font-bold mb-4">記念撮影</h2>
        
        <div className="video-container mb-4" style={{ width: '320px', height: '320px' }}>
          {!isPhotoTaken ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={capturedImage} 
              alt="撮影した写真"
              className="w-full h-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="space-y-3">
          {!isPhotoTaken ? (
            <button 
              className="game-button w-full"
              onClick={capturePhoto}
            >
              撮影 (Space)
            </button>
          ) : (
            <>
              <button 
                className="game-button w-full bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={!capturedImage || isSaving}
              >
                {isSaving ? '保存中...' : '確定してスタート (Space)'}
              </button>
              <button 
                className="game-button w-full bg-gray-600 hover:bg-gray-700"
                onClick={retakePhoto}
                disabled={isSaving}
              >
                再撮影
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraPage;