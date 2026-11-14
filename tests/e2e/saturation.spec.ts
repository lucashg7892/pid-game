/**
 * Saturation du moteur (K20) de bout en bout, WebGL2 imposé, crochet `?e2e=1` (temps déterministe).
 * Kp = 4500 et Kp = 2500 demandent plus que les 5000 N du moteur au départ (erreur ≈ 3 m) : la
 * jauge de force est rouge, l'instantané signale la saturation, l'interface affiche « Saturé » et
 * annonce l'événement. Capture : docs/img/t016-saturation.png.
 *
 * Reconnaissance du crayon rouge : r ≥ 120, r − g ≥ 60 et r − b ≥ 60 (le graphite est neutre,
 * le papier millimétré bleu-vert), comptée dans le rectangle monde de la jauge (cadre et éclats).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { GAUGE_MAX_X, GAUGE_MAX_Y, GAUGE_MIN_X, GAUGE_MIN_Y } from '../../src/render/pencil-style';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';
import { hideUi } from './overlay';
import { decodePng, pixelAt, type DecodedPng } from './png';

const WIDTH = 1280;
const HEIGHT = 720;

const FR = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'),
) as Record<string, string | undefined>;

/** Pixels de crayon rouge dans la jauge de force (marge d'un éclat au-dessus du cadre). */
function redInGauge(image: DecodedPng): number {
  const frame = computeFrame(WIDTH, HEIGHT);
  const x0 = Math.floor(worldXToPixel(frame, WIDTH, GAUGE_MIN_X - 0.05));
  const x1 = Math.ceil(worldXToPixel(frame, WIDTH, GAUGE_MAX_X + 0.05));
  const y0 = Math.floor(worldYToPixel(frame, HEIGHT, GAUGE_MAX_Y + 0.2));
  const y1 = Math.ceil(worldYToPixel(frame, HEIGHT, GAUGE_MIN_Y - 0.05));
  let count = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const c = pixelAt(image, x, y);
      if (c.r >= 120 && c.r - c.g >= 60 && c.r - c.b >= 60) count += 1;
    }
  }
  return count;
}

async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    window.__huygens?.advance(s);
  }, seconds);
}

async function frames(page: Page): Promise<void> {
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

/** Lance un trajet au Kp donné, console atteinte, et renvoie la liste des problèmes console. */
async function start(page: Page, kp: number): Promise<string[]> {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&e2e=1&lang=fr');
  await page.waitForFunction(() => window.__huygens !== undefined);
  await page.evaluate((value) => {
    const h = window.__huygens;
    if (h === undefined) throw new Error('window.__huygens absent');
    h.commands.moveRight();
    h.advance(2.6);
    h.commands.stop();
    h.commands.interact();
    h.commands.setKp(value);
    h.commands.launch();
  }, kp);
  return problems;
}

/** Kp 2500 : saturé à 0,1 s (jauge rouge), plus à 0,5 s (jauge au crayon ordinaire). */
test('(a) Kp = 2500 : jauge rouge à 0,1 s, non rouge à 0,5 s', async ({ page }) => {
  const problems = await start(page, 2500);
  await hideUi(page);
  await advance(page, 0.1);
  const early = await page.evaluate(() => window.__huygens?.snapshot());
  expect(early?.phase).toBe('trip');
  expect(early?.saturated).toBe(true);
  expect(early?.uSat).toBe(5000);
  await frames(page);
  const redEarly = redInGauge(decodePng(await page.screenshot()));

  await advance(page, 0.4);
  const late = await page.evaluate(() => window.__huygens?.snapshot());
  expect(late?.phase).toBe('trip');
  expect(late?.saturated).toBe(false);
  await frames(page);
  const redLate = redInGauge(decodePng(await page.screenshot()));

  test.info().annotations.push({
    type: 'pixels rouges',
    description: `saturé : ${String(redEarly)}, non saturé : ${String(redLate)}`,
  });
  expect(redEarly, 'crayon rouge dans la jauge saturée').toBeGreaterThanOrEqual(500);
  expect(redLate, 'aucun rouge dans la jauge non saturée').toBe(0);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

/** Kp 4500 : instantané, texte « Saturé », annonce et capture de l'écran complet. */
test('(b) Kp = 4500 : interface « Saturé », annonce, capture', async ({ page }) => {
  const problems = await start(page, 4500);
  await advance(page, 0.1);
  const s = await page.evaluate(() => window.__huygens?.snapshot());
  expect(s?.saturated).toBe(true);
  expect(s?.saturationSeen).toBe(true);
  expect(s?.saturatedSteps).toBeGreaterThan(0);

  await frames(page);
  await expect(page.locator('.ui-saturated')).toBeVisible();
  await expect(page.locator('.ui-saturated')).toHaveText(FR['hud.saturated'] ?? '');
  await expect(page.locator('.ui-force')).toHaveClass(/is-saturated/);
  await expect(page.locator('[aria-live="polite"]')).toContainText(FR['level1.saturation'] ?? '');
  await page.screenshot({ path: 'docs/img/t016-saturation.png' });

  // Une fois sorti de la saturation (0,3 s), le texte disparaît ; l'événement reste vu.
  await advance(page, 0.3);
  await frames(page);
  const after = await page.evaluate(() => window.__huygens?.snapshot());
  expect(after?.saturated).toBe(false);
  expect(after?.saturationSeen).toBe(true);
  await expect(page.locator('.ui-saturated')).toBeHidden();
  await expect(page.locator('.ui-force')).not.toHaveClass(/is-saturated/);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
