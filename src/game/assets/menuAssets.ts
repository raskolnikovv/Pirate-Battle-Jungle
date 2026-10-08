// Paths and logical panel borders inspected in spritesheet/ui_sheet.json.
export const MENU_ASSET_MANIFEST = {
  background: '/assets/ui_scene_background.png',
  // Background supplied by the project owner for the menu screens.
  mainMenuBackground: '/assets/main-menu-background.png',
  panel: '/assets/png/default/ui/menu/panel_menu.png',
  title: '/assets/png/retina/ui/menu/title_pirate_battle.png',
  primary: '/assets/png/retina/ui/menu/button_primary_normal.png',
  primaryHover: '/assets/png/retina/ui/menu/button_primary_hover.png',
  primaryPressed: '/assets/png/retina/ui/menu/button_primary_pressed.png',
  secondary: '/assets/png/retina/ui/menu/button_secondary_normal.png',
  secondaryPressed: '/assets/png/retina/ui/menu/button_secondary_pressed.png',
  panelSlice: '40 32 40 32 fill',
  // Buttons are 256x88 logical pixels (512x176 retina). The atlas has
  // label rectangles but no button borders. These cuts were selected by
  // inspecting the PNGs: 32px top/bottom and 40px left/right retain the bolts.
  buttonSlice: '64 80 64 80 fill',
  buttonBorderHeightRatio: 32 / 88,
  buttonBorderWidthRatio: 40 / 88,
} as const;

const menuPaths = Object.values(MENU_ASSET_MANIFEST).filter((value): value is Extract<typeof value, string> => typeof value === 'string' && value.endsWith('.png'));
let menuLoading: Promise<void> | null = null;
let loadedImages = 0;
const progressListeners = new Set<(loaded: number, total: number) => void>();

export function subscribeMenuAssetProgress(listener: (loaded: number, total: number) => void): () => void {
  progressListeners.add(listener);
  listener(loadedImages, menuPaths.length);
  return () => { progressListeners.delete(listener); };
}

// Share decoding across Strict Mode mounts; report decoded images, not simulated time.
export function loadMenuAssets(): Promise<void> {
  if (!menuLoading) {
    loadedImages = 0;
    for (const listener of progressListeners) listener(0, menuPaths.length);
    menuLoading = Promise.allSettled(menuPaths.map(async path => {
      const image = new Image();
      image.src = path;
      await image.decode();
      loadedImages++;
      for (const listener of progressListeners) listener(loadedImages, menuPaths.length);
    })).then(results => {
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') { menuLoading = null; throw failure.reason; }
    });
  }
  return menuLoading;
}
