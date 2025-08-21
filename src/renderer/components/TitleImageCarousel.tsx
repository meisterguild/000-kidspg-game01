import React, { useState, useEffect } from 'react';
import { getImageAssets } from '../utils/assets';

const TitleImageCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeImageSlot, setActiveImageSlot] = useState<'A' | 'B'>('A');
  const [imageSlotA, setImageSlotA] = useState(0);
  const [imageSlotB, setImageSlotB] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  
  useEffect(() => {
    const loadImages = async () => {
      const imageAssets = await getImageAssets();
      setImages([
        imageAssets.titleImage04, //主人公がいてるので、この画像を先頭に
        imageAssets.titleImage01,
        imageAssets.titleImage02,
        imageAssets.titleImage03
      ]);
    };
    loadImages();
  }, []);

  useEffect(() => {
    if (images.length === 0) return; // 画像が読み込まれていない場合は何もしない
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      const nextIndex = (currentIndex + 1) % images.length;
      
      // 非アクティブなスロットに次の画像をセット
      if (activeImageSlot === 'A') {
        setImageSlotB(nextIndex);
      } else {
        setImageSlotA(nextIndex);
      }
      
      // アニメーション完了後にアクティブスロットを切り替え
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setActiveImageSlot(activeImageSlot === 'A' ? 'B' : 'A');
        setIsTransitioning(false);
      }, 2000); // アニメーション時間と合わせる
    }, 8000); // 8秒間隔

    return () => clearInterval(interval);
  }, [currentIndex, activeImageSlot, images.length]);

  return (
    <div className="title-image-container">
      <div className="title-image-wrapper">
        {/* 画像スロット A */}
        <img
          src={images[imageSlotA]}
          alt="よけまくり中 タイトル"
          className={`
            title-image 
            ${activeImageSlot === 'A' ? 'title-image-active' : 'title-image-inactive'}
            ${isTransitioning && activeImageSlot === 'A' ? 'title-image-exit' : ''}
            ${isTransitioning && activeImageSlot === 'B' ? 'title-image-enter' : ''}
          `}
        />
        
        {/* 画像スロット B */}
        <img
          src={images[imageSlotB]}
          alt="よけまくり中 タイトル"
          className={`
            title-image 
            ${activeImageSlot === 'B' ? 'title-image-active' : 'title-image-inactive'}
            ${isTransitioning && activeImageSlot === 'B' ? 'title-image-exit' : ''}
            ${isTransitioning && activeImageSlot === 'A' ? 'title-image-enter' : ''}
          `}
        />
      </div>
    </div>
  );
};

export default TitleImageCarousel;