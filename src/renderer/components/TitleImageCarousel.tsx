import React, { useState, useEffect } from 'react';
import { IMAGE_ASSETS } from '../utils/assets';

const TitleImageCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeImageSlot, setActiveImageSlot] = useState<'A' | 'B'>('A');
  const [imageSlotA, setImageSlotA] = useState(0);
  const [imageSlotB, setImageSlotB] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const images = [
    IMAGE_ASSETS.titleImage01,
    IMAGE_ASSETS.titleImage02,
    IMAGE_ASSETS.titleImage03,
    IMAGE_ASSETS.titleImage04
  ];

  useEffect(() => {
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
    }, 10000); // 10秒間隔

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