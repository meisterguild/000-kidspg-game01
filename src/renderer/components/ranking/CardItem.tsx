import React from 'react';
import { RecentEntry, RankingTopEntry } from '@shared/types/ranking';
import { AppConfig } from '@shared/types';

interface CardItemProps {
  entry: RecentEntry | RankingTopEntry;
  config: AppConfig['ranking'] | undefined; // Changed any to AppConfig['ranking'] | undefined
}

const CardItem: React.FC<CardItemProps> = ({ entry, config }) => {
  // Determine if it's a ranking entry to show rank
  const isRankingEntry = (entry as RankingTopEntry).rank !== undefined;

  return (
    <div
      className="flex-shrink-0 bg-gray-700 p-3 rounded-md flex flex-col items-center justify-center"
      style={{ width: config?.tileSize || 376, height: config?.tileSize || 376 }} // Use config for size
    >
      {isRankingEntry && <p className="text-lg font-semibold">Rank: {(entry as RankingTopEntry).rank}</p>}
      <p className="text-lg font-semibold">Score: {entry.score}</p>
      {/* Image Placeholder - will implement actual image loading later */}
      <div className="w-full h-3/4 bg-gray-600 flex items-center justify-center text-xs mt-2">
        Image Placeholder
      </div>
      {/* Add more details like nickname, playedAt etc. as needed */}
    </div>
  );
};

export default CardItem;
