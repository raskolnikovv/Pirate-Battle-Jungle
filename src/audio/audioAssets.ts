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
  uiClick: '/assets/sounds/ui_click.wav',
  uiHover: '/assets/sounds/ui_hover.wav',
  uiBack: '/assets/sounds/ui_back.wav',
  uiOpen: '/assets/sounds/ui_open.wav',
  uiClose: '/assets/sounds/ui_close.wav',
} as const;

export type SoundName = keyof typeof AUDIO_ASSETS;

export const UI_ACTION_SOUNDS = {
  click: 'uiClick', back: 'uiBack', open: 'uiOpen', close: 'uiClose',
} as const;
export type UiSoundAction = keyof typeof UI_ACTION_SOUNDS | 'none';
export type UiSoundName = typeof UI_ACTION_SOUNDS[keyof typeof UI_ACTION_SOUNDS] | 'uiHover';
