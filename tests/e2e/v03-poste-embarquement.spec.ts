/**
 * Poste au pupitre, embarquement et sortie (T-037, D31-D32) en navigateur réel, WebGL2 imposé,
 * animations activées par `anim=1` (le mode `e2e=1` les désactive sinon) : E depuis l'entrée
 * ouvre le réglage tout de suite et le bonhomme rejoint le poste ; lancement → embarquement →
 * trajet → sortie → issue ; échec sans sortie ; touche « passer » et `skipAnimation` ; aux deux
 * niveaux. Le dessin des poses viendra ensuite : ici, on lit l'état par le crochet de test.
 *
 * Captures : seulement si la variable CAPTURE_DIR est définie (aucune dans docs/img).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

/** Textes français (le chargeur ESM de Playwright refuse l'import JSON de src/i18n). */
const FR_DATA = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'),
) as Record<string, string | undefined>;
function FR(key: string): string {
  const value = FR_DATA[key];
  if (value === undefined) throw new Error(`clé absente : ${key}`);
  return value;
}

/** Poste au pupitre, centre de la cabine, fin de la sortie (m) : valeurs de src/game/constants. */
const POST_X = -1.55;
const CABIN_X = 2;
const EXIT_END_X = 4.6;
const SETPOINT = 3;

async function open(page: Page, query: string): Promise<string[]> {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&lang=fr&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

interface Summary {
  phase: string;
  action: string;
  walkerX: number;
  walkerY: number;
  facing: number;
  atPost: boolean;
  inCabin: boolean;
  animations: boolean;
  k: number;
  cabinY: number;
  outcome: string | null;
  finalError: number | null;
  progress: number;
}

/** Avance de `seconds` (0 : redessine seulement) et résume l'instantané. */
async function advance(page: Page, seconds = 0): Promise<Summary> {
  return page.evaluate((s) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    hook.advance(s);
    const snap = hook.snapshot();
    return {
      phase: snap.phase,
      action: snap.walkerAction,
      walkerX: snap.walkerX,
      walkerY: snap.walkerY,
      facing: snap.walkerFacing,
      atPost: snap.atPost,
      inCabin: snap.walkerInCabin,
      animations: snap.animations,
      k: snap.k,
      cabinY: snap.cabinY,
      outcome: snap.outcome,
      finalError: snap.finalError,
      progress: snap.exitStepProgress,
    };
  }, seconds);
}

/** Avance par images de 1/60 s jusqu'à ce que la phase change (au plus `limit` s). */
async function advanceWhile(page: Page, phase: string, limit = 20): Promise<Summary> {
  return page.evaluate(
    ([p, max]) => {
      const hook = window.__huygens;
      if (hook === undefined) throw new Error('window.__huygens absent');
      for (let i = 0; i < max * 60 && hook.snapshot().phase === p; i += 1) hook.advance(1 / 60);
      const snap = hook.snapshot();
      return {
        phase: snap.phase,
        action: snap.walkerAction,
        walkerX: snap.walkerX,
        walkerY: snap.walkerY,
        facing: snap.walkerFacing,
        atPost: snap.atPost,
        inCabin: snap.walkerInCabin,
        animations: snap.animations,
        k: snap.k,
        cabinY: snap.cabinY,
        outcome: snap.outcome,
        finalError: snap.finalError,
        progress: snap.exitStepProgress,
      };
    },
    [phase, limit] as const,
  );
}

/** Règle la grandeur du niveau courant par le crochet. */
async function setGain(page: Page, level: 'level1' | 'level2', value: number): Promise<void> {
  await page.evaluate(
    ([l, v]) => {
      const hook = window.__huygens;
      if (hook === undefined) throw new Error('window.__huygens absent');
      if (l === 'level2') hook.commands.setKi(v);
      else hook.commands.setKp(v);
    },
    [level, value] as const,
  );
}

async function capture(page: Page, name: string): Promise<void> {
  const dir = process.env['CAPTURE_DIR'];
  if (dir !== undefined && dir !== '') {
    await page.screenshot({ path: `${dir}/t037-${name}.png` });
  }
}

const LEVELS = [
  { id: 'level1', win: 2500, fail: 7000, failOutcome: 'bonk' },
  { id: 'level2', win: 800, fail: 0, failOutcome: 'step' },
] as const;

