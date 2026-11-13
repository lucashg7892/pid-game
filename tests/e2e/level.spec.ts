/**
 * Niveau 1 dessiné au crayon (T-009), en navigateur réel, WebGL2 imposé, crochet de test
 * `?e2e=1` : le temps n'avance que par `window.__huygens.advance`, ce qui rend chaque capture
 * déterministe. Captures dans docs/img/t009-*.png (1280×720, sauf le portrait).
 *
 * Reconnaissance des pixels de graphite : sombres (luminance < 150) et gris neutre (vert − rouge
 * < 25), ce qui exclut les traits bleu-vert du papier millimétré (vert − rouge ≈ 60) et, en
 * pratique, les hachures légères (encre 0,55 à 0,6 : luminance ≈ 145 à 160).
 */
import { expect, test, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel, type Frame } from '../../src/render/camera';
import { CURVE_ORIGIN_X, CURVE_SPAN } from '../../src/render/curve';
import { WALKER_HEAD_TOP } from '../../src/render/level-display';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';
import { decodePng, luma, pixelAt, type DecodedPng, type Rgb } from './png';

const WIDTH = 1280;
const HEIGHT = 720;
/**
 * Luminance maximale d'un pixel du plancher (trait le plus appuyé : encre 1, opacité perçue 0,85,
 * grain ≤ 25 %, soit une luminance attendue de 85 à 125 environ au cœur du trait).
 */
const FLOOR_MAX_LUMA = 135;

/** Étape d'un scénario exécuté dans la page par le crochet de test. */
type Step =
  | readonly ['advance' | 'setKp' | 'adjustKp', number]
  | readonly [
      'moveLeft' | 'moveRight' | 'stop' | 'interact' | 'launch' | 'restart' | 'pause' | 'resume',
    ];

/** Pixel de graphite (ou de crayon rouge) : sombre et sans la teinte bleu-vert de la grille. */
function isGraphite(c: Rgb, maxLuma = 150): boolean {
  return luma(c) < maxLuma && c.g - c.r < 25;
}

function describeRgb(c: Rgb): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

/** Ouvre le jeu en mode test et attend la première image et le crochet. */
async function openGame(page: Page, width = WIDTH, height = HEIGHT): Promise<string[]> {
  await page.setViewportSize({ width, height });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&e2e=1&lang=fr');
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  await page.waitForFunction(() => window.__huygens !== undefined);
  return problems;
}

/** Exécute des étapes dans la page puis renvoie une copie de l'instantané. */
async function run(page: Page, steps: readonly Step[]): Promise<LevelSnapshot> {
  return page.evaluate((list) => {
    const hook = window.__huygens;
    if (hook === undefined) {
      throw new Error('window.__huygens absent');
    }
    for (const step of list) {
      const name = step[0];
      if (name === 'advance') {
        hook.advance(step[1]);
      } else if (name === 'setKp' || name === 'adjustKp') {
        hook.commands[name](step[1]);
      } else {
        hook.commands[name]();
      }
    }
    return hook.snapshot();
  }, steps);
}

/** Marche jusqu'à la console (3,9 m en 2,6 s) et ouvre le réglage. */
const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop'], ['interact']];

/** Attend deux images d'animation (l'image dessinée par `advance` est affichée). */
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

async function capture(page: Page, name: string): Promise<DecodedPng> {
  await waitTwoFrames(page);
  return decodePng(await page.screenshot({ path: `docs/img/${name}` }));
}

/** Nombre de pixels de graphite dans un rectangle monde. */
function countGraphite(
  image: DecodedPng,
  frame: Frame,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  const x0 = Math.ceil(worldXToPixel(frame, image.width, minX));
  const x1 = Math.floor(worldXToPixel(frame, image.width, maxX));
  const y0 = Math.ceil(worldYToPixel(frame, image.height, maxY));
  const y1 = Math.floor(worldYToPixel(frame, image.height, minY));
  let count = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (isGraphite(pixelAt(image, x, y))) count += 1;
    }
  }
  return count;
}

/** Vrai s'il y a un pixel de graphite à `radius` pixels au plus du point monde (x, y). */
function graphiteNear(image: DecodedPng, frame: Frame, x: number, y: number, radius: number) {
  const px = worldXToPixel(frame, image.width, x);
  const py = worldYToPixel(frame, image.height, y);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (isGraphite(pixelAt(image, px + dx, py + dy), 140)) return true;
    }
  }
  return false;
}

