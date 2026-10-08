import { Texture } from 'pixi.js';

export const GAME_ASSET_MANIFEST = {
  playerShip: '/assets/png/default/ships/ship_2.png',
  chaserShip: '/assets/png/default/ships/ship_1.png',
  shooterShip: '/assets/png/default/ships/ship_3.png',
  playerShipDamaged: '/assets/png/default/ships/ship_8.png',
  playerShipCritical: '/assets/png/default/ships/ship_14.png',
  chaserShipDamaged: '/assets/png/default/ships/ship_7.png',
  chaserShipCritical: '/assets/png/default/ships/ship_13.png',
  shooterShipDamaged: '/assets/png/default/ships/ship_9.png',
  shooterShipCritical: '/assets/png/default/ships/ship_15.png',
  fireLarge: '/assets/png/default/effects/fire_1.png',
  fireSmall: '/assets/png/default/effects/fire_2.png',
  explosionLarge: '/assets/png/default/effects/explosion_1.png',
  explosionMedium: '/assets/png/default/effects/explosion_2.png',
  explosionSmall: '/assets/png/default/effects/explosion_3.png',
  cannonBall: '/assets/png/default/ship_parts/cannon_ball.png',
  playerHealthFrame: '/assets/png/default/ui/hud/health_frame.png',
  playerHealthFill: '/assets/png/default/ui/hud/health_fill_green.png',
  enemyHealthFrame: '/assets/png/default/ui/hud/enemy_health_frame.png',
  enemyHealthFill: '/assets/png/default/ui/hud/enemy_health_fill_red.png',
  water: '/assets/png/default/tiles/tile_73.png',
  sand: '/assets/png/default/tiles/tile_4.png',
  grassClearing: '/assets/png/default/tiles/tile_23.png',
  rock: '/assets/png/default/tiles/tile_65.png',
  plant: '/assets/png/default/tiles/tile_70.png',
  palm: '/assets/png/default/tiles/tile_71.png',
  smallPlant: '/assets/png/default/tiles/tile_72.png',
  fortTower: '/assets/png/default/tiles/tile_13.png',
  fortWall: '/assets/png/default/tiles/tile_16.png',
  fortWallVertical: '/assets/png/default/tiles/tile_15.png',
  fortGate: '/assets/png/default/tiles/tile_76.png',
} as const;

export type GameAssetKey = keyof typeof GAME_ASSET_MANIFEST;
export type GameAssets = Record<GameAssetKey, Texture>;

export async function loadGameAssets(onProgress?: (loaded: number, total: number) => void): Promise<GameAssets> {
  let loaded = 0;
  const total = Object.keys(GAME_ASSET_MANIFEST).length;
  onProgress?.(0, total);
  const results = await Promise.allSettled(
    Object.entries(GAME_ASSET_MANIFEST).map(async ([key, path]) => {
      const image = new Image();
      image.src = path;
      try {
        await image.decode();
      } catch {
        throw new Error(`Could not load gameplay asset: ${path}`);
      }
      const texture = Texture.from(image);
      onProgress?.(++loaded, total);
      return [key, texture] as const;
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
