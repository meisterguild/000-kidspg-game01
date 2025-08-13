import React, { useEffect } from 'react';
import { SpriteViewerTest } from './SpriteViewerTest';

export const TestPage: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.location.href = '/'; // トップページにリダイレクト
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <SpriteViewerTest />
      </div>
    </div>
  );
};