/** Hauteur affichée de la cabine (même interpolation que le rendu). */
function displayedCabinY(s: LevelSnapshot): number {
  return s.phase === 'trip' ? s.cabinPrevY + (s.cabinY - s.cabinPrevY) * s.alpha : s.cabinY;
}

/** Vérifie que le plancher est dessiné au pixel attendu (±3 px), colonne x = 3 m. */
function checkFloor(image: DecodedPng, frame: Frame, y: number, report: string[]): void {
  const column = worldXToPixel(frame, image.width, 3);
  const expected = worldYToPixel(frame, image.height, y);
  let top = -1;
  for (let row = Math.floor(expected) - 12; row <= Math.floor(expected) + 12; row += 1) {
    if (isGraphite(pixelAt(image, column, row), FLOOR_MAX_LUMA)) {
      top = row;
      break;
    }
  }
  let dark = false;
  for (let row = Math.round(expected) - 3; row <= Math.round(expected) + 3; row += 1) {
    if (isGraphite(pixelAt(image, column, row), FLOOR_MAX_LUMA)) dark = true;
  }
  report.push(
    `plancher y = ${y.toFixed(4)} m : attendu au pixel ${expected.toFixed(1)}, premier pixel de graphite en ${String(top)}`,
  );
  expect(dark, 'trait sombre à ±3 px de la hauteur du plancher').toBe(true);
  expect(top, 'bord haut du plancher').toBeGreaterThanOrEqual(Math.floor(expected) - 4);
  expect(top, 'bord haut du plancher').toBeLessThanOrEqual(Math.ceil(expected) + 3);
}

/** Points (x, y) monde de la courbe de la dernière image. */
async function trace(page: Page): Promise<[number, number][]> {
  const flat = await page.evaluate(() => window.__huygens?.trace() ?? []);
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
  }
  return points;
}

/** Vérifie la courbe en des points de la montée (y entre 0,4 et 2,2 m, loin du plancher). */
function checkCurve(
  image: DecodedPng,
  frame: Frame,
  points: readonly [number, number][],
  report: string[],
): void {
  const targets = [0.5, 1.0, 1.5, 2.0];
  let found = 0;
  for (const target of targets) {
    const point = points.find(([, y]) => y >= target);
    expect(point, `la courbe atteint y = ${String(target)}`).toBeDefined();
    if (point === undefined) continue;
    const ok = graphiteNear(image, frame, point[0], point[1], 2);
    report.push(
      `courbe (${point[0].toFixed(3)} ; ${point[1].toFixed(3)}) : ${ok ? 'trait' : 'VIDE'}`,
    );
    if (ok) found += 1;
  }
  expect(found, 'points de la courbe dessinés').toBeGreaterThanOrEqual(3);
}

