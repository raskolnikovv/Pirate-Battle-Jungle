import { useState } from 'react';
import { MainMenu } from '@/screens/MainMenu';
import { Options } from '@/screens/Options';
import { Game } from '@/screens/Game';
import { Result } from '@/screens/Result';
import { Ranking } from '@/screens/Ranking';
import { MatchHistory } from '@/screens/MatchHistory';
import type { GameResultPayload, ScreenName } from '@/app/navigationTypes';

export function App() {
  const [screen, setScreen] = useState<ScreenName>('main-menu');
  const [lastResult, setLastResult] = useState<GameResultPayload | undefined>(undefined);

  const navigate = (next: ScreenName, payload?: GameResultPayload) => {
    if (next === 'result' && payload) {
      setLastResult(payload);
    }
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
      return <Result onNavigate={navigate} result={lastResult} />;
    case 'ranking':
      return <Ranking onNavigate={navigate} />;
    case 'match-history':
      return <MatchHistory onNavigate={navigate} />;
    default:
      return <MainMenu onNavigate={navigate} />;
  }
}
