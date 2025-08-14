import React, { useEffect, useState } from 'react';
import { playSound } from '../utils/assets';

interface CountdownPageProps {
  onCountdownEnd: () => void;
}

const CountdownPage: React.FC<CountdownPageProps> = ({ onCountdownEnd }) => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      // カウントダウンの音を再生
      playSound('bell');
      const timer = setTimeout(() => {
        setCount(count - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      // ゲーム開始音を再生
      //playSound('newtype');
      // カウントダウン終了後、ゲーム画面に遷移
      const timer = setTimeout(() => {
        onCountdownEnd();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [count, onCountdownEnd]);

  return (
    <div className="screen-container">
      <h2 className="text-2xl md:text-3xl font-bold mb-12 text-gray-300">
        まもなくゲーム開始！
      </h2>
      
      <div className="countdown-text">
        {count > 0 ? count : 'START!'}
      </div>
      
      <div className="mt-12">
        <p className="text-lg text-gray-400">
          ← → キーで左右移動
        </p>
        <p className="text-lg text-gray-400">
          上から落ちてくる赤い障害物を避けよう！
        </p>
      </div>
    </div>
  );
};

export default CountdownPage;