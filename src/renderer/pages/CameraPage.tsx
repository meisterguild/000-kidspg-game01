import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NICKNAME_OPTIONS, CAMERA_CONFIG, TIMING_CONFIG } from '@shared/utils/constants';
import { useImageResize } from '../hooks/useImageResize';
import { playSound } from '../utils/assets';
import { useScreen } from '../contexts/ScreenContext';
import { useGameSession } from '../contexts/GameSessionContext';
import { useCamera } from '../contexts/CameraContext';
import { cameraService } from '../services/camera-service';
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
  const { isReady: isCameraReady, isUsingDummy, error: cameraError } = useCamera();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPhotoTaken, setIsPhotoTaken] = useState(!!capturedImage);
  const { savePhoto, isSaving: isSavingHook, error: saveError } = useSavePhoto();
  const { resizeToSquare } = useImageResize();
  const [dummyPhotoPath, setDummyPhotoPath] = useState('');

  // ダミーモード時にアセットの絶対パスを取得
  useEffect(() => {
    if (isUsingDummy) {
      window.electronAPI?.getAssetAbsolutePath('assets/images/dummy_photo.png')
        .then(path => {
          // Windowsのパス区切り文字をスラッシュに変換し、file://プロトコルを付与
          const url = path.replace(/\\/g, '/');
          setDummyPhotoPath(`file://${url}`);
        })
        .catch(err => {
          console.error('Failed to get dummy photo path:', err);
          // フォールバックパスを設定
          setDummyPhotoPath('./assets/images/dummy_photo.png'); 
        });
    }
  }, [isUsingDummy]);

  // 準備済みカメラストリームを使用
  const setupVideoStream = useCallback(() => {
    if (isUsingDummy || !videoRef.current) {
      return;
    }

    const stream = cameraService.getStream();
    if (stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadeddata = () => {
      };
    }
  }, [isUsingDummy]);

  useEffect(() => {
    if (!isPhotoTaken && isCameraReady) {
      const timer = setTimeout(() => {
        setupVideoStream();
      }, TIMING_CONFIG.cameraStartDelay);
      return () => clearTimeout(timer);
    }
  }, [isPhotoTaken, isCameraReady, setupVideoStream]);

  const capturePhoto = useCallback(() => {
    playSound('buttonClick');

    try {
      if (isUsingDummy) {
        if (!dummyPhotoPath) {
          throw new Error('ダミー画像のパスが設定されていません');
        }
        // ダミーモード: 取得したアセットパスを使用
        const dummyImageSrc = dummyPhotoPath;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = 320;
            canvas.height = 320;
            ctx.drawImage(img, 0, 0, 320, 320);
            const imageData = canvas.toDataURL('image/png');
            setCapturedImage(imageData);
            setIsPhotoTaken(true);
          }
        };
        img.onerror = () => {
          // フォールバック: CameraServiceのダミー画像を使用
          const dummyImageData = cameraService.getDummyImageData();
          if (dummyImageData) {
            setCapturedImage(dummyImageData);
            setIsPhotoTaken(true);
          } else {
            throw new Error('ダミー画像が利用できません');
          }
        };
        img.src = dummyImageSrc;
      } else {
        // 実カメラモード: カメラから撮影
        if (!videoRef.current || !canvasRef.current) {
          throw new Error('カメラまたはキャンバスが利用できません');
        }

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context を取得できませんでした');
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = resizeToSquare(canvas, CAMERA_CONFIG.width);
        setCapturedImage(imageData);
        setIsPhotoTaken(true);
      }
    } catch (error) {
      console.error('写真撮影エラー:', error);
      alert('画像の処理中にエラーが発生しました。もう一度お試しください。');
    }
  }, [isUsingDummy, resizeToSquare, setCapturedImage, dummyPhotoPath]);

  const retakePhoto = useCallback(() => {
    setIsPhotoTaken(false);
    setCapturedImage('');
    if (!isUsingDummy) {
      setupVideoStream();
    }
  }, [setCapturedImage, isUsingDummy, setupVideoStream]);

  const handleConfirm = useCallback(async () => {
    if (!capturedImage || isSavingHook) return;

    playSound('buttonClick');

    const result = await savePhoto(capturedImage, isUsingDummy);

    if (result.success && result.dirPath) {
      setResultDir(result.dirPath);
      setCurrentScreen('COUNTDOWN');
    } else {
      console.error('写真の保存に失敗しました:', saveError || result.error);
      alert(`写真の保存に失敗しました: ${saveError || result.error}`);
    }
  }, [capturedImage, setResultDir, setCurrentScreen, savePhoto, isSavingHook, saveError, isUsingDummy]);

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
        <h2 className="text-xl font-bold mb-4">カメラをみて<br/>スペースバーをおす！</h2>
        
        <div className="video-container mb-4 relative" style={{ width: '320px', height: '320px' }}>
          {!isPhotoTaken ? (
            <>
              {isUsingDummy ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 relative">
                  {dummyPhotoPath ? (
                    <img 
                      src={dummyPhotoPath} 
                      alt="ダミーカメラ画像"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load dummy_photo.png from path:', dummyPhotoPath);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p>ダミー画像読込中...</p>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 text-xs rounded">
                    ダミーモード
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 text-white text-xl font-bold">
                  {cameraError ? 'カメラエラー' : '準備中...'}
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
              さつえい (Space)
            </button>
          ) : (
            <>
              <button 
                className="game-button w-full bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={!capturedImage || isSavingHook}
              >
                {isSavingHook ? '保存中...' : 'スタート (Space)'}
              </button>
              <button 
                className="game-button w-full bg-gray-600 hover:bg-gray-700"
                onClick={retakePhoto}
                disabled={isSavingHook}
              >
                やりなおし
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraPage;