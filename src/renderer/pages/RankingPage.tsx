import React from 'react';
import { useRanking } from '../contexts/RankingContext';
import TopList from '../components/ranking/TopList';
import RecentList from '../components/ranking/RecentList';

const RankingPage: React.FC = () => {
  const { rankingData, rankingConfig, loading, error } = useRanking();

  if (loading) {
    return (
      <div className="screen-container flex items-center justify-center">
        <p className="text-white text-2xl">Loading Ranking Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen-container flex items-center justify-center">
        <p className="text-red-500 text-2xl">Error: {error}</p>
      </div>
    );
  }

  if (!rankingData || (!rankingData.recent.length && !rankingData.ranking_top.length)) {
    return (
      <div className="screen-container flex items-center justify-center">
        <p className="text-gray-400 text-2xl">No Ranking Data Available Yet.</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white overflow-hidden flex flex-col">
      {/* Top Ranking Section */}
      <div className="flex-1 flex flex-col overflow-hidden p-2">
        <h2 className="text-sm font-bold text-cyan-400 text-center flex-shrink-0 py-1">
          ランキング
        </h2>
        <div className="flex-1 relative min-h-0">
          <TopList 
            entries={rankingData.ranking_top} 
            config={rankingConfig} 
          />
        </div>
      </div>

      {/* Recent Plays Section */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 pt-4">
        <h2 className="text-sm font-bold text-cyan-400 text-center flex-shrink-0 py-1">
          みんなの きろく
        </h2>
        <div className="flex-1 relative min-h-0">
          <RecentList 
            entries={rankingData.recent} 
            config={rankingConfig} 
          />
        </div>
      </div>
    </div>
  );
};

export default RankingPage;
