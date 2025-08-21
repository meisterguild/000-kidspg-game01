import React from 'react';
import { RankingTopEntry } from '@shared/types/ranking';
import { AppConfig } from '@shared/types';
import ScrollableCardList from './ScrollableCardList';

interface TopListProps {
  entries: RankingTopEntry[];
  config: AppConfig['ranking'] | undefined;
}

const TopList: React.FC<TopListProps> = ({ entries, config }) => {
  return (
    <ScrollableCardList 
      entries={entries}
      config={config}
    />
  );
};

export default TopList;
