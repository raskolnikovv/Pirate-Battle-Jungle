import { Application } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/config/gameConfig';
import { destroyGameAssets, loadGameAssets, type GameAssets } from '@/game/assets/gameAssets';
import { Game } from '@/game/core/Game';
import type { GameHudSnapshot } from '@/game/core/GameHudSnapshot';
import { GameRenderer } from '@/game/rendering/GameRenderer';

interface GameCanvasProps {
  config?: GameConfig;
  onHudChange?: (snapshot: GameHudSnapshot | null) => void;
}

type CanvasStatus = 'loading' | 'ready' | 'error';

export function GameCanvas({ config = DEFAULT_GAME_CONFIG, onHudChange }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<CanvasStatus>('loading');
  const hudCallbackRef = useRef(onHudChange);

  useEffect(() => {
    hudCallbackRef.current = onHudChange;
  }, [onHudChange]);

  useEffect(() => {
    let cancelled = false;
    let app: Application | null = null;
    let appInitialized = false;
    let appDestroyed = false;
    let assets: GameAssets | null = null;
    let renderer: GameRenderer | null = null;
    let game: Game | null = null;

    const cleanup = () => {
      game?.destroy();
      game = null;

      renderer?.destroy();
      renderer = null;

      if (app && appInitialized && !appDestroyed) {
        app.destroy({ removeView: true }, { children: true });
        appDestroyed = true;
      }

      if (assets) {
        destroyGameAssets(assets);
        assets = null;
      }
    };

    async function initialize(): Promise<void> {
      setStatus('loading');
      hudCallbackRef.current?.(null);

      try {
        assets = await loadGameAssets();
        if (cancelled) {
          cleanup();
          return;
        }

        app = new Application();
        await app.init({
          width: config.arenaWidth,
          height: config.arenaHeight,
          backgroundColor: 0x0b536a,
          autoStart: false,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        appInitialized = true;

        const container = containerRef.current;
        if (cancelled || !container) {
          cleanup();
          return;
        }

        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.display = 'block';
        container.appendChild(app.canvas);

        renderer = new GameRenderer(config.arenaWidth, config.arenaHeight);
        renderer.attach(app, assets);

        game = new Game(renderer, (snapshot) => {
          if (!cancelled) hudCallbackRef.current?.(snapshot);
        });
        game.start(config);
        setStatus('ready');
      } catch (error) {
        cleanup();
        if (!cancelled) {
          console.error('Unable to initialize the game canvas:', error);
          setStatus('error');
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [config]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: `min(100%, ${config.arenaWidth}px, calc((100svh - 220px) * ${config.arenaWidth / config.arenaHeight}))`,
        aspectRatio: `${config.arenaWidth} / ${config.arenaHeight}`,
        border: '2px solid #334155',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0b536a',
      }}
    >
      {status === 'loading' && (
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#e2e8f0',
          }}
        >
          Loading arena...
        </div>
      )}
      {status === 'error' && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            color: '#fecaca',
            textAlign: 'center',
          }}
        >
          Unable to load game assets. Return to the menu and try again.
        </div>
      )}
    </div>
  );
}
