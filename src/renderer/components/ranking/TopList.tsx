import React from 'react';
import { RankingTopEntry } from '@shared/types/ranking';
import CardItem from './CardItem';
import { AppConfig } from '@shared/types';

interface TopListProps {
  entries: RankingTopEntry[];
  config: AppConfig['ranking'] | undefined;
}

const TopList: React.FC<TopListProps> = ({ entries, config }) => {
  // 3セット複製でオーバーラップ描画を実現
  const createLoopedEntries = (originalEntries: RankingTopEntry[]) => {
    if (originalEntries.length === 0) return [];
    // 3セット複製: [A][B][A] - 1セット目終端前に2セット目開始
    return [...originalEntries, ...originalEntries, ...originalEntries];
  };

  const loopedEntries = createLoopedEntries(entries);

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 to-black p-4 rounded-2xl border-2 border-cyan-400/30 shadow-lg shadow-cyan-400/10 overflow-hidden">
      {entries.length > 0 ? (
        <div className="flex space-x-4 p-2 animate-scroll">
          {loopedEntries.map((entry, index) => (
            <CardItem key={index} entry={entry} config={config} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No top ranking data.</p>
      )}
    </div>
  );
};

export default TopList;
