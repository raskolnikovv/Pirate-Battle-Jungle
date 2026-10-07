import { defineConfig, loadEnv } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'DEV_');
  const certPath = resolve(env.DEV_HTTPS_CERT ?? '.cert/dev.pem');
  const keyPath = resolve(env.DEV_HTTPS_KEY ?? '.cert/dev-key.pem');
  if (mode === 'mobile' && (!existsSync(certPath) || !existsSync(keyPath))) {
    throw new Error('Mobile HTTPS requires .cert/dev.pem and .cert/dev-key.pem. Follow the mkcert setup in README.md.');
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    server: {
      port: 5173,
      https: mode === 'mobile' ? { cert: readFileSync(certPath), key: readFileSync(keyPath) } : undefined,
    },
  };
});
