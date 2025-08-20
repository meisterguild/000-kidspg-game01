import React from 'react';
import { RankingTopEntry } from '@shared/types/ranking';
import CardItem from './CardItem'; // Will create this
import { AppConfig } from '@shared/types';

interface TopListProps {
  entries: RankingTopEntry[];
  config: AppConfig['ranking'] | undefined; // Changed any to AppConfig['ranking'] | undefined
}

const TopList: React.FC<TopListProps> = ({ entries, config }) => {
  return (
    <div className="w-full bg-gray-800 p-4 rounded-lg">
      <h3 className="text-2xl mb-2">Top Scores</h3>
      {entries.length > 0 ? (
        <div className="flex overflow-x-auto space-x-4 p-2">
          {entries.map((entry, index) => (
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