for (const lvl of LEVELS) {
  test(`(a) ${lvl.id} : E depuis l’entrée, poste, embarquement, trajet, sortie, issue`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    const panel = page.locator('#ui .ui-pupitre');
    const outcome = page.locator('#ui .ui-outcome');
    const banner = page.locator('#ui .ui-banner');
    let s = await advance(page);
    expect(s.animations).toBe(true);
    expect(s.phase).toBe('approach');
    await expect(banner).toContainText(FR('hud.hint.use'));
    const start = s.walkerX;
    // E depuis l'entrée : pupitre ouvert tout de suite.
    await page.keyboard.press('e');
    s = await advance(page);
    expect(s.phase).toBe('tuning');
    expect(s.action).toBe('toPost');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.ui-pupitre-lancer')).toBeEnabled();
    s = await advance(page, 1);
    expect(s.walkerX).toBeGreaterThan(start);
    expect(s.action).toBe('toPost');
    s = await advance(page, 2);
    expect(s.atPost).toBe(true);
    expect(s.walkerX).toBe(POST_X);
    expect(s.facing).toBe(1);
    await capture(page, `${lvl.id}-poste`);
    await setGain(page, lvl.id, lvl.win);
    // Entrée maintenue : lance une fois ; la répétition ne passe pas l'embarquement.
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    s = await advance(page);
    expect(s.phase).toBe('boarding');
    // Lancé : le pupitre se range, la scène montre l'embarquement (il se rouvre en lecture seule
    // avec le bouton « Pupitre », sans pause : voir pupitre.spec.ts).
    await expect(panel).toBeHidden();
    await expect(banner).toContainText(FR('hud.hint.skip'));
    s = await advance(page, 1);
    expect(s.phase).toBe('boarding');
    expect(s.walkerX).toBeGreaterThan(POST_X);
    expect(s.k).toBe(0);
    await capture(page, `${lvl.id}-embarquement`);
    s = await advanceWhile(page, 'boarding');
    expect(s.phase).toBe('trip');
    expect(s.walkerX).toBe(CABIN_X);
    expect(s.inCabin).toBe(true);
    await advance(page, 1);
    await capture(page, `${lvl.id}-cabine`);
    s = await advanceWhile(page, 'trip');
    expect(s.phase).toBe('exit');
    expect(s.outcome).toBe('win');
    await expect(outcome).toBeHidden();
    // Avance jusqu'au pas de sortie.
    s = await advance(page, 1.25);
    expect(s.phase).toBe('exit');
    await capture(page, `${lvl.id}-sortie`);
    s = await advanceWhile(page, 'exit');
    expect(s.phase).toBe('outcome');
    expect(s.action).toBe('arrived');
    expect(s.walkerX).toBe(EXIT_END_X);
    expect(s.walkerY).toBe(SETPOINT);
    expect(s.walkerY - s.cabinY).toBe(s.finalError);
    await expect(outcome).toBeVisible();
    await capture(page, `${lvl.id}-arrivee`);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(b) ${lvl.id} : échec sans sortie, issue affichée aussitôt`, async ({ page }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    await page.keyboard.press('e');
    await setGain(page, lvl.id, lvl.fail);
    await page.evaluate(() => window.__huygens?.commands.launch());
    let s = await advanceWhile(page, 'boarding');
    expect(s.phase).toBe('trip');
    s = await advanceWhile(page, 'trip');
    expect(s.phase).toBe('outcome');
    expect(s.outcome).toBe(lvl.failOutcome);
    expect(s.inCabin).toBe(true);
    expect(s.action).toBe('inCabin');
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(c) ${lvl.id} : passer l’embarquement et la sortie (touche Entrée, skipAnimation)`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    await page.keyboard.press('e');
    expect(await page.evaluate(() => window.__huygens?.commands.skipAnimation())).toBe('accepted');
    let s = await advance(page);
    expect(s.atPost).toBe(true);
    await setGain(page, lvl.id, lvl.win);
    await page.keyboard.press('Enter');
    s = await advance(page, 0.5);
    expect(s.phase).toBe('boarding');
    // Touche « passer » : le trajet part, bonhomme dans la cabine.
    await page.keyboard.press('Enter');
    s = await advance(page);
    expect(s.phase).toBe('trip');
    expect(s.k).toBe(0);
    expect(s.walkerX).toBe(CABIN_X);
    s = await advanceWhile(page, 'trip');
    expect(s.phase).toBe('exit');
    await expect(page.locator('#ui .ui-banner')).toContainText(FR('hud.hint.skip'));
    expect(await page.evaluate(() => window.__huygens?.commands.skipAnimation())).toBe('accepted');
    s = await advance(page);
    expect(s.phase).toBe('outcome');
    expect(s.walkerX).toBe(EXIT_END_X);
    expect(s.walkerY).toBe(SETPOINT);
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    // Recommencer : retour au poste ; la sortie suivante passée par la touche Entrée.
    await page.evaluate(() => window.__huygens?.commands.restart());
    s = await advance(page);
    expect(s.phase).toBe('tuning');
    expect(s.walkerX).toBe(POST_X);
    await page.evaluate(() => {
      window.__huygens?.commands.launch();
      window.__huygens?.commands.skipAnimation();
    });
    s = await advanceWhile(page, 'trip');
    expect(s.phase).toBe('exit');
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.keyboard.press('Enter');
    s = await advance(page);
    expect(s.phase).toBe('outcome');
    expect(s.action).toBe('arrived');
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(d) mode e2e sans anim=1 : animations désactivées ; setAnimations par le crochet', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1');
  let s = await advance(page);
  expect(s.animations).toBe(false);
  await page.keyboard.press('e');
  s = await advance(page);
  expect(s.phase).toBe('tuning');
  expect(s.atPost).toBe(true);
  await page.evaluate(() => window.__huygens?.commands.launch());
  s = await advance(page);
  expect(s.phase).toBe('trip');
  await page.evaluate(() => window.__huygens?.commands.restart());
  expect(await page.evaluate(() => window.__huygens?.commands.setAnimations(true))).toBe(
    'accepted',
  );
  await page.evaluate(() => window.__huygens?.commands.launch());
  s = await advance(page, 0.5);
  expect(s.phase).toBe('boarding');
  await page.evaluate(() => window.__huygens?.commands.setAnimations(false));
  s = await advance(page);
  expect(s.phase).toBe('trip');
  expect(s.animations).toBe(false);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
