import React from 'react';
import { RecentEntry } from '@shared/types/ranking';
import { AppConfig } from '@shared/types';
import ScrollableCardList from './ScrollableCardList';

interface RecentListProps {
  entries: RecentEntry[];
  config: AppConfig['ranking'] | undefined;
}

const RecentList: React.FC<RecentListProps> = ({ entries, config }) => {
  return (
    <ScrollableCardList 
      entries={entries}
      config={config}
    />
  );
};

export default RecentList;
