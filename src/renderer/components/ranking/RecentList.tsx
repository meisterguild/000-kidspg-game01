import React from 'react';
import { RecentEntry } from '@shared/types/ranking';
import CardItem from './CardItem';
import { AppConfig } from '@shared/types';

interface RecentListProps {
  entries: RecentEntry[];
  config: AppConfig['ranking'] | undefined;
}

const RecentList: React.FC<RecentListProps> = ({ entries, config }) => {
  // 3セット複製でオーバーラップ描画を実現
  const createLoopedEntries = (originalEntries: RecentEntry[]) => {
    if (originalEntries.length === 0) return [];
    // 3セット複製: [A][B][A] - 1セット目終端前に2セット目開始
    return [...originalEntries, ...originalEntries, ...originalEntries];
  };

  const loopedEntries = createLoopedEntries(entries);

  return (
    <div className="w-full h-full overflow-hidden">
      {entries.length > 0 ? (
        <div className="animate-scroll-recent space-x-2 flex h-full items-center">
          {loopedEntries.map((entry, index) => (
            <CardItem key={index} entry={entry} config={config} />
          ))}
          <div className="flex-shrink-0 w-48"></div>
        </div>
      ) : (
        <p className="text-gray-500">No recent play data.</p>
      )}
    </div>
  );
};

export default RecentList;
