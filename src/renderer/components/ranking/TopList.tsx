import React from 'react';
import { RankingTopEntry } from '@shared/types/ranking';
import CardItem from './CardItem';
import { AppConfig } from '@shared/types';

interface TopListProps {
  entries: RankingTopEntry[];
  config: AppConfig['ranking'] | undefined;
}

const TopList: React.FC<TopListProps> = ({ entries, config }) => {
  // データが少ない場合でもシームレスなループを実現するために動的に複製
  const createLoopedEntries = (originalEntries: RankingTopEntry[]) => {
    if (originalEntries.length === 0) return [];
    
    const minDisplayCount = 10; // 最低でもこの数になるように複製
    if (originalEntries.length >= minDisplayCount) {
      return [...originalEntries, ...originalEntries]; // データが十分多い場合は2倍でOK
    }

    const repeatedEntries: RankingTopEntry[] = [];
    while (repeatedEntries.length < minDisplayCount) {
      repeatedEntries.push(...originalEntries);
    }
    // さらにもう1セット追加して、ループのつなぎ目を確実になくす
    repeatedEntries.push(...originalEntries);
    return repeatedEntries;
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