test('(a) état initial : le bonhomme est dessiné', async ({ page }) => {
  const problems = await openGame(page);
  const s = await run(page, []);
  expect(s.phase).toBe('approach');
  const image = await capture(page, 't009-01-approche.png');
  const frame = computeFrame(WIDTH, HEIGHT);
  const box = countGraphite(
    image,
    frame,
    s.walkerX - 0.45,
    0.15,
    s.walkerX + 0.45,
    WALKER_HEAD_TOP,
  );
  test
    .info()
    .annotations.push({ type: 'bonhomme', description: `${String(box)} pixels de graphite` });
  expect(box, 'pixels sombres dans la boîte du bonhomme').toBeGreaterThanOrEqual(60);
  // Témoin : la même boîte décalée de 2 m vers la droite (papier vierge) n'a pas de graphite.
  const empty = countGraphite(
    image,
    frame,
    s.walkerX + 1.55,
    0.15,
    s.walkerX + 2.45,
    WALKER_HEAD_TOP,
  );
  expect(empty, 'témoin vide').toBe(0);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(b, c, d) console, trajet Kp = 2500, victoire au pas 291', async ({ page }) => {
  const problems = await openGame(page);
  const frame = computeFrame(WIDTH, HEIGHT);
  const report: string[] = [];

  const atConsole = await run(page, TO_CONSOLE);
  expect(atConsole.phase).toBe('tuning');
  await capture(page, 't009-02-console.png');

  const trip = await run(page, [['setKp', 2500], ['launch'], ['advance', 1.0]]);
  expect(trip.phase).toBe('trip');
  expect(trip.kp).toBe(2500);
  expect(trip.k).toBe(120);
  const tripImage = await capture(page, 't009-03-trajet.png');
  checkFloor(tripImage, frame, displayedCabinY(trip), report);
  checkCurve(tripImage, frame, await trace(page), report);

  const win = await run(page, [['advance', 3.0]]);
  expect(win.outcome).toBe('win');
  expect(win.outcomeK).toBe(291);
  const winImage = await capture(page, 't009-04-victoire.png');
  checkFloor(winImage, frame, win.cabinY, report);
  // Cote d'erreur : trait vertical entre le plancher et le quai (x = 3,68 m).
  const mid = (win.cabinY + 3) / 2;
  expect(graphiteNear(winImage, frame, 3.68, mid, 2), 'cote d’erreur dessinée').toBe(true);
  test.info().annotations.push({ type: 'pixels', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(e) Kp = 4500 : choc au pas 58', async ({ page }) => {
  const problems = await openGame(page);
  const s = await run(page, [...TO_CONSOLE, ['setKp', 4500], ['launch'], ['advance', 1.0]]);
  expect(s.outcome).toBe('bonk');
  expect(s.outcomeK).toBe(58);
  const image = await capture(page, 't009-05-choc.png');
  const report: string[] = [];
  checkFloor(image, computeFrame(WIDTH, HEIGHT), s.cabinY, report);
  test.info().annotations.push({ type: 'pixels', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f, g) Kp = 1500 : marche trop haute au pas 1800, courbe dans sa zone, budget', async ({
  page,
}) => {
  const problems = await openGame(page);
  const s = await run(page, [...TO_CONSOLE, ['setKp', 1500], ['launch'], ['advance', 16]]);
  expect(s.outcome).toBe('step');
  expect(s.outcomeK).toBe(1800);
  const image = await capture(page, 't009-06-trop-court.png');
  const frame = computeFrame(WIDTH, HEIGHT);
  const report: string[] = [];
  const points = await trace(page);
  expect(points.length).toBe(1801);
  for (const [x, y] of points) {
    expect(x).toBeGreaterThanOrEqual(CURVE_ORIGIN_X - 1e-9);
    expect(x).toBeLessThanOrEqual(CURVE_ORIGIN_X + CURVE_SPAN + 1e-9);
    expect(y).toBeGreaterThanOrEqual(-1e-9);
    expect(y).toBeLessThan(3.3);
  }
  checkCurve(image, frame, points, report);
  // Bandes de part et d'autre de la zone de la courbe (entre montant et plancher) : vierges.
  const left = countGraphite(image, frame, 0.06, 0.15, 0.14, 2.4);
  const right = countGraphite(image, frame, 3.86, 0.15, 3.94, 2.4);
  report.push(`graphite hors zone : gauche ${String(left)}, droite ${String(right)}`);
  expect(left, 'aucun trait de courbe à gauche de la zone').toBe(0);
  expect(right, 'aucun trait de courbe à droite de la zone').toBe(0);
  const stats = await page.evaluate(() => window.__huygens?.stats());
  report.push(`stats : ${JSON.stringify(stats)}`);
  test.info().annotations.push({ type: 'pixels', description: report.join(' | ') });
  expect(stats).toBeDefined();
  expect(stats?.drawCalls ?? 99).toBeLessThanOrEqual(50);
  expect(stats?.triangles ?? 99_999).toBeLessThanOrEqual(30_000);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(h) sans ?e2e=1, window.__huygens est absent', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  expect(await page.evaluate(() => typeof window.__huygens)).toBe('undefined');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(i) portrait 390×844 : victoire dessinée, sans erreur console', async ({ page }) => {
  const problems = await openGame(page, 390, 844);
  const s = await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 4]]);
  expect(s.outcome).toBe('win');
  const image = await capture(page, 't009-07-portrait.png');
  const frame = computeFrame(390, 844);
  const floor = pixelAt(image, worldXToPixel(frame, 390, 3), worldYToPixel(frame, 844, s.cabinY));
  test.info().annotations.push({ type: 'plancher', description: describeRgb(floor) });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
