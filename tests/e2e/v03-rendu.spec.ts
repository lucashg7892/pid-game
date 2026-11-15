/**
 * Rendu des phases du poste, de l'embarquement et de la sortie (T-038), en navigateur réel,
 * WebGL2 imposé, `?e2e=1&anim=1` : le bonhomme est dessiné à la position réelle de l'instantané
 * (abscisse et hauteur des pieds), la main sur le levier au poste, sans toucher au pupitre ;
 * pendant la sortie il marche dans la cabine, franchit le pas puis marche sur le plateau.
 *
 * Mesures de pixels : graphite = pixel sombre et gris neutre (voir level.spec.ts), interface
 * masquée pendant la mesure. Captures documentaires (interface visible) dans docs/img/t038-*.png.
 */
import { expect, test, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel, type Frame } from '../../src/render/camera';
import { WALKER_HEAD_TOP } from '../../src/render/level-display';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';
import { decodePng, luma, pixelAt, type DecodedPng, type Rgb } from './png';

const WIDTH = 1280;
const HEIGHT = 720;
const FRAME = computeFrame(WIDTH, HEIGHT);
/** Pupitre de la console : x de CONSOLE_X ± 0,3 m, au-dessus du pied (0,75 m), levier exclu. */
const DESK = { minX: -1.28, maxX: -0.72, minY: 0.77, maxY: 0.95 } as const;
const SETPOINT = 3;

function isGraphite(c: Rgb, maxLuma = 150): boolean {
  return luma(c) < maxLuma && c.g - c.r < 25;
}

async function open(page: Page, query: string): Promise<string[]> {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&lang=fr&e2e=1&anim=1&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  await page.waitForFunction(() => window.__huygens !== undefined);
  await page.addStyleTag({
    content: 'body.t038-bare #ui, body.t038-bare #screens { visibility: hidden !important; }',
  });
  return problems;
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

/** Capture décodée, interface masquée (mesures). */
async function measure(page: Page): Promise<DecodedPng> {
  await page.evaluate(() => {
    document.body.classList.add('t038-bare');
  });
  await frames(page);
  const image = decodePng(await page.screenshot());
  await page.evaluate(() => {
    document.body.classList.remove('t038-bare');
  });
  return image;
}

/** Capture documentaire (interface visible). */
async function shoot(page: Page, name: string): Promise<void> {
  await frames(page);
  await page.screenshot({ path: `docs/img/${name}.png` });
}

/** Avance de `seconds` (0 : redessine) et renvoie l'instantané. */
async function advance(page: Page, seconds: number): Promise<LevelSnapshot> {
  return page.evaluate((s) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    hook.advance(s);
    return hook.snapshot();
  }, seconds);
}

/** Avance par images de 1/60 s tant que `stop` est faux ; renvoie l'instantané. */
async function advanceUntil(
  page: Page,
  stop: 'exit' | 'tripEnd' | 'boardingEnd' | { x: number } | { progress: number },
): Promise<LevelSnapshot> {
  return page.evaluate((target) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    for (let i = 0; i < 60 * 30; i += 1) {
      const s = hook.snapshot();
      if (target === 'exit' && s.phase === 'exit') break;
      if (target === 'tripEnd' && s.phase !== 'trip' && s.phase !== 'boarding') break;
      if (target === 'boardingEnd' && s.phase !== 'boarding') break;
      if (typeof target === 'object' && 'x' in target && s.walkerX >= target.x) break;
      if (
        typeof target === 'object' &&
        'progress' in target &&
        s.exitStepProgress >= target.progress
      )
        break;
      hook.advance(1 / 60);
    }
    return hook.snapshot();
  }, stop);
}

