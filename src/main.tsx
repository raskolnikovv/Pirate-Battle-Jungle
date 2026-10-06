import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { ReactQueryProvider } from "@/app/ReactQueryProvider";
import { worker } from "@/mocks/browser";
import "@/index.css";

async function bootstrap() {
  if (import.meta.env.DEV) {
    try {
      await worker.start();
    } catch (err) {
      console.warn("MSW failed to start:", err);
    }
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ReactQueryProvider>
        <App />
      </ReactQueryProvider>
    </StrictMode>,
  );
}

void bootstrap();
