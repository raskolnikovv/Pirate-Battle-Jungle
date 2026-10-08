export const AUDIO_ASSETS = {
  front: '/assets/sounds/cannon_fire_1.wav',
  broadside: '/assets/sounds/cannon_broadside.wav',
  enemy: '/assets/sounds/cannon_fire_2.wav',
  impact: '/assets/sounds/ship_wood_hit_1.wav',
  coastImpact: '/assets/sounds/cannonball_water_hit_1.wav',
  explosion: '/assets/sounds/ship_explosion_1.wav',
  start: '/assets/sounds/game_start.wav',
  over: '/assets/sounds/game_over.wav',
  complete: '/assets/sounds/game_complete.wav',
  pause: '/assets/sounds/game_pause.wav',
  resume: '/assets/sounds/game_resume.wav',
  ocean: '/assets/sounds/ocean_ambience_loop.wav',
} as const;

export type SoundName = keyof typeof AUDIO_ASSETS;
