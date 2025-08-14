import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NICKNAME_OPTIONS, CAMERA_CONFIG } from '@shared/utils/constants';
import { resizeToSquare } from '@shared/utils/dom-helpers';
import { playSound } from '../utils/assets';
import { useScreen } from '../contexts/ScreenContext';
import { useGameSession } from '../contexts/GameSessionContext';
import { useSavePhoto } from '../hooks/useSavePhoto';

const CameraPage: React.FC = () => {
  const { setCurrentScreen } = useScreen();
  const {
    capturedImage,
    setCapturedImage,
    selectedNickname,
    setSelectedNickname,
    setResultDir,
  } = useGameSession();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPhotoTaken, setIsPhotoTaken] = useState(!!capturedImage);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { savePhoto, isSaving: isSavingHook, error: saveError } = useSavePhoto();

  const startCamera = useCallback(async () => {
    setIsCameraReady(false);
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
        videoRef.current.onloadeddata = () => {
          setIsCameraReady(true);
        };
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
    if (!isPhotoTaken) {
      const timer = setTimeout(() => {
        startCamera();
      }, 500);
      return () => clearTimeout(timer);
    }
    return () => stopCamera();
  }, [isPhotoTaken, startCamera, stopCamera]);

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

    setCapturedImage(imageData);
    setIsPhotoTaken(true);
    stopCamera();
  }, [setCapturedImage, stopCamera]);

  const retakePhoto = useCallback(() => {
    setIsPhotoTaken(false);
    setCapturedImage('');
    startCamera();
  }, [setCapturedImage, startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!capturedImage || isSavingHook) return;

    playSound('buttonClick');

    const result = await savePhoto(capturedImage);

    if (result.success && result.dirPath) {
      setResultDir(result.dirPath);
      setCurrentScreen('COUNTDOWN');
    } else {
      console.error('写真の保存に失敗しました:', saveError || result.error);
      alert(`写真の保存に失敗しました: ${saveError || result.error}`);
    }
  }, [capturedImage, setResultDir, setCurrentScreen, savePhoto, isSavingHook, saveError]);

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
  }, [isPhotoTaken, capturedImage, capturePhoto, handleConfirm]);

  const getRandomNickname = useCallback(() => {
    const nonRandomOptions = NICKNAME_OPTIONS.filter(opt => opt.id !== 'random');
    const randomOption = nonRandomOptions[Math.floor(Math.random() * nonRandomOptions.length)];
    return randomOption.text;
  }, []);

  useEffect(() => {
    if (!selectedNickname || selectedNickname === 'ランダム') {
      const initialNickname = getRandomNickname();
      setSelectedNickname(initialNickname);
    }
  }, [selectedNickname, setSelectedNickname, getRandomNickname]);

  const handleNicknameClick = useCallback((nickname: string) => {
    playSound('buttonClick');
    const finalNickname = nickname === 'ランダム' ? getRandomNickname() : nickname;
    setSelectedNickname(finalNickname);
  }, [setSelectedNickname, getRandomNickname]);

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
        
        <div className="video-container mb-4 relative" style={{ width: '320px', height: '320px' }}>
          {!isPhotoTaken ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 text-white text-xl font-bold">
                  準備中...
                </div>
              )}
            </>
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
                disabled={!capturedImage || isSavingHook}
              >
                {isSavingHook ? '保存中...' : '確定してスタート (Space)'}
              </button>
              <button 
                className="game-button w-full bg-gray-600 hover:bg-gray-700"
                onClick={retakePhoto}
                disabled={isSavingHook}
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
