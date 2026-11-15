/**
 * Bouton « Niveau suivant » (T-036, D33) en navigateur réel, WebGL2 imposé : présent et focalisé à
 * la réussite du niveau 1, absent à la réussite du niveau 2 et aux échecs, mène à un niveau 2 neuf
 * (état initial, Ki par défaut, approche), garde du double clic (A-01), ordre de tabulation.
 *
 * Captures : seulement si la variable CAPTURE_DIR est définie (aucune dans docs/img).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

type Lang = 'fr' | 'en';

/** Textes lus dans les locales (le chargeur ESM de Playwright refuse l'import JSON de src/i18n). */
function catalog(lang: Lang): (key: string) => string {
  const data = JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string | undefined>;
  return (key: string): string => {
    const value = data[key];
    if (value === undefined) throw new Error(`clé absente : ${key}`);
    return value;
  };
}
const T: Record<Lang, (key: string) => string> = { fr: catalog('fr'), en: catalog('en') };

async function open(page: Page, query: string, width = 1280, height = 720): Promise<string[]> {
  await page.setViewportSize({ width, height });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

interface Summary {
  levelId: string;
  phase: string;
  kp: number;
  ki: number;
  iTerm: number;
  walkerX: number;
  outcome: string | null;
}

/** Résumé de l'instantané courant. */
async function state(page: Page): Promise<Summary> {
  return page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    hook.advance(0);
    const s = hook.snapshot();
    return {
      levelId: s.levelId,
      phase: s.phase,
      kp: s.kp,
      ki: s.ki,
      iTerm: s.iTerm,
      walkerX: s.walkerX,
      outcome: s.outcome,
    };
  });
}

/** Amène le niveau courant à l'issue (réussite ou choc) par le crochet de test. */
async function finish(page: Page, issue: 'win' | 'bonk'): Promise<Summary> {
  await page.evaluate((win) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    const level2 = hook.snapshot().levelId === 'level2';
    hook.commands.moveRight();
    hook.advance(2.6);
    hook.commands.stop();
    hook.commands.interact();
    if (level2) hook.commands.setKi(win ? 800 : 2500);
    else hook.commands.setKp(win ? 2500 : 7000);
    hook.commands.launch();
    hook.advance(12);
  }, issue === 'win');
  return state(page);
}

const FR = T.fr;

for (const lang of ['fr', 'en'] as const) {
  const tx = T[lang];

  test(`(a) ${lang} : réussite du niveau 1, « Niveau suivant » focalisé ; Entrée mène à un niveau 2 neuf`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=level1&lang=${lang}`);
    expect((await finish(page, 'win')).outcome).toBe('win');
    const next = page.locator('#ui .ui-outcome button.ui-next');
    await expect(next).toBeVisible();
    await expect(next).toHaveText(tx('controls.nextLevel'));
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#ui .ui-outcome')).toBeHidden();
    const s = await state(page);
    expect(s.levelId).toBe('level2');
    expect(s.phase).toBe('approach');
    expect(s.ki).toBe(2000);
    expect(s.iTerm).toBe(0);
    expect(s.outcome).toBeNull();
    expect(s.walkerX).toBeLessThan(1);
    expect(await page.evaluate(() => window.__huygens?.app.state())).toEqual({
      screen: 'level',
      levelId: 'level2',
    });
    await expect(page.locator('#ui .ui-outcome button.ui-next')).toHaveCount(0);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(b) ${lang} : réussite du niveau 2 et échecs : pas de « Niveau suivant » visible`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=level2&lang=${lang}`);
    expect((await finish(page, 'win')).outcome).toBe('win');
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    await expect(page.locator('#ui button.ui-next')).toHaveCount(0);
    await expect(page.getByRole('button', { name: tx('controls.nextLevel') })).toHaveCount(0);
    await expect(page.locator('#ui .ui-outcome button.ui-primary')).toBeFocused();

    // Choc au niveau 2, dans un niveau neuf.
    await page.evaluate(() => {
      window.__huygens?.app.leaveLevel();
      window.__huygens?.app.openLevel('level2');
    });
    expect((await finish(page, 'bonk')).outcome).toBe('bonk');
    await expect(page.locator('#ui button.ui-next')).toHaveCount(0);

    // Échec au niveau 1 : le bouton est masqué, donc hors de l'ordre de tabulation.
    await page.evaluate(() => {
      window.__huygens?.app.leaveLevel();
      window.__huygens?.app.openLevel('level1');
    });
    expect((await finish(page, 'bonk')).outcome).toBe('bonk');
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    await expect(page.getByRole('button', { name: tx('controls.nextLevel') })).toHaveCount(0);
    await expect(page.locator('#ui .ui-outcome button.ui-primary:not(.ui-next)')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#ui .ui-outcome button.ui-menu')).toBeFocused();
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(c) garde A-01 : le deuxième clic d’un double clic est ignoré, le niveau 2 reste en place', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await finish(page, 'win');
  const next = page.locator('#ui .ui-outcome button.ui-next');
  await expect(next).toBeVisible();
  // Clic de détail 2 (deuxième clic d'un double clic) : ignoré, on reste au niveau 1.
  await page.evaluate(() => {
    const button = document.querySelector('#ui .ui-outcome button.ui-next');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
  });
  expect((await state(page)).levelId).toBe('level1');
  // Double clic réel : un seul passage, le niveau 2 reste en place, à l'approche.
  await next.dblclick();
  await expect(page.locator('#ui .ui-outcome')).toBeHidden();
  const s = await state(page);
  expect(s.levelId).toBe('level2');
  expect(s.phase).toBe('approach');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(d) Entrée maintenue sur « Niveau suivant » : un seul passage', async ({ page }) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await finish(page, 'win');
  await expect(page.locator('#ui .ui-outcome button.ui-next')).toBeFocused();
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  const s = await state(page);
  expect(s.levelId).toBe('level2');
  expect(s.phase).toBe('approach');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(e) clavier : Tab mène de « Niveau suivant » à « Rejouer » puis « Menu » ; Espace active', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await finish(page, 'win');
  const outcome = page.locator('#ui .ui-outcome');
  await expect(outcome.locator('button.ui-next')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    outcome.getByRole('button', { name: FR('level1.replay'), exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    outcome.getByRole('button', { name: FR('controls.menu'), exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(outcome.locator('button.ui-next')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(outcome).toBeHidden();
  expect((await state(page)).levelId).toBe('level2');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f) souris : clic sur « Niveau suivant », puis « Menu » mène au menu', async ({ page }) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await finish(page, 'win');
  await page.locator('#ui .ui-outcome button.ui-next').click();
  expect((await state(page)).levelId).toBe('level2');
  await page.evaluate(() => {
    window.__huygens?.app.leaveLevel();
  });
  await expect(page.getByRole('main', { name: FR('menu.title') })).toBeVisible();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const [width, height] of [
  [1280, 720],
  [844, 390],
  [390, 844],
] as const) {
  test(`(g) victoire du niveau 1 à ${String(width)}×${String(height)} (capture si CAPTURE_DIR)`, async ({
    page,
  }) => {
    const problems = await open(page, 'e2e=1&screen=level1&lang=fr', width, height);
    await finish(page, 'win');
    await expect(page.locator('#ui .ui-outcome button.ui-next')).toBeFocused();
    const dir = process.env['CAPTURE_DIR'];
    if (dir !== undefined && dir !== '') {
      await page.screenshot({ path: `${dir}/t036-win-${String(width)}x${String(height)}.png` });
    }
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}
