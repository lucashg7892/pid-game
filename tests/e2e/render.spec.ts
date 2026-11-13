/**
 * Rendu en navigateur réel (T-008, réserve E9 de T-002) : démarrage WebGL2, papier réellement
 * dessiné et aligné sur le cadrage, page de repli traduite, redimensionnement, mode automatique.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { decodePng, luma, pixelAt, type DecodedPng, type Rgb } from './png';

/**
 * Textes de repli lus directement dans les locales : le chargeur ESM de Playwright refuse
 * l'import JSON sans attribut `type: json` utilisé par src/i18n (prévu pour Vite).
 */
function fallbackTexts(lang: 'fr' | 'en'): { title: string; explanation: string; docs: string } {
  const catalog = JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string | undefined>;
  return {
    title: catalog['fallback.title'] ?? '',
    explanation: catalog['fallback.explanation'] ?? '',
    docs: catalog['fallback.docs'] ?? '',
  };
}

/**
 * Avertissement de Chrome « GPU stall due to ReadPixels » en WebGL sur SwiftShader.
 * Établi (source de three 0.187 lue, T-008b) : le seul `gl.readPixels` du backend WebGL2 est dans
 * `WebGLTextureUtils.copyTextureToBuffer` (l. 1336), atteint uniquement par
 * `Renderer.readRenderTargetPixelsAsync` (l. 3576-3578), que notre code n'appelle jamais ; les
 * requêtes de chronométrage sont désactivées (`trackTimestamp` faux par défaut, Backend.js l. 76).
 * Observé par l'orchestrateur : le message apparaît sans capture ni lecture de pixels, puis cesse
 * (« this message will no longer repeat »).
 * Supposé (non vérifié dans le source de Chromium) : il provient de la composition logicielle du
 * canvas WebGL en headless, qui relit l'image rendue par SwiftShader.
 * Motif précis : ne tolère que ce message de pilote.
 */
const SWIFTSHADER_READPIXELS_STALL = /GL Driver Message .* GPU stall due to ReadPixels/;

/**
 * Messages console tolérés, par mode. En WebGL2 imposé : seulement le message ci-dessus.
 * En mode automatique, sans adaptateur WebGPU (Chromium headless) : Chrome écrit « No available
 * adapters. » quand `navigator.gpu.requestAdapter()` ne trouve aucun adaptateur, puis three avertit
 * volontairement du repli (WebGPURenderer.js l. 65-67, `getFallback`). C'est le comportement
 * attendu du repli, pas un défaut.
 */
const ALLOWED_WEBGL: readonly RegExp[] = [SWIFTSHADER_READPIXELS_STALL];
const ALLOWED_AUTO: readonly RegExp[] = [
  SWIFTSHADER_READPIXELS_STALL,
  /^No available adapters\./,
  /^THREE\.WebGPURenderer: WebGPU is not available, running under WebGL2 backend\./,
];

/** Message d'échec de l'assertion console : liste tous les messages reçus. */
const CONSOLE_FAILURE = 'messages console inattendus (liste complète ci-dessous)';

