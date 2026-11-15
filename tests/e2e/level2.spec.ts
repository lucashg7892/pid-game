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
 * en portrait), docs/img/t022-niveau2-trop-court.png (Ki = 0, fin de temps) et, pour la jauge du
 * terme intégral (T-024), docs/img/t024-niveau2-jauge-i.png et t024-niveau2-jauge-i-portrait.png ;
 * les autres, seulement si la variable CAPTURE_DIR est définie.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CONSOLE_X, VOID_MAX_X, VOID_MIN_X } from '../../src/game';
import { PLAY_ZONE, computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { forceToGaugeY } from '../../src/render/gauge';
import { CONSOLE_ANCHOR_Y } from '../../src/render/level-display';
import {
  GAUGE_I_MAX_X,
  GAUGE_I_MIN_X,
  GAUGE_MAX_Y,
  GAUGE_MIN_Y,
} from '../../src/render/pencil-style';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';
import { decodePng, luma, pixelAt, type DecodedPng } from './png';

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

/** Chiffres d'un texte (« I : 1 234 N » → 1234), signe moins compris. */
function digitsOf(text: string): number {
  return Number(text.replace(/[^0-9\-−]/g, '').replace('−', '-'));
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Jauge du terme intégral : ses étiquettes (« Terme intégral I » puis « I : … N ») ne coupent ni
 * les étiquettes de la jauge de force (légende, « Force : … N », « max », « poids »), ni les
 * panneaux, ni la cage, ni la console ; tout reste dans l'écran.
 */
async function checkIGaugeLabels(page: Page, width: number, height: number): Promise<string[]> {
  const frame = computeFrame(width, height);
  const x = (v: number): number => worldXToPixel(frame, width, v);
  const y = (v: number): number => worldYToPixel(frame, height, v);
  const cage: Box = {
    x: x(VOID_MIN_X),
    y: y(PLAY_ZONE.maxY),
    w: x(VOID_MAX_X) - x(VOID_MIN_X),
    h: y(PLAY_ZONE.minY) - y(PLAY_ZONE.maxY),
  };
  const console_: Box = {
    x: x(CONSOLE_X - 0.35),
    y: y(CONSOLE_ANCHOR_Y + 0.35),
    w: 0.7 * frame.pixelsPerMeter,
    h: y(0) - y(CONSOLE_ANCHOR_Y + 0.35),
  };
  const labels: [string, Box][] = [];
  for (const selector of ['.ui-igauge-title', '.ui-force', '.ui-gauge-title', '.ui-gauge-tag']) {
    const nodes = await page.locator(`#ui ${selector}`).all();
    for (const node of nodes) {
      if (await node.isVisible())
        labels.push([`${selector} « ${(await node.textContent()) ?? ''} »`, await boxOf(node)]);
    }
  }
  const panels: [string, Box][] = [
    ['cage', cage],
    ['console', console_],
  ];
  for (const selector of [
    '.ui-readout',
    '.ui-bubble',
    '.ui-panel',
    '.ui-outcome',
    '.ui-dimension',
    '.ui-kp-tag',
    '.ui-tools',
  ]) {
    const node = page.locator(`#ui ${selector}`);
    if (await node.isVisible()) panels.push([selector, await boxOf(node)]);
  }
  const report: string[] = [];
  for (const [i, [name, b]] of labels.entries()) {
    report.push(
      `${name} [${b.x.toFixed(0)}, ${b.y.toFixed(0)}, ${(b.x + b.w).toFixed(0)}, ${(b.y + b.h).toFixed(0)}]`,
    );
    expect(b.x, `${name} dans l’écran`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, `${name} dans l’écran`).toBeLessThanOrEqual(width);
    expect(b.y, `${name} dans l’écran`).toBeGreaterThanOrEqual(0);
    for (const [other, o] of labels.slice(i + 1))
      expect(hit(b, o), `${name} / ${other}`).toBe(false);
    for (const [other, o] of panels) expect(hit(b, o), `${name} / ${other}`).toBe(false);
  }
  return report;
}

/** Pixels de graphite (sombres, sans la teinte bleu-vert de la grille) dans un rectangle monde. */
function inkIn(image: DecodedPng, minX: number, minY: number, maxX: number, maxY: number): number {
  const frame = computeFrame(image.width, image.height);
  let count = 0;
  for (
    let py = Math.ceil(worldYToPixel(frame, image.height, maxY));
    py <= worldYToPixel(frame, image.height, minY);
    py += 1
  ) {
    for (
      let px = Math.ceil(worldXToPixel(frame, image.width, minX));
      px <= worldXToPixel(frame, image.width, maxX);
      px += 1
    ) {
      const c = pixelAt(image, px, py);
      if (luma(c) < 170 && c.g - c.r < 25) count += 1;
    }
  }
  return count;
}

/** Capture décodée avec l'interface masquée (mesure du seul rendu), puis interface rétablie. */
async function inkSnapshot(page: Page): Promise<DecodedPng> {
  const hidden = await page.addStyleTag({
    content: '#ui, #screens { visibility: hidden !important; }',
  });
  await settle(page);
  const image = decodePng(await page.screenshot());
  await hidden.evaluate((node) => {
    node.parentNode?.removeChild(node);
  });
  return image;
}

/** Intérieur de la jauge I (hors cadre), de 0 N jusqu'à `top` (m). */
function insideI(image: DecodedPng, top: number): number {
  return inkIn(image, GAUGE_I_MIN_X + 0.03, GAUGE_MIN_Y + 0.03, GAUGE_I_MAX_X - 0.03, top);
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
    // Le niveau 2 est le dernier : pas de bouton « Niveau suivant » (ni dans le DOM).
    await expect(outcome.locator('button.ui-next')).toHaveCount(0);
    await expect(outcome.getByRole('button', { name: t('controls.nextLevel') })).toHaveCount(0);
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

  test(`(i) ${lang} : jauge du terme intégral I (étiquettes, valeur, remplissage hachuré, sans recouvrement)`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=level2&lang=${lang}`);
    const title = page.locator('#ui .ui-igauge-title:not(.ui-igauge-value)');
    const value = page.locator('#ui .ui-igauge-value');
    const sr = page.locator('#ui .ui-readout .ui-sr');
    // Approche et réglage : légende de la jauge, pas encore de valeur.
    await expect(title).toBeVisible();
    await expect(title).toHaveText(t('hud.igauge.title'));
    await expect(value).toBeHidden();
    await checkIGaugeLabels(page, 1280, 720);
    await run(page, [...TO_CONSOLE, ['setKi', 800]]);
    await expect(title).toBeVisible();
    await checkIGaugeLabels(page, 1280, 720);
    // Vide avant le lancement : seul le repère m·g pointillé traverse l'intérieur du cadre.
    const before = await inkSnapshot(page);
    const emptyInk = insideI(before, GAUGE_MAX_Y - 0.03);
    const frameInk = inkIn(
      before,
      GAUGE_I_MIN_X - 0.2,
      GAUGE_MIN_Y - 0.03,
      GAUGE_I_MAX_X + 0.2,
      GAUGE_MAX_Y + 0.03,
    );
    expect(frameInk, 'cadre et graduations de la jauge I').toBeGreaterThan(150);
    expect(emptyInk, 'intérieur vide avant le lancement').toBeLessThan(frameInk / 3);

    // Trajet : à 0,15 s le moteur est encore saturé (5000 N, jauge de force rouge) et I déjà chargé
    // (capture) ; à 0,3 s la saturation est finie (mesuré : jusqu'à 0,2 s) et I vaut environ 530 N.
    await run(page, [['launch'], ['advance', 0.15]]);
    const early = await run(page, []);
    expect(early.iTerm).toBeGreaterThan(200);
    expect(await page.evaluate(() => window.__huygens?.snapshot().saturated)).toBe(true);
    await expect(page.locator('#ui .ui-force')).toHaveClass(/is-saturated/);
    await shot(page, 't024-niveau2-jauge-i.png', lang === 'fr');
    await run(page, [['advance', 0.15]]);
    const mid = await run(page, []);
    expect(mid.phase).toBe('trip');
    expect(mid.iTerm).toBeGreaterThan(100);
    await expect(title).toBeHidden();
    await expect(value).toBeVisible();
    expect(Math.abs(digitsOf((await value.textContent()) ?? '') - mid.iTerm)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(digitsOf((await sr.textContent()) ?? '') - mid.iTerm)).toBeLessThanOrEqual(1);
    expect((await sr.textContent()) ?? '').toContain(t('hud.readout.iTerm').split('{i}')[0] ?? '');
    await expect(page.locator('#ui .ui-force')).toHaveText(/\d/);
    await expect(page.locator('#ui .ui-legend-integral')).toContainText(
      t('level2.legend.integral'),
    );
    await checkIGaugeLabels(page, 1280, 720);

    const level = forceToGaugeY(mid.iTerm);
    const trip = await inkSnapshot(page);
    const filled = insideI(trip, level - 0.02);
    const above = inkIn(
      trip,
      GAUGE_I_MIN_X + 0.03,
      level + 0.06,
      GAUGE_I_MAX_X - 0.03,
      GAUGE_MAX_Y - 0.03,
    );
    test.info().annotations.push({
      type: 'jauge I',
      description: `I = ${mid.iTerm.toFixed(0)} N, niveau ${level.toFixed(3)} m, hachuré ${String(filled)} px (vide ${String(emptyInk)}), au-dessus ${String(above)} px`,
    });
    expect(filled, 'zone hachurée sous le niveau de I').toBeGreaterThan(emptyInk + 80);
    expect(above, 'rien au-dessus du niveau de I').toBeLessThanOrEqual(emptyInk);

    // À l'issue : la valeur finale reste affichée et dessinée.
    await run(page, [['advance', 6]]);
    const end = await run(page, []);
    expect(end.phase).toBe('outcome');
    await expect(value).toBeVisible();
    expect(Math.abs(digitsOf((await value.textContent()) ?? '') - end.iTerm)).toBeLessThanOrEqual(
      1,
    );
    await checkIGaugeLabels(page, 1280, 720);
    const done = await inkSnapshot(page);
    expect(insideI(done, forceToGaugeY(end.iTerm) - 0.02)).toBeGreaterThan(emptyInk + 80);
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
    // Le bouton « Niveau suivant » mène au niveau 2.
    await expect(outcome.locator('button.ui-next')).toHaveText(t('controls.nextLevel'));
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

test('(j) portrait 390×844 : jauge I en trajet et à l’issue, étiquettes sans recouvrement, capture', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=fr', 390, 844);
  await expect(page.locator('#ui .ui-igauge-title:not(.ui-igauge-value)')).toBeVisible();
  await checkIGaugeLabels(page, 390, 844);
  await run(page, [...TO_CONSOLE, ['setKi', 800]]);
  await settle(page);
  await checkIGaugeLabels(page, 390, 844);
  await run(page, [['launch'], ['advance', 0.15]]);
  await settle(page);
  await expect(page.locator('#ui .ui-igauge-value')).toBeVisible();
  await checkIGaugeLabels(page, 390, 844);
  await checkNoOverlap(page, 390, 844);
  await shot(page, 't024-niveau2-jauge-i-portrait.png', true);
  await run(page, [['advance', 6]]);
  await settle(page);
  expect((await run(page, [])).phase).toBe('outcome');
  await checkIGaugeLabels(page, 390, 844);
  await checkNoOverlap(page, 390, 844);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(k) niveau 1 : aucune jauge I, ni étiquette ni trait dans sa bande', async ({ page }) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 0.3]]);
  expect((await run(page, [])).levelId).toBe('level1');
  await expect(page.locator('#ui .ui-igauge-title')).toHaveCount(2);
  await expect(page.locator('#ui .ui-igauge-title:visible')).toHaveCount(0);
  await expect(page.locator('#ui .ui-legend-integral')).toHaveCount(0);
  await expect(page.locator('#ui .ui-readout .ui-sr')).toBeHidden();
  const image = await inkSnapshot(page);
  expect(
    inkIn(image, GAUGE_I_MIN_X - 0.2, GAUGE_MIN_Y - 0.03, GAUGE_I_MAX_X + 0.2, GAUGE_MAX_Y + 0.03),
    'bande de la jauge I au niveau 1',
  ).toBe(0);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
