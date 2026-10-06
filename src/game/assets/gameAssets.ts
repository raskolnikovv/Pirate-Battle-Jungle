import { Texture } from 'pixi.js';

export const GAME_ASSET_MANIFEST = {
  playerShip: '/assets/png/default/ships/ship_1.png',
  chaserShip: '/assets/png/default/ships/ship_2.png',
  shooterShip: '/assets/png/default/ships/ship_3.png',
  cannonBall: '/assets/png/default/ship_parts/cannon_ball.png',
  playerHealthFrame: '/assets/png/default/ui/hud/health_frame.png',
  playerHealthFill: '/assets/png/default/ui/hud/health_fill_green.png',
  enemyHealthFrame: '/assets/png/default/ui/hud/enemy_health_frame.png',
  enemyHealthFill: '/assets/png/default/ui/hud/enemy_health_fill_red.png',
  water: '/assets/png/default/tiles/tile_73.png',
  coastTopLeft: '/assets/png/default/tiles/tile_6.png',
  coastTop: '/assets/png/default/tiles/tile_7.png',
  coastTopRight: '/assets/png/default/tiles/tile_9.png',
  coastLeft: '/assets/png/default/tiles/tile_38.png',
  grass: '/assets/png/default/tiles/tile_39.png',
  coastRight: '/assets/png/default/tiles/tile_41.png',
  coastBottomLeft: '/assets/png/default/tiles/tile_54.png',
  coastBottom: '/assets/png/default/tiles/tile_56.png',
  coastBottomRight: '/assets/png/default/tiles/tile_57.png',
  rock: '/assets/png/default/tiles/tile_65.png',
  plant: '/assets/png/default/tiles/tile_70.png',
} as const;

export type GameAssetKey = keyof typeof GAME_ASSET_MANIFEST;
export type GameAssets = Record<GameAssetKey, Texture>;

export async function loadGameAssets(): Promise<GameAssets> {
  const results = await Promise.allSettled(
    Object.entries(GAME_ASSET_MANIFEST).map(async ([key, path]) => {
      const image = new Image();
      image.src = path;
      try {
        await image.decode();
      } catch {
        throw new Error(`Could not load gameplay asset: ${path}`);
      }
      return [key, Texture.from(image)] as const;
    }),
  );
  const textures: [string, Texture][] = [];
  let failure: PromiseRejectedResult | undefined;
  for (const result of results) {
    if (result.status === 'fulfilled') textures.push([...result.value]);
    else failure = result;
  }
  if (failure) {
    textures.forEach(([, texture]) => texture.destroy(true));
    throw failure.reason;
  }
  return Object.fromEntries(textures) as GameAssets;
}

export function destroyGameAssets(assets: GameAssets): void {
  Object.values(assets).forEach((texture) => texture.destroy(true));
}
