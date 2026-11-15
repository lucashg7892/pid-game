/**
 * Défauts mineurs de la chasse aux bugs v0.2 (T-029), en navigateur réel, WebGL2 imposé :
 * A-05 (focus du menu), A-09 (écrans très bas), B-03 (Échap dans le champ numérique),
 * B-04 (bouton d'issue en pause).
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
const FR = catalog('fr');

/** Ouvre la page, attend la première image ; `query` sans `?`. */
async function open(page: Page, query: string, width = 1280, height = 720): Promise<string[]> {
  await page.setViewportSize({ width, height });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

type Step =
  | readonly ['advance' | 'setKp' | 'setKi', number]
  | readonly ['moveRight' | 'stop' | 'interact' | 'launch' | 'pause'];

interface Summary {
  phase: string;
  kp: number;
  ki: number;
}

/** Exécute des étapes par le crochet, met l'interface à jour ; renvoie phase, Kp et Ki. */
async function run(page: Page, steps: readonly Step[]): Promise<Summary> {
  return page.evaluate((list) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    for (const step of list) {
      if (step[0] === 'advance') hook.advance(step[1]);
      else if (step[0] === 'setKp') hook.commands.setKp(step[1]);
      else if (step[0] === 'setKi') hook.commands.setKi(step[1]);
      else hook.commands[step[0]]();
    }
    hook.advance(0);
    const s = hook.snapshot();
    return { phase: s.phase, kp: s.kp, ki: s.ki };
  }, steps);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop'], ['interact']];

test('A-05 : du titre, le menu met le focus sur « Niveau 1 », pas sur le dernier niveau joué', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=fr');
  await run(page, [['pause']]);
  await page.locator('#ui .ui-tools .ui-menu').click();
  // Du niveau au menu : le focus revient sur le niveau quitté (comportement conservé).
  await expect(page.getByRole('button', { name: FR('level2.title'), exact: true })).toBeFocused();
  await page.getByRole('button', { name: FR('menu.back'), exact: true }).click();
  await page.getByRole('button', { name: FR('title.play'), exact: true }).click();
  await expect(page.getByRole('main', { name: FR('menu.title') })).toBeVisible();
  await expect(page.getByRole('button', { name: FR('level1.title'), exact: true })).toBeFocused();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const screen of ['title', 'menu'] as const) {
  test(`A-09 : 800×200, écran ${screen}, le haut de la carte est atteignable`, async ({ page }) => {
    const problems = await open(page, `e2e=1&screen=${screen}&lang=fr`, 800, 200);
    const top = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('#screens .ui-screen');
      const card = document.querySelector<HTMLElement>('#screens .ui-screen-card');
      if (root === null || card === null) throw new Error('écran absent');
      root.scrollTop = 0;
      return card.getBoundingClientRect().top;
    });
    expect(top).toBeGreaterThanOrEqual(0);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

for (const level of [1, 2] as const) {
  test(`B-03 : niveau ${String(level)}, Échap dans le champ annule la saisie`, async ({ page }) => {
    const problems = await open(page, `e2e=1&screen=level${String(level)}&lang=fr`);
    const key = level === 1 ? 'kp' : 'ki';
    const field = page.getByRole('spinbutton', {
      name: FR(level === 1 ? 'level1.kp.field' : 'level2.ki.field'),
    });
    const before = await run(page, TO_CONSOLE);
    expect(before.phase).toBe('tuning');
    await field.fill('6000');
    await field.press('Escape');
    const after = await run(page, []);
    expect(after.phase).toBe('approach');
    expect(after[key]).toBe(before[key]);
    // À la réouverture, le champ affiche la valeur courante.
    await run(page, [['interact']]);
    await expect(field).toHaveValue(String(before[key]));
    expect((await run(page, []))[key]).toBe(before[key]);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('B-04 : à l’issue, la pause désactive « Rejouer le niveau » ; la reprise le réactive', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  const win = await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 4]]);
  expect(win.phase).toBe('outcome');
  const replay = page.locator('#ui .ui-outcome button.ui-primary');
  const pause = page.locator('#ui .ui-pause');
  await expect(replay).toBeFocused();
  await expect(replay).toBeEnabled();
  // Pause au clavier : le focus ne reste pas sur un bouton désactivé.
  await page.keyboard.press('Escape');
  expect((await run(page, [])).phase).toBe('paused');
  await expect(replay).toBeDisabled();
  await expect(pause).toBeFocused();
  await pause.click();
  await expect(replay).toBeEnabled();
  // Pause à la souris, puis reprise.
  await pause.click();
  await expect(replay).toBeDisabled();
  await pause.click();
  await expect(replay).toBeEnabled();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
