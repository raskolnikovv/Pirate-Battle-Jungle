export interface WeaponCooldowns {
  primary: number;
  secondary: number;
}

export interface ChaserConfig {
  health: number;
  speed: number;
  damage: number;
  contactDamage: number;
  collisionRadius: number;
}

export interface ShooterConfig {
  collisionRadius: number;
  health: number;
  speed: number;
  projectileDamage: number;
  fireCooldown: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileCollisionRadius: number;
  projectileSpawnOffset: number;
  attackRange: number;
}

export interface GameConfig {
  arenaWidth: number;
  arenaHeight: number;
  playerBoundaryPadding: number;
  enemyBoundaryPadding: number;
  playerCollisionRadius: number;
  islandCollisionRadius: number;
  sessionDuration: number;
  enemySpawnInterval: number;
  enemySpawnWeights: { chaser: number; shooter: number };
  enemySpawnMinimumDistance: number;
  enemySpawnMaxAttempts: number;
  enemySpawnMargin: number;
  enemySpawnSeed: number;
  playerHealth: number;
  playerMovementSpeed: number;
  playerRotationSpeed: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileLifetime: number;
  projectileCollisionRadius: number;
  frontShotOffset: number;
  broadsideOffset: number;
  broadsideProjectileCount: number;
  broadsideSpacing: number;
  weaponCooldowns: WeaponCooldowns;
  chaser: ChaserConfig;
  shooter: ShooterConfig;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arenaWidth: 960,
  arenaHeight: 600,
  playerBoundaryPadding: 66,
  enemyBoundaryPadding: 66,
  playerCollisionRadius: 32,
  islandCollisionRadius: 104,
  sessionDuration: 120,
  enemySpawnInterval: 3,
  enemySpawnWeights: { chaser: 60, shooter: 40 },
  enemySpawnMinimumDistance: 320,
  enemySpawnMaxAttempts: 20,
  enemySpawnMargin: 66,
  enemySpawnSeed: 12345,
  playerHealth: 100,
  playerMovementSpeed: 200,
  playerRotationSpeed: 3,
  projectileSpeed: 400,
  projectileDamage: 25,
  projectileLifetime: 3,
  projectileCollisionRadius: 5,
  frontShotOffset: 62,
  broadsideOffset: 38,
  broadsideProjectileCount: 3,
  broadsideSpacing: 24,
  weaponCooldowns: {
    primary: 0.3,
    secondary: 1.0,
  },
  chaser: {
    health: 50,
    speed: 120,
    damage: 15,
    contactDamage: 20,
    collisionRadius: 32,
  },
  shooter: {
    collisionRadius: 32,
    health: 50,
    speed: 90,
    projectileDamage: 10,
    fireCooldown: 1.5,
    projectileSpeed: 260,
    projectileLifetime: 3,
    projectileCollisionRadius: 5,
    projectileSpawnOffset: 62,
    attackRange: 300,
  },
};
