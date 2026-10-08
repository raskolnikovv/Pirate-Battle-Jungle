import { MENU_ASSET_MANIFEST } from "@/game/assets/menuAssets";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MenuAssetLoader } from "@/components/MenuAssetLoader";
import { App } from "@/app/App";
import { ReactQueryProvider } from "@/app/ReactQueryProvider";
import { ensureMockWorkerReady } from "@/mocks/browser";
import "@/index.css";

async function bootstrap() {
  try {
    await ensureMockWorkerReady();
  } catch (err) {
    console.warn("MSW failed to start:", err);
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  rootElement.style.setProperty('--loading-background', `url("${MENU_ASSET_MANIFEST.mainMenuBackground}")`);

  createRoot(rootElement).render(
    <StrictMode>
      <ReactQueryProvider>
        <MenuAssetLoader><App /></MenuAssetLoader>
      </ReactQueryProvider>
    </StrictMode>,
  );
}

void bootstrap();
