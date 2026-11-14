/**
 * Niveau 2 « La mémoire » (T-021b) en navigateur réel, WebGL2 imposé : entrée par le menu, réglage
 * de Ki au clavier et à la souris, Kp fixé affiché, victoire à un Ki gagnant, choc contre la poutre
 * à un Ki fort, verrou pendant le trajet, retour au menu (pause et issue), crochet de test, niveau 1
 * inchangé, absence de recouvrement en 1280×720 et 390×844.
 *
 * Mesures du vrai niveau (boucle PI du noyau, sans anti-windup, tolérance 0,1 m, 10 s, T-022) sur
 * la grille de Ki : trop court de 0 à 100 N/(m·s), victoire de 200 à 800, choc contre la poutre de
 * 900 à 8000 ; le Ki par défaut (2000) heurte la poutre.
 *
 * Captures : cinq PNG dans docs/img/t021-*.png (menu à deux entrées, réglage, victoire, choc, réglage
 * en portrait) et docs/img/t022-niveau2-trop-court.png (Ki = 0, fin de temps) ; les autres,
 * seulement si la variable CAPTURE_DIR est définie.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
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
const NB = '\u00A0';

/** Ouvre la page, attend la première image ; `query` sans `?`. */
async function open(page: Page, query: string, width = 1280, height = 720): Promise<string[]> {
  await page.setViewportSize({ width, height });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

/** Attend deux images d'animation. */
async function settle(page: Page): Promise<void> {
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

/** Capture dans docs/img (`repo`) ou, sinon, dans CAPTURE_DIR s'il est défini. */
async function shot(page: Page, name: string, repo: boolean): Promise<void> {
  const dir = repo ? 'docs/img' : process.env['CAPTURE_DIR'];
  if (dir === undefined || dir === '') return;
  await settle(page);
  await page.screenshot({ path: `${dir}/${name}` });
}

type Step =
  | readonly ['advance' | 'setKp' | 'setKi' | 'adjustKi', number]
  | readonly ['moveRight' | 'stop' | 'interact' | 'launch' | 'restart' | 'pause' | 'resume'];

/** Résumé de l'instantané renvoyé par {@link run}. */
interface Summary {
  levelId: string;
  phase: string;
  kp: number;
  ki: number;
  iTerm: number;
  outcome: string | null;
  results: string[];
}

/** Exécute des étapes par le crochet, met l'interface à jour ; renvoie un résumé et les résultats. */
async function run(page: Page, steps: readonly Step[]): Promise<Summary> {
  return page.evaluate((list) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    const results: string[] = [];
    for (const step of list) {
      if (step[0] === 'advance') hook.advance(step[1]);
      else if (step[0] === 'setKp') results.push(hook.commands.setKp(step[1]));
      else if (step[0] === 'setKi') results.push(hook.commands.setKi(step[1]));
      else if (step[0] === 'adjustKi') results.push(hook.commands.adjustKi(step[1]));
      else results.push(hook.commands[step[0]]());
    }
    hook.advance(0);
    const s = hook.snapshot();
    return {
      levelId: s.levelId,
      phase: s.phase,
      kp: s.kp,
      ki: s.ki,
      iTerm: s.iTerm,
      outcome: s.outcome,
      results,
    };
  }, steps);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop'], ['interact']];

/** Rectangle d'un élément visible (ou échec). */
async function boxOf(node: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const b = await node.boundingBox();
  if (b === null) throw new Error('élément sans boîte');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** Vrai si deux boîtes se coupent. */
function hit(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Aucun recouvrement entre l'étiquette Kp/Ki et les boutons du haut, entre le panneau de réglage
 * et le bandeau d'aide, et tout reste dans l'écran.
 */
async function checkNoOverlap(page: Page, width: number, height: number): Promise<void> {
  const tag = await boxOf(page.locator('#ui .ui-kp-tag'));
  const tools = await boxOf(page.locator('#ui .ui-tools'));
  const title = await boxOf(page.locator('#ui .ui-title'));
  expect(hit(tag, tools), 'étiquette Kp/Ki et boutons du haut').toBe(false);
  expect(hit(title, tools), 'titre et boutons du haut').toBe(false);
  expect(tag.x + tag.w, 'étiquette dans l’écran').toBeLessThanOrEqual(width);
  const panel = page.locator('#ui .ui-panel');
  if (await panel.isVisible()) {
    const p = await boxOf(panel);
    const banner = await boxOf(page.locator('#ui .ui-banner'));
    expect(hit(p, banner), 'panneau et bandeau').toBe(false);
    expect(hit(p, tag), 'panneau et étiquette').toBe(false);
    expect(p.y + p.h, 'panneau dans l’écran').toBeLessThanOrEqual(height);
    expect(p.x + p.w, 'panneau dans l’écran').toBeLessThanOrEqual(width);
  }
  const bubble = page.locator('#ui .ui-bubble');
  if (await bubble.isVisible()) {
    const b = await boxOf(bubble);
    expect(hit(b, tag), 'bulle et étiquette').toBe(false);
    expect(hit(b, tools), 'bulle et boutons').toBe(false);
  }
}

for (const lang of ['fr', 'en'] as const) {
  const t = T[lang];
  const repo = lang === 'fr';
  const level2Button = (page: Page): Locator =>
    page.getByRole('button', { name: t('level2.title'), exact: true });
  const slider = (page: Page): Locator => page.getByRole('slider', { name: t('level2.ki.label') });

  test(`(a) ${lang} : menu à deux entrées, niveau 2 au clavier, victoire à Ki = 800`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=menu&lang=${lang}`);
    await expect(page.getByRole('button', { name: t('level1.title'), exact: true })).toBeVisible();
    await expect(level2Button(page)).toBeVisible();
    await expect(level2Button(page)).toBeEnabled();
    await shot(page, 't021-menu.png', repo);
    // Entrée par le clavier : flèche bas, puis Entrée.
    await page.keyboard.press('ArrowDown');
    await expect(level2Button(page)).toBeFocused();
    await page.keyboard.press('Enter');
    const banner = page.locator('#ui .ui-banner');
    await expect(banner).toBeVisible();
    expect((await run(page, [])).levelId).toBe('level2');

    // Étiquette permanente (Kp reste, Ki s'y ajoute), bulle d'ouverture, titre du canvas.
    await expect(page.locator('#ui .ui-kp-tag')).toHaveText(`Kp = 2500 · Ki = 2000`);
    await expect(page.locator('#ui .ui-bubble')).toHaveText(t('level2.goal'));

    await run(page, TO_CONSOLE);
    await expect(slider(page)).toBeFocused();
    await expect(page.locator('#ui .ui-fixed')).toHaveText(
      t('level2.kp.fixed').replace('{kp}', '2500'),
    );
    await expect(page.locator('#ui .ui-kp-value')).toHaveText(`2000${NB}N/(m·s)`);
    await expect(page.locator('#ui .ui-panel')).toContainText(t('level2.ki.help'));
    await expect(page.locator('#ui .ui-panel')).toContainText(t('level2.ki.range'));
    await expect(banner).toContainText(lang === 'fr' ? 'régler Ki' : 'set Ki');

    // Clavier, depuis le défaut 2000 : Page suiv. (− 1000), puis − trois fois et + une fois = 800
    // (bornes du curseur et du champ : [0 ; 8000], pas de 100).
    await expect(slider(page)).toHaveAttribute('min', '0');
    await expect(slider(page)).toHaveAttribute('max', '8000');
    await expect(slider(page)).toHaveAttribute('step', '100');
    await page.keyboard.press('PageDown');
    await expect(slider(page)).toHaveValue('1000');
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('-');
    await page.keyboard.press('+');
    await expect(page.locator('#ui .ui-kp-value')).toHaveText(`800${NB}N/(m·s)`);
    await expect(slider(page)).toHaveValue('800');
    await expect(page.locator('#ui .ui-kp-tag')).toHaveText('Kp = 2500 · Ki = 800');
    await page.keyboard.press('PageDown');
    await expect(slider(page)).toHaveValue('0');
    await page.keyboard.press('PageUp');
    await expect(slider(page)).toHaveValue('1000');
    for (let i = 0; i < 2; i += 1) await page.keyboard.press('-');
    await expect(slider(page)).toHaveValue('800');
    await shot(page, 't021-niveau2-reglage.png', repo);
    await checkNoOverlap(page, 1280, 720);

    await page.keyboard.press('Enter');
    await expect(slider(page)).toBeDisabled();
    await expect(page.getByText(t('level2.ki.locked'))).toBeVisible();
    await expect(banner).toContainText(lang === 'fr' ? 'Ki est verrouillé' : 'Ki is locked');
    // Kp reste affiché comme fixé pendant le trajet.
    await expect(page.locator('#ui .ui-fixed')).toBeVisible();
    await expect(page.locator('#ui .ui-readout')).toBeVisible();

    // Le crochet de test fait avancer le temps : 0,3 s (moteur à fond), puis jusqu'à l'issue.
    await run(page, [['advance', 0.3]]);
    const live = page.locator('[aria-live="polite"]');
    await expect(live).toContainText(t('level2.saturation'));
    await run(page, [['advance', 6]]);
    const outcome = page.locator('#ui .ui-outcome');
    await expect(outcome).toBeVisible();
    await expect(outcome).toContainText(t('level2.winTitle'));
    await expect(outcome).toContainText(t('level2.win'));
    // Ni teaser ni « bientôt » au niveau 2 ; la cote chiffrée de l'erreur finale reste.
    await expect(outcome.getByText(t('level1.teaser'), { exact: true })).toBeHidden();
    await expect(outcome.getByText(t('level1.comingSoon'), { exact: true })).toBeHidden();
    await expect(page.locator('#ui .ui-dimension')).toBeVisible();
    await expect(live).toContainText(
      lang === 'fr'
        ? `Réussi\u202F! La cabine s’est stabilisée à 0,00${NB}m du plateau d’arrivée.`
        : `Success! The lift settled 0.00${NB}m from the ledge.`,
    );
    expect((await run(page, [])).outcome).toBe('win');
    await shot(page, 't021-niveau2-victoire.png', repo);
    await checkNoOverlap(page, 1280, 720);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(b) ${lang} : réglage à la souris (curseur, champ, − et +), choc à Ki = 2500`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=menu&lang=${lang}`);
    await level2Button(page).click();
    await expect(page.locator('#ui .ui-banner')).toBeVisible();
    await run(page, TO_CONSOLE);

    await slider(page).fill('1500');
    await expect(page.locator('#ui .ui-kp-value')).toHaveText(`1500${NB}N/(m·s)`);
    expect((await run(page, [])).ki).toBe(1500);
    const field = page.getByRole('spinbutton', { name: t('level2.ki.field') });
    await field.fill('2400');
    await field.press('Enter');
    await expect(page.locator('#ui .ui-kp-value')).toHaveText(`2400${NB}N/(m·s)`);
    await page.getByRole('button', { name: t('controls.kiIncrease') }).click();
    await expect(slider(page)).toHaveValue('2500');
    await page.getByRole('button', { name: t('controls.kiDecrease') }).click();
    await page.getByRole('button', { name: t('controls.kiIncrease') }).click();
    await expect(slider(page)).toHaveValue('2500');
    // Valeur hors bornes dans le champ : ramenée à la borne.
    await field.fill('99999');
    await field.press('Enter');
    await expect(slider(page)).toHaveValue('8000');
    await field.fill('2500');
    await field.press('Enter');
    await expect(slider(page)).toHaveValue('2500');
    expect((await run(page, [])).kp).toBe(2500);

    await page.getByRole('button', { name: t('controls.launch'), exact: true }).click();
    await run(page, [['advance', 6]]);
    const outcome = page.locator('#ui .ui-outcome');
    await expect(outcome).toContainText(t('level2.fail.bonk'));
    await expect(outcome).toContainText(t('level2.failTitle.bonk'));
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      lang === 'fr' ? 'heurté la poutre' : 'hit the beam',
    );
    await expect(page.locator('#ui .ui-dimension')).toBeHidden();
    const s = await run(page, []);
    expect(s.outcome).toBe('bonk');
    expect(s.iTerm).toBeGreaterThan(490.5);
    await shot(page, 't021-niveau2-choc.png', repo);
    await checkNoOverlap(page, 1280, 720);

    // Recommencer : le réglage est conservé, rendu au joueur.
    await outcome.getByRole('button', { name: t('controls.restart') }).click();
    await expect(slider(page)).toBeEnabled();
    await expect(slider(page)).toHaveValue('2500');
    await expect(page.locator('[aria-live="polite"]')).toContainText(t('hud.status.resetKi'));
    expect((await run(page, [])).iTerm).toBe(0);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(c) ${lang} : Ki verrouillé pendant le trajet (clavier, souris, crochet), retour au menu`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=level2&lang=${lang}`);
    await run(page, [...TO_CONSOLE, ['setKi', 300], ['launch'], ['advance', 0.4]]);
    const s = await run(page, []);
    expect(s.phase).toBe('trip');
    expect(s.iTerm).toBeGreaterThan(0);
    await page.keyboard.press('+');
    await page.keyboard.press('PageUp');
    expect((await run(page, [])).ki).toBe(300);
    await expect(slider(page)).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: t('level2.ki.field') })).toBeDisabled();
    await expect(page.getByRole('button', { name: t('controls.kiIncrease') })).toBeDisabled();
    await expect(page.getByRole('button', { name: t('controls.kiDecrease') })).toBeDisabled();
    const locked = await run(page, [
      ['setKi', 900],
      ['adjustKi', 100],
    ]);
    expect(locked.results).toEqual(['locked', 'locked']);
    expect(locked.ki).toBe(300);
    // Kp est fixé : la commande de Kp est sans objet au niveau 2.
    expect((await run(page, [['setKp', 100]])).results).toEqual(['ignored']);
    expect((await run(page, [])).kp).toBe(2500);

    // Pause puis « Menu » : retour au menu, focus sur le niveau 2 qu'on vient de quitter.
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('paused');
    await page
      .getByRole('button', { name: t('controls.menu'), exact: true })
      .first()
      .click();
    await expect(page.getByRole('main', { name: t('menu.title') })).toBeVisible();
    await expect(page.locator('#ui')).toHaveCount(0);
    await expect(level2Button(page)).toBeFocused();

    // Depuis l'issue : « Menu » aussi.
    await level2Button(page).click();
    await run(page, [...TO_CONSOLE, ['setKi', 800], ['launch'], ['advance', 6]]);
    const done = await run(page, []);
    expect(done.phase).toBe('outcome');
    expect(done.outcome).toBe('win');
    await page.locator('#ui .ui-outcome .ui-menu').click();
    await expect(page.getByRole('main', { name: t('menu.title') })).toBeVisible();
    // Un niveau neuf à chaque entrée : Ki repart du défaut, phase d'approche.
    await level2Button(page).click();
    const fresh = await run(page, []);
    expect(fresh.phase).toBe('approach');
    expect(fresh.ki).toBe(2000);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(d) ${lang} : niveau 1 inchangé derrière le menu à deux entrées`, async ({ page }) => {
    const problems = await open(page, `e2e=1&screen=menu&lang=${lang}`);
    await page.getByRole('button', { name: t('level1.title'), exact: true }).click();
    await expect(page.locator('#ui .ui-banner')).toBeVisible();
    await expect(page.locator('#ui .ui-kp-tag')).toHaveText(`Kp = 2000${NB}N/m`);
    await expect(page.locator('#ui .ui-bubble')).toHaveText(t('level1.goal'));
    await run(page, TO_CONSOLE);
    await expect(page.getByRole('slider', { name: t('level1.kp.label') })).toBeFocused();
    await expect(page.locator('#ui .ui-fixed')).toBeHidden();
    await expect(page.locator('#ui .ui-kp-value')).toHaveText(`2000${NB}N/m`);
    const s = await run(page, [['setKp', 2500], ['setKi', 100], ['launch'], ['advance', 4]]);
    expect(s.levelId).toBe('level1');
    expect(s.results.slice(0, 2)).toEqual(['accepted', 'ignored']);
    expect(s.ki).toBe(0);
    expect(s.iTerm).toBe(0);
    expect(s.outcome).toBe('win');
    const outcome = page.locator('#ui .ui-outcome');
    await expect(outcome).toContainText(t('level1.win'));
    await expect(outcome).toContainText(t('level1.teaser'));
    // La phrase de fin renvoie au niveau 2 du menu.
    await expect(outcome).toContainText(t('level1.comingSoon'));
    expect(t('level1.comingSoon')).toContain(lang === 'fr' ? 'niveau 2' : 'Level 2');
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(e) crochet de test : issues du vrai niveau 2 par le crochet (Ki = 0 à 5000, défaut 2000)', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=fr');
  const outcomes: Record<number, string | null> = {};
  await run(page, TO_CONSOLE);
  // Le défaut (2000), lancé sans réglage, heurte la poutre.
  expect((await run(page, [])).ki).toBe(2000);
  for (const ki of [2000, 0, 100, 200, 800, 900, 5000]) {
    await run(page, [['setKi', ki], ['launch'], ['advance', 10.5]]);
    const s = await run(page, []);
    outcomes[ki] = s.outcome;
    expect(s.phase).toBe('outcome');
    await run(page, [['restart']]);
  }
  expect(outcomes).toEqual({
    0: 'step',
    100: 'step',
    200: 'win',
    800: 'win',
    900: 'bonk',
    2000: 'bonk',
    5000: 'bonk',
  });
  // Le crochet accepte adjustKi comme setKi, et refuse hors réglage.
  const adjusted = await run(page, [
    ['setKi', 200],
    ['adjustKi', 100],
    ['adjustKi', -1000],
  ]);
  expect(adjusted.results).toEqual(['accepted', 'accepted', 'accepted']);
  expect(adjusted.ki).toBe(0);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f) portrait 390×844 : réglage du niveau 2, étiquette Kp et Ki sans recouvrement', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=fr', 390, 844);
  await run(page, [...TO_CONSOLE, ['setKi', 800]]);
  await settle(page);
  await expect(page.locator('#ui .ui-kp-tag')).toHaveText('Kp = 2500 · Ki = 800');
  await expect(page.locator('#ui .ui-fixed')).toBeVisible();
  await checkNoOverlap(page, 390, 844);
  await shot(page, 't021-niveau2-portrait.png', true);
  // Pendant le trajet et à l'issue aussi.
  await run(page, [['launch'], ['advance', 1]]);
  await settle(page);
  await checkNoOverlap(page, 390, 844);
  await run(page, [['advance', 5]]);
  await settle(page);
  await checkNoOverlap(page, 390, 844);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(g) 1280×720 : aucun recouvrement du réglage, du trajet et de l’issue au niveau 2', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=en', 1280, 720);
  await checkNoOverlap(page, 1280, 720);
  await run(page, [...TO_CONSOLE, ['setKi', 500]]);
  await checkNoOverlap(page, 1280, 720);
  await run(page, [['launch'], ['advance', 1]]);
  await checkNoOverlap(page, 1280, 720);
  await run(page, [['advance', 4]]);
  await checkNoOverlap(page, 1280, 720);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(h) T-022 : Ki = 0, le P seul reste trop court au bout de 10 s (tolérance 0,1 m), capture', async ({
  page,
}) => {
  const t = T.fr;
  const problems = await open(page, 'e2e=1&screen=level2&lang=fr', 1280, 720);
  await run(page, [...TO_CONSOLE, ['setKi', 0], ['launch'], ['advance', 9.9]]);
  // À 9,9 s, le trajet n'est pas fini ; il l'est à 10 s pile (1200 pas).
  expect((await run(page, [])).phase).toBe('trip');
  await run(page, [['advance', 0.2]]);
  const s = await run(page, []);
  expect(s.phase).toBe('outcome');
  expect(s.outcome).toBe('step');
  const k = await page.evaluate(() => window.__huygens?.snapshot().outcomeK);
  expect(k).toBe(1200);
  const outcome = page.locator('#ui .ui-outcome');
  await expect(outcome).toContainText(t('level2.failTitle.step'));
  await expect(outcome).toContainText(t('level2.fail.step').replace('{e}', '0,20'));
  await expect(page.locator('[aria-live="polite"]')).toContainText(
    t('hud.status.fail.stepKi').replace('{e}', '0,20'),
  );
  await expect(page.locator('[aria-live="polite"]')).not.toContainText(`0,5${NB}m`);
  // La courbe va au bout des 10 s sans sortir du plancher : 1200 échantillons et la pointe.
  const trace = await page.evaluate(() => window.__huygens?.trace() ?? []);
  expect(trace.length / 2).toBe(1201);
  await shot(page, 't022-niveau2-trop-court.png', true);
  await checkNoOverlap(page, 1280, 720);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
