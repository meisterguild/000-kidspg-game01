import React, { useState, useEffect } from 'react';
import { RecentEntry, RankingTopEntry } from '@shared/types/ranking';
import { AppConfig } from '@shared/types';

interface CardItemProps {
  entry: RecentEntry | RankingTopEntry;
  config: AppConfig['ranking'] | undefined;
}

interface ImagePanel {
  url: string | null;
  loading: boolean;
}

const CardItem: React.FC<CardItemProps> = ({ entry, config }) => {
  const [panelA, setPanelA] = useState<ImagePanel>({ url: null, loading: true });
  const [panelB, setPanelB] = useState<ImagePanel>({ url: null, loading: true });
  const [activePanel, setActivePanel] = useState<'A' | 'B'>('A');

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadImageToPanel = async (panelType: 'A' | 'B'): Promise<void> => {
      if (entry.memorialCardPath) {
        try {
          const url = await window.electronAPI.getImageDataUrl(entry.memorialCardPath);
          
          if (panelType === 'A') {
            setPanelA({ url, loading: false });
          } else {
            setPanelB({ url, loading: false });
          }
        } catch (error) {
          console.error('Failed to load image:', error);
          if (panelType === 'A') {
            setPanelA({ url: null, loading: false });
          } else {
            setPanelB({ url: null, loading: false });
          }
        }
      } else {
        if (panelType === 'A') {
          setPanelA({ url: null, loading: false });
        } else {
          setPanelB({ url: null, loading: false });
        }
      }
    };

    // データ更新時のダブルバッファリング処理
    const handleDataUpdate = async () => {
      setInitialLoading(true);
      
      // 非アクティブパネルに新しい画像をロード
      const nextPanel = activePanel === 'A' ? 'B' : 'A';
      
      try {
        await loadImageToPanel(nextPanel);
        // ロード完了後にパネル切り替え（チラつき防止）
        setActivePanel(nextPanel);
        setInitialLoading(false);
      } catch (error) {
        console.error('Failed to update image:', error);
        setInitialLoading(false);
      }
    };

    // 初回ロード時
    if (panelA.url === null && panelB.url === null) {
      // 初回は並列ロードで高速化
      setPanelA({ url: null, loading: true });
      setPanelB({ url: null, loading: true });
      setInitialLoading(true);
      
      Promise.all([
        loadImageToPanel('A'),
        loadImageToPanel('B')
      ]).then(() => {
        setInitialLoading(false);
      }).catch((error) => {
        console.error('Failed to load initial images:', error);
        setInitialLoading(false);
      });
    } else {
      // データ更新時はダブルバッファリング
      handleDataUpdate();
    }
  }, [entry.memorialCardPath]);


  const isRankingEntry = (entry as RankingTopEntry).rank !== undefined;

  // ランクに応じてスタイルを動的に決定
  let rankStyle = "";
  if (isRankingEntry) {
    const rank = (entry as RankingTopEntry).rank;
    if (rank === 1) {
      // 1位: 金色
      rankStyle = "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-500 [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]";
    } else if (rank === 2) {
      // 2位: 銀色
      rankStyle = "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-slate-200 to-gray-400 [text-shadow:0_2px_2px_rgba(0,0,0,0.5)]";
    } else if (rank === 3) {
      // 3位: 銅色
      rankStyle = "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-amber-600 [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]";
    } else {
      // 4位以下: 白色
      rankStyle = "text-3xl font-semibold text-white";
    }
  }

  return (
    <div
      className="flex-shrink-0 bg-gradient-to-b from-slate-700 to-slate-800 border border-cyan-400/20 rounded-lg p-3 shadow-lg flex flex-col items-center justify-center"
      style={{ width: config?.tileSize || 376, height: config?.tileSize || 376 }}
    >
      {isRankingEntry && <p className={rankStyle}>{(entry as RankingTopEntry).rank}位</p>}
      
      <div className="w-full h-4/5 bg-gray-600/50 rounded-md flex items-center justify-center text-xs mt-2">
        {(() => {
          // 初期ロード中は共通のLoading表示
          if (initialLoading) {
            return <p>Loading Image...</p>;
          }
          
          const currentPanel = activePanel === 'A' ? panelA : panelB;
          
          if (currentPanel.url) {
            return (
              <img 
                src={currentPanel.url} 
                alt={`Memorial Card for score ${entry.score}`} 
                className="max-w-full max-h-full object-contain" 
              />
            );
          } else {
            return <p>Image Not Available</p>;
          }
        })()}
      </div>
    </div>
  );
};

export default CardItem;