/** Collecte erreurs et avertissements console non tolérés, et exceptions non gérées. */
function watchConsole(page: Page, allowed: readonly RegExp[]): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') {
      return;
    }
    const text = message.text();
    if (!allowed.some((pattern) => pattern.test(text))) {
      problems.push(`${type}: ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`exception: ${error.message}`);
  });
  return problems;
}

/** Attend la première image dessinée (main.ts écrit alors data-draw-calls). */
async function waitFirstFrame(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
}

/** Attend deux images d'animation (le redimensionnement est appliqué puis dessiné). */
async function waitTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

function describeRgb(c: Rgb): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

/**
 * Vérifie le papier dans une capture : crème au milieu d'une case, ligne de mètre y = 0 au pixel
 * prévu par computeFrame (±2 px), plus sombre et plus bleutée ; idem ligne verticale x = 4.
 */
function checkPaper(
  image: DecodedPng,
  width: number,
  height: number,
  contrast: { readonly darker: number; readonly bluer: number } = { darker: 30, bluer: 20 },
): string[] {
  const report: string[] = [];
  const frame = computeFrame(width, height);
  // Milieu d'une case du millimètre : (0,55 m ; 0,55 m), loin de tout trait.
  const cellX = worldXToPixel(frame, width, 0.55);
  const cellY = worldYToPixel(frame, height, 0.55);
  const cream = pixelAt(image, cellX, cellY);
  report.push(
    `case (0,55 ; 0,55) → pixel (${cellX.toFixed(1)}, ${cellY.toFixed(1)}) : ${describeRgb(cream)}`,
  );
  expect(cream.r, 'papier crème : rouge').toBeGreaterThanOrEqual(225);
  expect(cream.g, 'papier crème : vert').toBeGreaterThanOrEqual(218);
  expect(cream.b, 'papier crème : bleu').toBeGreaterThanOrEqual(190);
  expect(cream.r - cream.b, 'papier chaud : R > B').toBeGreaterThanOrEqual(8);

  // Ligne horizontale y = 0 : ligne la plus sombre de la colonne x = 0,55 m autour du pixel prévu.
  const expectedRow = worldYToPixel(frame, height, 0);
  let darkestRow = -1;
  let darkest: Rgb = cream;
  for (let row = Math.floor(expectedRow) - 8; row <= Math.floor(expectedRow) + 8; row += 1) {
    const c = pixelAt(image, cellX, row);
    if (luma(c) < luma(darkest)) {
      darkest = c;
      darkestRow = row;
    }
  }
  report.push(
    `ligne y = 0 : attendue au pixel ${expectedRow.toFixed(2)}, la plus sombre en ${String(darkestRow)} (centre ${String(darkestRow + 0.5)}) : ${describeRgb(darkest)}`,
  );
  expect(
    Math.abs(darkestRow + 0.5 - expectedRow),
    'position de la ligne y = 0',
  ).toBeLessThanOrEqual(2);
  expect(luma(cream) - luma(darkest), 'ligne nettement plus sombre').toBeGreaterThanOrEqual(
    contrast.darker,
  );
  expect(darkest.b - darkest.r, 'ligne bleutée').toBeGreaterThan(
    cream.b - cream.r + contrast.bluer,
  );

  // Ligne verticale x = 4 (bord droit de la cage), sur la ligne de pixels y = 0,55 m.
  const expectedCol = worldXToPixel(frame, width, 4);
  let darkestCol = -1;
  let darkestV: Rgb = cream;
  for (let col = Math.floor(expectedCol) - 8; col <= Math.floor(expectedCol) + 8; col += 1) {
    const c = pixelAt(image, col, cellY);
    if (luma(c) < luma(darkestV)) {
      darkestV = c;
      darkestCol = col;
    }
  }
  report.push(
    `ligne x = 4 : attendue au pixel ${expectedCol.toFixed(2)}, la plus sombre en ${String(darkestCol)} : ${describeRgb(darkestV)}`,
  );
  expect(
    Math.abs(darkestCol + 0.5 - expectedCol),
    'position de la ligne x = 4',
  ).toBeLessThanOrEqual(2);
  expect(luma(cream) - luma(darkestV), 'ligne x = 4 plus sombre').toBeGreaterThanOrEqual(
    contrast.darker,
  );
  return report;
}

async function canvasBox(page: Page): Promise<{ width: number; height: number }> {
  const box = await page.locator('#scene').boundingBox();
  expect(box).not.toBeNull();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
}

test('WebGL2 imposé : démarre sans erreur console et dessine le papier', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&lang=fr');
  await waitFirstFrame(page);
  await waitTwoFrames(page);
  expect(await page.evaluate(() => document.body.dataset['backend'])).toBe('webgl');
  const box = await canvasBox(page);
  expect(box).toEqual({ width: 1280, height: 720 });
  const counts = await page.evaluate(() => [
    document.body.dataset['drawCalls'],
    document.body.dataset['triangles'],
  ]);
  test.info().annotations.push({
    type: 'mesure',
    description: `appels de dessin=${String(counts[0])}, triangles=${String(counts[1])}`,
  });
  const png = await page.screenshot({ path: 'docs/img/t008-paper-1280x720.png' });
  const report = checkPaper(decodePng(png), 1280, 720);
  test.info().annotations.push({ type: 'pixels 1280×720', description: report.join(' | ') });
  // Passe du papier (2 triangles) + passe de sortie de WebGPURenderer (conversion vers sRGB, un
  // triangle plein écran) : voir PaperStage.render dans src/render/stage.ts.
  expect(counts, 'appels de dessin, triangles').toEqual(['2', '3']);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('portrait 390×844 : papier aligné, sans déformation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await waitFirstFrame(page);
  await waitTwoFrames(page);
  const png = await page.screenshot({ path: 'docs/img/t008-paper-390x844.png' });
  // À 390 px de large (22,9 px/m), la grille fine (2,3 px de pas) est estompée et un trait de
  // mètre fait 0,5 px, dessiné sur un pixel à intensité réduite : seuils de contraste abaissés.
  const report = checkPaper(decodePng(png), 390, 844, { darker: 20, bluer: 12 });
  test.info().annotations.push({ type: 'pixels 390×844', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('redimensionnement 1280×720 → 800×900 : le canvas suit, sans déformation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await waitFirstFrame(page);
  await page.setViewportSize({ width: 800, height: 900 });
  await waitTwoFrames(page);
  await waitTwoFrames(page);
  expect(await canvasBox(page)).toEqual({ width: 800, height: 900 });
  const backing = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas === null ? [0, 0] : [canvas.width, canvas.height];
  });
  expect(backing).toEqual([800, 900]);
  const report = checkPaper(decodePng(await page.screenshot()), 800, 900);
  test.info().annotations.push({ type: 'pixels 800×900', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const lang of ['fr', 'en'] as const) {
  test(`?renderer=none : page de repli traduite (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const problems = watchConsole(page, []);
    await page.goto(`?renderer=none&lang=${lang}`);
    await expect(page.locator('body')).toHaveAttribute('data-backend', 'none');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const texts = fallbackTexts(lang);
    expect(texts.title).not.toBe('');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(texts.title);
    await expect(page.getByText(texts.explanation)).toBeVisible();
    await expect(page.getByRole('link', { name: texts.docs })).toBeVisible();
    await expect(page.locator('#scene')).toBeHidden();
    if (lang === 'fr') {
      await page.screenshot({ path: 'docs/img/t008-fallback-fr.png' });
    }
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('mode automatique : constate le backend, sans exception', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_AUTO);
  await page.goto('');
  await page.waitForFunction(() => document.body.dataset['backend'] !== undefined);
  const backend = await page.evaluate(() => document.body.dataset['backend']);
  test.info().annotations.push({ type: 'backend automatique', description: String(backend) });
  expect(['webgpu', 'webgl', 'none']).toContain(backend);
  if (backend !== 'none') {
    await waitFirstFrame(page);
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
