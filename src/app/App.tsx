import { useState } from 'react';
import { MainMenu } from '@/screens/MainMenu';
import { Options } from '@/screens/Options';
import { Game } from '@/screens/Game';
import { Result } from '@/screens/Result';
import { Ranking } from '@/screens/Ranking';
import { MatchHistory } from '@/screens/MatchHistory';
import type { GameResultPayload, ScreenName } from '@/app/navigationTypes';
import { loadLastCompletedMatch, saveLastCompletedMatch } from '@/storage/completedMatchStorage';

export function App() {
  const [screen, setScreen] = useState<ScreenName>(() => window.location.hash === '#result' ? 'result' : 'main-menu');
  const [lastResult, setLastResult] = useState<GameResultPayload | undefined>(loadLastCompletedMatch);
  const [resultStorageError, setResultStorageError] = useState(false);

  const navigate = (next: ScreenName, payload?: GameResultPayload) => {
    if (next === 'result' && payload) {
      setLastResult(payload);
      setResultStorageError(!saveLastCompletedMatch(payload));
    }
    // Only Result is restored on reload; an active match is never resumed from storage.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next === 'result' ? '#result' : ''}`);
    setScreen(next);
  };

  switch (screen) {
    case 'main-menu':
      return <MainMenu onNavigate={navigate} />;
    case 'options':
      return <Options onNavigate={navigate} />;
    case 'game':
      return <Game onNavigate={navigate} />;
    case 'result':
      return <Result onNavigate={navigate} result={lastResult} storageError={resultStorageError} />;
    case 'ranking':
      return <Ranking onNavigate={navigate} />;
    case 'match-history':
      return <MatchHistory onNavigate={navigate} />;
    default:
      return <MainMenu onNavigate={navigate} />;
  }
}
