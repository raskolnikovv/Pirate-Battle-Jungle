import type { CSSProperties } from 'react';
import { MENU_ASSET_MANIFEST as assets } from '@/game/assets/menuAssets';

export const pirateThemeStyle = {
  '--menu-background': `url("${assets.background}")`,
  '--menu-panel': `url("${assets.panel}")`,
  '--menu-panel-slice': assets.panelSlice,
  '--menu-primary': `url("${assets.primary}")`,
  '--menu-primary-hover': `url("${assets.primaryHover}")`,
  '--menu-primary-pressed': `url("${assets.primaryPressed}")`,
  '--menu-secondary': `url("${assets.secondary}")`,
  '--menu-secondary-pressed': `url("${assets.secondaryPressed}")`,
  '--menu-button-slice': assets.buttonSlice,
  '--menu-button-border-height-ratio': assets.buttonBorderHeightRatio,
  '--menu-button-border-width-ratio': assets.buttonBorderWidthRatio,
} as CSSProperties;
