import React, { useState, useEffect, useMemo } from 'react';
import { RecentEntry, RankingTopEntry } from '@shared/types/ranking';
import { AppConfig } from '@shared/types';

// CardItem and CardWrapper logic is now merged into this component

interface PaginatedScrollListProps {
  entries: (RecentEntry | RankingTopEntry)[];
  config: AppConfig['ranking'] | undefined;
}

const PaginatedScrollList: React.FC<PaginatedScrollListProps> = ({ 
  entries, 
  config
}) => {
  const cardsPerPage = config?.pagination?.cardsPerPage ?? 5;
  const intervalSeconds = config?.pagination?.intervalSeconds ?? 8;
  const transitionDuration = config?.pagination?.transitionDurationMs ?? 1000;

  // 数字を全角に変換する関数
  const toFullWidth = (num: number): string => {
    const fullWidthNumbers = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
    return num.toString().split('').map(digit => fullWidthNumbers[parseInt(digit)]).join('');
  };
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});

  const pages = useMemo(() => {
    if (entries.length === 0) return [];
    const result: (RecentEntry | RankingTopEntry)[][] = [];
    for (let i = 0; i < entries.length; i += cardsPerPage) {
      result.push(entries.slice(i, i + cardsPerPage));
    }
    return result;
  }, [entries, cardsPerPage]);

  useEffect(() => {
    entries.forEach(entry => {
      if (entry.memorialCardPath && !imageUrls[entry.memorialCardPath]) {
        window.electronAPI.getImageDataUrl(entry.memorialCardPath)
          .then(url => {
            setImageUrls(prev => ({ ...prev, [entry.memorialCardPath as string]: url }));
          })
          .catch(err => {
            console.error('Failed to load image url', err);
            setImageUrls(prev => ({ ...prev, [entry.memorialCardPath as string]: null }));
          });
      }
    });
  }, [entries, imageUrls]);

  useEffect(() => {
    if (pages.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage(prev => (prev + 1) % pages.length);
        setIsTransitioning(false);
      }, transitionDuration);
      
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [pages.length, intervalSeconds, transitionDuration]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-lg">No data available</p>
      </div>
    );
  }

  const currentPageData = pages[currentPage] || [];

  return (
    <div className="w-full h-full relative">
      <div 
        className={`grid w-full h-full p-2 gap-2 transition-opacity duration-500 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ gridTemplateColumns: `repeat(${cardsPerPage}, 1fr)` }}
      >
        {currentPageData.map((entry, index) => {
          const isRankingEntry = 'rank' in entry;
          const rank = isRankingEntry ? (entry as RankingTopEntry).rank : undefined;

          let rankStyle = "";
          let rankBgStyle = "";
          if (rank) {
            if (rank === 1) {
              rankStyle = "text-2xl font-bold text-black"; // 文字色を黒に変更
              rankBgStyle = "bg-gradient-to-b from-yellow-300 to-amber-500 border-2 border-yellow-400/50"; // 背景をゴールドグラデーションに
            } else if (rank === 2) {
              rankStyle = "text-2xl font-bold text-black"; // 文字色を黒に変更
              rankBgStyle = "bg-gradient-to-b from-slate-200 to-gray-400 border-2 border-gray-400/50"; // 背景をシルバーグラデーションに
            } else if (rank === 3) {
              rankStyle = "text-2xl font-bold text-black"; // 文字色を黒に変更
              rankBgStyle = "bg-gradient-to-b from-orange-300 to-amber-600 border-2 border-orange-400/50"; // 背景をブロンズグラデーションに
            } else {
              rankStyle = "text-xl font-semibold text-white";
              rankBgStyle = "bg-black/60 border border-cyan-400/30";
            }
          }

          const imageUrl = entry.memorialCardPath ? imageUrls[entry.memorialCardPath] : null;

          return (
            <div key={`${entry.score}-${currentPage}-${index}`} className="w-full h-full flex flex-col items-center justify-center">
              {/* Rank Display */}
              <div className="flex-shrink-0 h-6 flex items-center justify-center">
                {rank && (
                  <div className={`px-3 py-1 rounded-full ${rankBgStyle}`}>
                    <span className={rankStyle}>{toFullWidth(rank)}位</span>
                  </div>
                )}
              </div>

              {/* Card Item */}
              <div className="flex-1 w-full min-h-0">
                <div 
                  className={`w-full h-full bg-gradient-to-b from-slate-700 to-slate-800 border border-cyan-400/20 rounded-lg shadow-lg relative rank-card ${
                    rank && rank <= 5 ? 'rank-card--with-aura' : ''
                  }`}
                  data-rank={rank}
                  style={{
                    overflow: rank && rank <= 5 ? 'visible' : 'hidden'
                  }}
                >
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={`Score ${entry.score}`}
                      className="absolute inset-0 w-full h-full object-contain z-10"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-10">
                      <svg className="w-8 h-8 mb-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaginatedScrollList;