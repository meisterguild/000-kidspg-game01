import React from 'react';
import { RecentEntry, RankingTopEntry } from '@shared/types/ranking';
import PaginatedScrollList from './PaginatedScrollList';
import { AppConfig } from '@shared/types';

interface ScrollableCardListProps {
  entries: (RecentEntry | RankingTopEntry)[];
  config: AppConfig['ranking'] | undefined;
}

const ScrollableCardList: React.FC<ScrollableCardListProps> = ({ 
  entries, 
  config, 
}) => {
  // ページネーション方式を使用する場合
  return <PaginatedScrollList entries={entries} config={config} />;
};

export default ScrollableCardList;