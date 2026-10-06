import type { GameAssetKey } from '../assets/gameAssets';

export interface IslandTile {
  asset: Exclude<GameAssetKey, 'playerShip' | 'chaserShip' | 'shooterShip' | 'water' | 'cannonBall'>;
  x: number;
  y: number;
}

export interface Island {
  id: string;
  x: number;
  y: number;
  tiles: IslandTile[];
  colliders: { x: number; y: number; radius: number }[];
}

export function createIsland(id: string, x: number, y: number, radius: number): Island {
  // Tile coordinates are local to the island center; each official tile is 64 px.
  const layout: IslandTile['asset'][][] = [
    ['coastTopLeft', 'coastTop', 'coastTopRight'],
    ['coastLeft', 'grass', 'coastRight'],
    ['coastBottomLeft', 'coastBottom', 'coastBottomRight'],
  ];
  const tiles: IslandTile[] = [];
  layout.forEach((row, rowIndex) => {
    row.forEach((asset, columnIndex) => {
      tiles.push({ asset, x: columnIndex * 64 - 96, y: rowIndex * 64 - 96 });
    });
  });
  tiles.push({ asset: 'plant', x: -42, y: -28 }, { asset: 'rock', x: -1, y: -5 });

  return { id, x, y, tiles, colliders: [{ x: 0, y: 0, radius }] };
}
