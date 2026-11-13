import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const chromePath = process.env['PW_CHROME_PATH'];
const executablePath = chromePath !== undefined && chromePath !== '' ? chromePath : undefined;

/**
 * Tests e2e (spec T-001 §9) : Chromium seul, contre le build de production servi par
 * `vite preview` sous la base GitHub Pages `/pid-game/`.
 *
 * Options de lancement de Chromium : `--use-angle=swiftshader` impose le rendu WebGL logiciel
 * (SwiftShader) pour que l'e2e ne dépende pas d'un GPU réel ; `--enable-unsafe-swiftshader` est
 * exigé par Chromium récent pour autoriser WebGL sur SwiftShader sans avertissement console ;
 * `--ignore-gpu-blocklist` évite que la liste noire GPU désactive WebGL en machine virtuelle.
 * Aucune option WebGPU n'est ajoutée : le mode automatique est constaté, pas forcé.
 *
 * Variable d'environnement `PW_CHROME_PATH` : si elle est définie et non vide, Chromium n'est pas
 * celui téléchargé par `npx playwright install` mais l'exécutable indiqué
 * (`launchOptions.executablePath`), p. ex. `PW_CHROME_PATH=/usr/bin/google-chrome npm run e2e`.
 * Utile quand le téléchargement est impossible (réseau filtré) et qu'un Chrome est déjà installé.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}/pid-game/`,
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
        launchOptions: {
          ...(executablePath === undefined ? {} : { executablePath }),
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/pid-game/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
