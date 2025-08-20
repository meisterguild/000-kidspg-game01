import React from 'react';
import { RecentEntry } from '@shared/types/ranking';
import CardItem from './CardItem'; // Will create this
import { AppConfig } from '@shared/types';

interface RecentListProps {
  entries: RecentEntry[];
  config: AppConfig['ranking'] | undefined; // Changed any to AppConfig['ranking'] | undefined
}

const RecentList: React.FC<RecentListProps> = ({ entries, config }) => {
  return (
    <div className="w-full bg-gray-800 p-4 rounded-lg">
      <h3 className="text-2xl mb-2">Recent Plays</h3>
      {entries.length > 0 ? (
        <div className="flex overflow-x-auto space-x-4 p-2">
          {entries.map((entry, index) => (
            <CardItem key={index} entry={entry} config={config} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No recent play data.</p>
      )}
    </div>
  );
};

export default RecentList;