async function setGain(page: Page, id: 'level1' | 'level2', value: number): Promise<void> {
  await page.evaluate(
    ([l, v]) => {
      const c = window.__huygens?.commands;
      if (c === undefined) throw new Error('window.__huygens absent');
      if (l === 'level2') c.setKi(v);
      else c.setKp(v);
    },
    [id, value] as const,
  );
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

/**
 * Hauteur monde du haut du bonhomme : premier pixel de graphite en descendant, dans la bande
 * d'abscisse x ± 0,12 m, depuis `from` (m) ; `null` s'il n'y en a pas jusqu'à `from − 1,2 m`.
 */
function topOfWalker(image: DecodedPng, x: number, from: number): number | null {
  const x0 = Math.floor(worldXToPixel(FRAME, image.width, x - 0.12));
  const x1 = Math.ceil(worldXToPixel(FRAME, image.width, x + 0.12));
  const yStart = Math.floor(worldYToPixel(FRAME, image.height, from));
  const yEnd = Math.floor(worldYToPixel(FRAME, image.height, from - 1.2));
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let px = x0; px <= x1; px += 1) {
      if (isGraphite(pixelAt(image, px, y))) {
        return from - (y - worldYToPixel(FRAME, image.height, from)) / FRAME.pixelsPerMeter;
      }
    }
  }
  return null;
}

/** Abscisse affichée du bonhomme (même interpolation que le rendu). */
function shownX(s: LevelSnapshot): number {
  return s.walkerPrevX + (s.walkerX - s.walkerPrevX) * s.alpha;
}

/** Lance le trajet gagnant depuis le poste et avance jusqu'au début de la sortie. */
async function toExit(page: Page, id: 'level1' | 'level2', gain: number): Promise<LevelSnapshot> {
  await page.keyboard.press('e');
  await advance(page, 3);
  await setGain(page, id, gain);
  await page.evaluate(() => window.__huygens?.commands.launch());
  const s = await advanceUntil(page, 'exit');
  expect(s.phase).toBe('exit');
  return s;
}

