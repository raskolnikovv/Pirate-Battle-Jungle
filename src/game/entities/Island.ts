import type { GameAssetKey } from '../assets/gameAssets';

export interface IslandTile {
  asset: Exclude<GameAssetKey, 'playerShip' | 'chaserShip' | 'shooterShip' | 'water' | 'cannonBall'>;
  x: number;
  y: number;
  /** Uniform visual scaling only; never changes collision geometry. */
  scale?: number;
}

export interface Island {
  id: string;
  x: number;
  y: number;
  tiles: IslandTile[];
  colliders: { x: number; y: number; radius: number }[];
}

export function createCoverIsland(id: string, x: number, y: number, radius: number): Island {
  return { id, x, y,
    tiles: [{ asset: 'palm', x: -25, y: -29, scale: 0.65 },
      { asset: 'rock', x: 10, y: 12, scale: 0.4 }],
    colliders: [{ x: 0, y: 0, radius }] };
}

export function createIsland(
  id: string, x: number, y: number, radius: number, direction: 1 | -1 = 1,
): Island {
  // Convex peninsulas: one circle per landmass, with all solid art inside it.
  // Radius also drives the renderer's sand mask, so artwork and physics agree.
  const tiles: IslandTile[] = direction === 1 ? [
    { asset: 'fortWall', x: 25, y: -80 },
    { asset: 'fortWallVertical', x: -32, y: -23 },
    { asset: 'fortWallVertical', x: 82, y: -23 },
    { asset: 'fortGate', x: 25, y: 34 },
    { asset: 'fortTower', x: -32, y: -80 },
    { asset: 'fortTower', x: 82, y: -80 },
    { asset: 'fortTower', x: -32, y: 34 },
    { asset: 'fortTower', x: 82, y: 34 },
  ] : [];
  tiles.push(
    { asset: 'palm', x: 176, y: 48, scale: 0.85 },
    { asset: 'smallPlant', x: 176, y: 112, scale: 0.5 },
    { asset: 'rock', x: 70, y: 170, scale: 0.65 },
    { asset: 'plant', x: 128, y: 152, scale: 0.65 },
  );
  const visualScale = radius / 260;
  for (const tile of tiles) {
    const scale = tile.scale ?? 1;
    // Relocate southeast decoration without mirroring the official artwork.
    if (direction === -1) {
      tile.x = -tile.x - 64 * scale;
      tile.y = -tile.y - 64 * scale;
    }
    tile.x *= visualScale;
    tile.y *= visualScale;
    tile.scale = scale * visualScale;
  }
  return { id, x, y, tiles, colliders: [{ x: 0, y: 0, radius }] };
}
