import React from 'react';
import { useRanking } from '../contexts/RankingContext';
import TopList from '../components/ranking/TopList'; // ADDED
import RecentList from '../components/ranking/RecentList'; // ADDED

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
    <div className="screen-container p-4 flex flex-col h-screen bg-gray-900 text-white">

      {/* Top Ranking Section */}
      <div className="flex-1 flex flex-col items-center">
        <h2 className="text-2xl font-bold">ランキング</h2>
        <div className="flex-1 w-full flex items-center">
          <TopList entries={rankingData.ranking_top} config={rankingConfig} />
        </div>
      </div>

      {/* Recent Plays Section */}
      <div className="flex-1 flex flex-col items-center">
        <h2 className="text-2xl font-bold">みんなの きろく</h2>
        <div className="flex-1 w-full flex items-center">
          <RecentList entries={rankingData.recent} config={rankingConfig} />
        </div>
      </div>
    </div>
  );
};

export default RankingPage;