test('poste : main sur le levier, bonhomme à gauche du pupitre, sans chevauchement', async ({
  page,
}) => {
  const problems = await open(page, 'screen=level1');
  const away = await measure(page);
  const awayDesk = countGraphite(away, FRAME, DESK.minX, DESK.minY, DESK.maxX, DESK.maxY);
  const awayLeft = countGraphite(away, FRAME, -1.9, 0.05, -1.32, 1.8);
  await page.keyboard.press('e');
  const s = await advance(page, 3);
  expect(s.atPost).toBe(true);
  expect(s.walkerAction).toBe('atPost');
  const post = await measure(page);
  const deskCount = countGraphite(post, FRAME, DESK.minX, DESK.minY, DESK.maxX, DESK.maxY);
  const leftCount = countGraphite(post, FRAME, -1.9, 0.05, -1.32, 1.8);
  test.info().annotations.push({
    type: 'pixels',
    description: `pupitre ${String(awayDesk)} → ${String(deskCount)} ; gauche ${String(awayLeft)} → ${String(leftCount)}`,
  });
  // Le bonhomme est là (beaucoup de graphite à gauche du pupitre) mais pas dans le pupitre.
  expect(leftCount - awayLeft).toBeGreaterThan(150);
  expect(Math.abs(deskCount - awayDesk)).toBeLessThanOrEqual(Math.max(6, 0.1 * awayDesk));
  await setGain(page, 'level1', 2500);
  await advance(page, 0);
  await shoot(page, 't038-poste-niveau1');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('embarquement : le bonhomme marche du poste vers la cabine', async ({ page }) => {
  const problems = await open(page, 'screen=level1');
  await page.keyboard.press('e');
  await advance(page, 3);
  await setGain(page, 'level1', 2500);
  await page.evaluate(() => window.__huygens?.commands.launch());
  const s = await advance(page, 1.5);
  expect(s.phase).toBe('boarding');
  expect(s.walkerAction).toBe('boarding');
  const x = shownX(s);
  expect(x).toBeGreaterThan(-0.5);
  expect(x).toBeLessThan(1.5);
  const image = await measure(page);
  const top = topOfWalker(image, x, WALKER_HEAD_TOP + 0.04);
  expect(top, 'le bonhomme est dessiné à son abscisse').not.toBeNull();
  expect(Math.abs((top ?? 0) - (WALKER_HEAD_TOP - 0.05))).toBeLessThan(0.12);
  await shoot(page, 't038-embarquement');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const lvl of [
  { id: 'level1', gain: 2500 },
  { id: 'level2', gain: 800 },
] as const) {
  test(`sortie ${lvl.id} : marche dans la cabine, pas, plateau`, async ({ page }) => {
    const problems = await open(page, `screen=${lvl.id}`);
    let s = await toExit(page, lvl.id, lvl.gain);
    const y0 = s.walkerY;
    const error = s.finalError ?? 0;
    // Début de la marche dans la cabine : l'abscisse avance, les pieds sont au plancher.
    s = await advanceUntil(page, { x: 2.5 });
    expect(s.walkerAction).toBe('exiting');
    expect(s.walkerInCabin).toBe(true);
    const inside = await measure(page);
    const x1 = shownX(s);
    const top1 = topOfWalker(inside, x1, y0 + WALKER_HEAD_TOP + 0.04);
    expect(top1, 'tête dessinée dans la cabine').not.toBeNull();
    expect(Math.abs((top1 ?? 0) - (y0 + WALKER_HEAD_TOP - 0.05))).toBeLessThan(0.12);
    // Rien à l'ancienne place forcée au centre de la cabine, à ce moment.
    expect(topOfWalker(inside, 2, y0 + WALKER_HEAD_TOP + 0.04)).toBeNull();
    // Avant le pas (à gauche du montant de la cabine, x ≈ 3,5 m) : hauteur de la cabine.
    s = await advanceUntil(page, { x: 3.25 });
    const before = await measure(page);
    const topBefore = topOfWalker(before, shownX(s), y0 + WALKER_HEAD_TOP + 0.04);
    // Au milieu du pas.
    s = await advanceUntil(page, { progress: 0.5 });
    expect(s.walkerAction).toBe('stepping');
    expect(s.walkerY).toBeCloseTo(y0 + s.exitStepProgress * error, 9);
    expect(s.exitStepProgress).toBeGreaterThanOrEqual(0.5);
    await advance(page, 0);
    if (lvl.id === 'level1') await shoot(page, 't038-sortie-pas-niveau1');
    // Sur le plateau, en marche.
    s = await advanceUntil(page, { x: 4.25 });
    expect(s.walkerY).toBe(SETPOINT);
    const after = await measure(page);
    const topAfter = topOfWalker(after, shownX(s), SETPOINT + WALKER_HEAD_TOP + 0.04);
    expect(topBefore).not.toBeNull();
    expect(topAfter).not.toBeNull();
    const rise = (topAfter ?? 0) - (topBefore ?? 0);
    test.info().annotations.push({
      type: 'pixels',
      description: `montée mesurée ${rise.toFixed(3)} m, attendue ${error.toFixed(3)} m`,
    });
    expect(Math.abs(rise - error)).toBeLessThan(0.07);
    if (lvl.id === 'level1') {
      expect(rise).toBeGreaterThan(0.1);
    }
    // Plateau : le bonhomme n'est pas dans la masse hachurée (rien d'autre qu'au repère de contrôle).
    const below = countGraphite(after, FRAME, shownX(s) - 0.12, 1.1, shownX(s) + 0.12, 2.9);
    const control = countGraphite(after, FRAME, 5.1 - 0.12, 1.1, 5.1 + 0.12, 2.9);
    expect(below).toBeLessThanOrEqual(control + 6);
    // Arrivée : issue affichée, bonhomme sur le plateau.
    s = await advanceUntil(page, { x: 4.6 });
    await advance(page, 0.1);
    expect(s.phase === 'exit' || s.phase === 'outcome').toBe(true);
    const done = await advance(page, 0.2);
    expect(done.phase).toBe('outcome');
    expect(done.walkerAction).toBe('arrived');
    if (lvl.id === 'level1') await shoot(page, 't038-sortie-arrivee-niveau1');
    else await shoot(page, 't038-sortie-niveau2');
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}
