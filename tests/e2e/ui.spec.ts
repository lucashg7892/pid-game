/**
 * Interface DOM (T-010) en navigateur réel, WebGL2 imposé : aide contextuelle, panneau Kp,
 * messages pédagogiques, commandes définitives au clavier réel, langue, accessibilité, police,
 * disposition. Captures dans docs/img/t010-*.png.
 *
 * Les scénarios (a) et (b) jouent au CLAVIER RÉEL (`page.keyboard`), en temps réel, sans le
 * crochet de commandes. Les autres utilisent le crochet `?e2e=1` pour amener le niveau dans un
 * état précis, puis vérifient l'interface.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CONSOLE_X, VOID_MAX_X, VOID_MIN_X } from '../../src/game';
import { PLAY_ZONE, computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { CONSOLE_ANCHOR_Y, WALKER_HEAD_TOP } from '../../src/render/level-display';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

type Lang = 'fr' | 'en';

/**
 * Textes lus directement dans les locales : le chargeur ESM de Playwright refuse l'import JSON
 * sans attribut `type: json` utilisé par src/i18n (prévu pour Vite).
 */
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
const EN = catalog('en');
const NB = '\u00A0';

/** Ouvre le jeu et attend la première image et l'interface. */
async function open(page: Page, query: string, width = 1280, height = 720): Promise<string[]> {
  await page.setViewportSize({ width, height });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(query);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  if (!query.includes('e2e=1')) {
    // Sans le crochet, le jeu démarre sur le titre : « Jouer », puis le niveau 1.
    await page.locator('#screens .ui-primary').click();
    await page.locator('#screens .ui-screen-level').first().click();
  }
  await expect(page.locator('#ui .ui-banner')).toBeVisible();
  return problems;
}

/** Commande du crochet de test. */
type Step =
  | readonly ['advance' | 'setKp', number]
  | readonly ['moveRight' | 'stop' | 'interact' | 'launch' | 'restart' | 'pause' | 'resume'];

/** Exécute des étapes par le crochet (`?e2e=1`), puis met l'interface à jour (advance 0). */
async function run(
  page: Page,
  steps: readonly Step[],
): Promise<{
  phase: string;
  kp: number;
  resumePhase: string | null;
  walkerX: number;
  walkerInCabin: boolean;
}> {
  return page.evaluate((list) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    for (const step of list) {
      if (step[0] === 'advance') hook.advance(step[1]);
      else if (step[0] === 'setKp') hook.commands.setKp(step[1]);
      else hook.commands[step[0]]();
    }
    hook.advance(0);
    const s = hook.snapshot();
    return {
      phase: s.phase,
      kp: s.kp,
      resumePhase: s.resumePhase,
      walkerX: s.walkerX,
      walkerInCabin: s.walkerInCabin,
    };
  }, steps);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop'], ['interact']];

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

async function capture(page: Page, name: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: `docs/img/${name}` });
}

/** Marche au clavier réel jusqu'à la console (bandeau « E : utiliser la console »). */
async function walkToConsole(page: Page, banner: Locator, useText: string): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await expect(banner).toContainText(useText, { timeout: 15_000 });
  await page.keyboard.up('ArrowRight');
}

/** Rectangle écran de la cage (même cadrage que le rendu : computeFrame). */
function cageRect(width: number, height: number) {
  const f = computeFrame(width, height);
  return {
    x: worldXToPixel(f, width, VOID_MIN_X),
    y: worldYToPixel(f, height, PLAY_ZONE.maxY),
    right: worldXToPixel(f, width, VOID_MAX_X),
    bottom: worldYToPixel(f, height, PLAY_ZONE.minY),
  };
}

/** Rectangle écran (pixels CSS) d'un rectangle monde. */
function screenBox(
  width: number,
  height: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): { x: number; y: number; right: number; bottom: number } {
  const f = computeFrame(width, height);
  return {
    x: worldXToPixel(f, width, minX),
    y: worldYToPixel(f, height, maxY),
    right: worldXToPixel(f, width, maxX),
    bottom: worldYToPixel(f, height, minY),
  };
}

/**
 * Vérifie qu'aucun panneau visible n'intersecte la cage, la console, ni le bonhomme quand il est
 * sur le quai (boîte tête → pieds, 0,6 m de large) ; renvoie le compte rendu.
 * @param walkerX abscisse du bonhomme sur le quai (m), ou `null` s'il est dans la cabine.
 */
async function checkPanelsAvoidCage(
  page: Page,
  width: number,
  height: number,
  walkerX: number | null,
): Promise<string[]> {
  const obstacles: [string, { x: number; y: number; right: number; bottom: number }][] = [
    ['cage', cageRect(width, height)],
    [
      'console',
      screenBox(width, height, CONSOLE_X - 0.35, CONSOLE_X + 0.35, 0, CONSOLE_ANCHOR_Y + 0.35),
    ],
  ];
  if (walkerX !== null) {
    obstacles.push([
      'bonhomme',
      screenBox(width, height, walkerX - 0.3, walkerX + 0.3, 0, WALKER_HEAD_TOP),
    ]);
  }
  const report: string[] = [];
  type Box = { x: number; y: number; width: number; height: number };
  const hits = (a: Box, r: { x: number; y: number; right: number; bottom: number }): boolean =>
    a.x < r.right && r.x < a.x + a.width && a.y < r.bottom && r.y < a.y + a.height;
  const panels: [string, Box][] = [];
  for (const selector of [
    '.ui-banner',
    '.ui-bubble',
    '.ui-panel',
    '.ui-readout',
    '.ui-outcome',
    '.ui-help',
    '.ui-tools .ui-menu',
    '.ui-outcome .ui-menu',
  ]) {
    const node = page.locator(`#ui ${selector}`);
    if (!(await node.isVisible())) continue;
    const b = await node.boundingBox();
    expect(b, selector).not.toBeNull();
    if (b === null) continue;
    panels.push([selector, b]);
    report.push(
      `${selector} [${b.x.toFixed(0)}, ${b.y.toFixed(0)}, ${(b.x + b.width).toFixed(0)}, ${(b.y + b.height).toFixed(0)}]`,
    );
    for (const [name, r] of obstacles) {
      expect(
        hits(b, r),
        `${selector} coupe ${name} [${r.x.toFixed(0)}–${r.right.toFixed(0)}] × [${r.y.toFixed(0)}–${r.bottom.toFixed(0)}]`,
      ).toBe(false);
    }
  }
  // Étiquettes de la jauge (légende ou « Force : … N », « max », « poids ») : mêmes obstacles,
  // et jamais sous un panneau (l'aide, fenêtre modale, est exclue).
  const labels = page.locator('#ui .ui-force, #ui .ui-gauge-title, #ui .ui-gauge-tag');
  for (let i = 0; i < (await labels.count()); i += 1) {
    const node = labels.nth(i);
    if (!(await node.isVisible())) continue;
    const b = await node.boundingBox();
    expect(b, `étiquette ${String(i)}`).not.toBeNull();
    if (b === null) continue;
    const text = (await node.textContent()) ?? '';
    report.push(
      `« ${text} » [${b.x.toFixed(0)}, ${b.y.toFixed(0)}, ${(b.x + b.width).toFixed(0)}, ${(b.y + b.height).toFixed(0)}]`,
    );
    expect(b.x, `« ${text} » dans l'écran`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `« ${text} » dans l'écran`).toBeLessThanOrEqual(width);
    expect(b.y, `« ${text} » dans l'écran`).toBeGreaterThanOrEqual(0);
    for (const [name, r] of obstacles) {
      expect(
        hits(b, r),
        `« ${text} » [${b.x.toFixed(0)}, ${b.y.toFixed(0)}, ${(b.x + b.width).toFixed(0)}, ${(b.y + b.height).toFixed(0)}] coupe ${name} [${r.x.toFixed(0)}, ${r.y.toFixed(0)}, ${r.right.toFixed(0)}, ${r.bottom.toFixed(0)}]`,
      ).toBe(false);
    }
    for (const [selector, p] of panels) {
      if (selector === '.ui-help') continue;
      expect(
        hits(b, { x: p.x, y: p.y, right: p.x + p.width, bottom: p.y + p.height }),
        `« ${text} » coupe ${selector}`,
      ).toBe(false);
    }
  }
  return report;
}

test('(a) FR, clavier réel : aide, marche, panneau Kp, + ×5, Entrée, victoire, R', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&lang=fr');
  const banner = page.locator('#ui .ui-banner');
  await expect(banner).toContainText(`avancer vers la console`);
  await expect(banner.locator('kbd', { hasText: 'D' })).toBeVisible();
  await expect(banner.locator('kbd', { hasText: '→' })).toBeVisible();
  await expect(page.locator('#ui .ui-bubble')).toHaveText(FR('level1.goal'));
  // Étiquettes permanentes de la jauge dès l'approche ; « Force : … N » n'apparaît qu'au trajet.
  await expect(page.locator('#ui .ui-gauge-title')).toHaveText('Force du moteur');
  await expect(page.locator('#ui .ui-gauge-tag').nth(0)).toHaveText(`5000${NB}N max`);
  await expect(page.locator('#ui .ui-gauge-tag').nth(1)).toHaveText('poids');
  await expect(page.locator('#ui .ui-force')).toBeHidden();
  await expect(page.locator('#ui .ui-kp-tag')).toHaveText(`Kp = 2000${NB}N/m`);
  await expect(page.locator('#ui .ui-title')).toHaveText('Huygens’s world');
  await capture(page, 't010-01-aide.png');

  await walkToConsole(page, banner, 'utiliser la console');
  await expect(banner.locator('kbd', { hasText: 'E' })).toBeVisible();
  await expect(page.locator('#ui .ui-bubble')).toHaveText(FR('level1.console.prompt'));

  await page.keyboard.press('e');
  const slider = page.getByRole('slider', { name: FR('level1.kp.label') });
  await expect(slider).toBeFocused();
  const value = page.locator('#ui .ui-kp-value');
  await expect(value).toHaveText(`2000${NB}N/m`);
  await expect(banner).toContainText('régler Kp');
  await expect(banner).toContainText('lancer');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('+');
  await expect(value).toHaveText(`2500${NB}N/m`);
  await expect(slider).toHaveValue('2500');
  await expect(page.locator('#ui .ui-kp-tag')).toHaveText(`Kp = 2500${NB}N/m`);
  await capture(page, 't010-02-panneau.png');

  await page.keyboard.press('Enter');
  await expect(slider).toBeDisabled();
  await expect(page.getByText(FR('level1.kp.locked'))).toBeVisible();
  await expect(banner).toContainText('Kp est verrouillé');
  await expect(page.locator('#ui .ui-readout')).toBeVisible();
  await capture(page, 't010-03-trajet.png');

  const live = page.locator('[aria-live="polite"]');
  await expect(live).toContainText(
    `Réussi\u202F! La cabine s’est stabilisée 0,20${NB}m sous le plateau d’arrivée.`,
    {
      timeout: 10_000,
    },
  );
  const outcome = page.locator('#ui .ui-outcome');
  await expect(outcome).toBeVisible();
  await expect(outcome).toContainText(FR('level1.winTitle'));
  await expect(outcome).toContainText(FR('level1.win'));
  await expect(outcome).toContainText(FR('level1.teaser'));
  await expect(outcome).toContainText(FR('level1.comingSoon'));
  await expect(page.locator('#ui .ui-dimension')).toHaveText(`e = 0,20${NB}m`);
  await expect(page.locator('#ui .ui-dimension')).toBeVisible();
  await expect(outcome.locator('.ui-formula')).toHaveText(
    `e = m·g/Kp = 490,5${NB}N ÷ 2500${NB}N/m ≈ 0,20${NB}m`,
  );
  await expect(banner).toContainText('réessayer');
  await capture(page, 't010-04-victoire.png');

  await page.keyboard.press('r');
  await expect(outcome).toBeHidden();
  await expect(slider).toBeEnabled();
  await expect(slider).toBeFocused();
  await expect(value).toHaveText(`2500${NB}N/m`);
  await expect(live).toContainText(FR('hud.status.reset'));
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(b) EN, clavier réel : Kp = 7000 (Page préc. ×4, + ×10), choc contre la poutre', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&lang=en');
  const banner = page.locator('#ui .ui-banner');
  await expect(banner).toContainText('walk to the console');
  await walkToConsole(page, banner, 'use the console');
  await page.keyboard.press('e');
  const slider = page.getByRole('slider', { name: EN('level1.kp.label') });
  await expect(slider).toBeFocused();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('PageUp');
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('+');
  await expect(page.locator('#ui .ui-kp-value')).toHaveText(`7000${NB}N/m`);
  await page.keyboard.press('Enter');
  const outcome = page.locator('#ui .ui-outcome');
  await expect(outcome).toContainText(EN('level1.fail.bonk'), { timeout: 10_000 });
  await expect(outcome).toContainText(EN('level1.failTitle.bonk'));
  await expect(page.locator('[aria-live="polite"]')).toContainText('hit the beam');
  await expect(page.locator('#ui .ui-dimension')).toBeHidden();
  await expect(banner).toContainText('R: try again');
  await capture(page, 't010-05-bonk-en.png');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(c) bascule de langue pendant le réglage : textes traduits, Kp et phase conservés', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  const tuned = await run(page, [...TO_CONSOLE, ['setKp', 3000]]);
  expect(tuned.phase).toBe('tuning');
  const ui = page.locator('#ui');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(ui.locator('.ui-panel-title')).toHaveText(FR('level1.kp.label'));
  const lang = page.getByRole('button', { name: 'English' });
  await expect(lang.locator('span[lang="en"]')).toHaveText('English');
  await lang.click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.title()).toBe(EN('app.title'));
  await expect(ui.locator('.ui-panel-title')).toHaveText(EN('level1.kp.label'));
  await expect(ui.locator('.ui-banner')).toContainText('set Kp');
  await expect(ui.locator('.ui-kp-value')).toHaveText(`3000${NB}N/m`);
  await expect(page.getByRole('button', { name: 'Launch' })).toBeVisible();
  await expect(page.getByRole('slider', { name: EN('level1.kp.label') })).toHaveValue('3000');
  await expect(page.locator('#scene')).toHaveAttribute('aria-label', EN('a11y.canvas'));
  await expect(
    page.getByRole('button', { name: 'Français' }).locator('span[lang="fr"]'),
  ).toHaveText('Français');
  // Textes visibles (la région aria-live garde l'historique des annonces : exclue).
  const text = (
    await Promise.all(
      ['.ui-top', '.ui-panel', '.ui-banner'].map((selector) => ui.locator(selector).innerText()),
    )
  ).join('\n');
  for (const french of ['Gain proportionnel', 'régler', 'Lancer', 'Valeur de Kp', 'Afficher']) {
    expect(text, french).not.toContain(french);
  }
  const after = await run(page, []);
  expect(after.phase).toBe('tuning');
  expect(after.kp).toBe(3000);

  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(ui.locator('.ui-panel-title')).toHaveText(FR('level1.kp.label'));
  expect(await page.title()).toBe(FR('app.title'));
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const lang of ['fr', 'en'] as const) {
  test(`(d) accessibilité (${lang}) : noms accessibles, tabulation, focus visible, aria-live, canvas`, async ({
    page,
  }) => {
    const t = lang === 'fr' ? FR : EN;
    const problems = await open(page, `?renderer=webgl&e2e=1&lang=${lang}`);
    await run(page, TO_CONSOLE);
    const names = [
      t('controls.help.show'),
      t('app.language.switch'),
      t('controls.pause'),
      t('controls.kpDecrease'),
      t('controls.kpIncrease'),
      t('controls.launch'),
    ];
    for (const name of names) {
      await expect(page.getByRole('button', { name, exact: true }), name).toBeVisible();
    }
    await expect(page.getByRole('slider', { name: t('level1.kp.label') })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: t('level1.kp.field') })).toBeVisible();
    await expect(page.getByRole('group', { name: t('a11y.kpPanel') })).toBeVisible();
    await expect(page.getByRole('img', { name: t('a11y.canvas') })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);

    // Ordre de tabulation, depuis un point de départ maîtrisé : le premier contrôle de la barre
    // du haut. (Dans Chrome, `blur()` ne ramène pas le point de départ de la navigation
    // séquentielle au début du document : le Tab suivant repartait du curseur.)
    const focused = (): Promise<{ label: string; tag: string; interactive: boolean }> =>
      page.evaluate(() => {
        const a = document.activeElement;
        if (a === null) return { label: '', tag: '', interactive: false };
        const label =
          a.getAttribute('aria-label') ??
          (a.getAttribute('aria-labelledby') !== null
            ? 'slider'
            : a === document.body
              ? 'BODY'
              : (a as HTMLElement).innerText.trim() || a.tagName);
        return {
          label,
          tag: a.tagName,
          interactive: a.matches('button, input, summary, a[href], select, textarea'),
        };
      });
    const helpName = t('controls.help.show');
    await page.getByRole('button', { name: helpName }).focus();
    const order: string[] = [(await focused()).label];
    for (let i = 0; i < 7; i += 1) {
      await page.keyboard.press('Tab');
      order.push((await focused()).label);
    }
    expect(order).toEqual([
      helpName,
      t('app.language.switch'),
      t('controls.pause'),
      t('controls.kpDecrease'),
      'slider',
      t('controls.kpIncrease'),
      'INPUT',
      t('controls.launch'),
    ]);
    // Focus visible : contour de 3 px sur un vrai contrôle atteint au clavier (« Lancer »).
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return `${s.outlineStyle} ${s.outlineWidth}`;
    });
    expect(outline).toBe('solid 3px');
    // Suite du cycle jusqu'au retour au bouton d'aide : seuls des contrôles prennent le focus,
    // en dehors du rebouclage du navigateur (au plus un passage par <body>). Aucun panneau ou
    // conteneur à défilement n'entre dans l'ordre de tabulation.
    const rest: { label: string; tag: string; interactive: boolean }[] = [];
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      const f = await focused();
      if (f.label === helpName) break;
      rest.push(f);
    }
    test.info().annotations.push({
      type: 'suite du cycle',
      description: rest.map((f) => `${f.tag}:${f.label.slice(0, 30)}`).join(' | '),
    });
    expect((await focused()).label, 'le cycle revient au bouton d’aide').toBe(helpName);
    const strays = rest.filter((f) => !f.interactive && f.tag !== 'BODY');
    expect(strays, 'conteneurs non interactifs dans l’ordre de tabulation').toEqual([]);
    expect(rest.filter((f) => f.tag === 'BODY').length).toBeLessThanOrEqual(1);

    // Aide des commandes : s'ouvre, Échap la ferme sans mettre en pause, focus rendu au bouton.
    await page.getByRole('button', { name: t('controls.help.show') }).click();
    const dialog = page.getByRole('dialog', { name: t('controls.help.title') });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(t('controls.help.move'));
    await expect(dialog).toContainText(t('controls.help.touch'));
    await expect(dialog).toContainText(t('controls.help.mouse'));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect((await run(page, [])).phase).toBe('tuning');
    await expect(page.getByRole('button', { name: t('controls.help.show') })).toBeFocused();
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(e) aucune touche du jeu ne fait défiler la page ; toutes sont interceptées', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const seen: [string, boolean][] = [];
    (window as unknown as { __keys: [string, boolean][] }).__keys = seen;
    window.addEventListener('keydown', (e) => {
      seen.push([e.code, e.defaultPrevented]);
    });
  });
  const keys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    'KeyE',
    'Enter',
    'KeyR',
    'Equal',
    'Minus',
    'Escape',
    'Escape',
  ];
  for (const key of keys) {
    await page.keyboard.press(key === 'Equal' ? '=' : key === 'Minus' ? '-' : key);
  }
  const seen = await page.evaluate(
    () => (window as unknown as { __keys: [string, boolean][] }).__keys,
  );
  expect(seen.map(([code]) => code)).toEqual(keys);
  for (const [code, prevented] of seen) expect(prevented, code).toBe(true);
  const scroll = await page.evaluate(() => [
    window.scrollX,
    window.scrollY,
    document.scrollingElement?.scrollTop ?? 0,
  ]);
  expect(scroll).toEqual([0, 0, 0]);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f) perte de focus pendant un trajet : pause automatique', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  const trip = await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 0.5]]);
  expect(trip.phase).toBe('trip');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const paused = await run(page, []);
  expect(paused.phase).toBe('paused');
  expect(paused.resumePhase).toBe('trip');
  await expect(page.locator('#ui .ui-banner')).toContainText(FR('hud.status.paused'));
  await expect(page.locator('[aria-live="polite"]')).toContainText(FR('hud.status.paused'));
  await expect(page.getByRole('button', { name: FR('controls.resume') })).toBeVisible();
  // Échap reprend le trajet là où il s'était arrêté.
  await page.keyboard.press('Escape');
  expect((await run(page, [])).phase).toBe('trip');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f bis) perte de focus en approche : arrêt de la marche, pas de pause', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('ArrowRight');
  const s = await page.evaluate(() => window.__huygens?.snapshot());
  expect(s?.phase).toBe('approach');
  expect(s?.walkerMoving).toBe(false);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(g) portrait 390×844 : invite à tourner l’appareil', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&lang=fr', 390, 844);
  const hint = page.locator('#ui .ui-rotate');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(FR('app.rotateHint'));
  await capture(page, 't010-06-portrait.png');
  const report = await checkPanelsAvoidCage(page, 390, 844, -5.5);
  test.info().annotations.push({ type: 'panneaux 390×844', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(h) police manuscrite chargée, servie depuis /pid-game/fonts/', async ({ page }) => {
  const fonts: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/fonts/'))
      fonts.push(`${String(response.status())} ${response.url()}`);
  });
  const problems = await open(page, '?renderer=webgl&lang=fr');
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Patrick Hand');
    return {
      check: document.fonts.check('18px "Patrick Hand"', 'Huygens'),
      loaded: faces.filter((f) => f.status === 'loaded').length,
      family: getComputedStyle(document.querySelector('#ui .ui-title') as Element).fontFamily,
    };
  });
  test.info().annotations.push({
    type: 'polices',
    description: `${fonts.join(' | ')} ; ${JSON.stringify(loaded)}`,
  });
  expect(loaded.check).toBe(true);
  expect(loaded.loaded).toBeGreaterThanOrEqual(1);
  expect(loaded.family).toContain('Patrick Hand');
  expect(fonts.length).toBeGreaterThanOrEqual(1);
  for (const line of fonts)
    expect(line).toMatch(
      /^200 http:\/\/127\.0\.0\.1:\d+\/pid-game\/fonts\/patrick-hand-latin(-ext)?-400-normal\.woff2$/,
    );
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const [width, height] of [
  [1280, 720],
  [390, 844],
] as const) {
  test(`(i) ${String(width)}×${String(height)} : aucun panneau ouvert ne recouvre la cage, la console ni le bonhomme`, async ({
    page,
  }) => {
    const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr', width, height);
    const report: string[] = [];
    const states: [string, readonly Step[]][] = [
      ['approche, départ', []],
      ['approche, mi-quai', [['moveRight'], ['advance', 1.7]]],
      ['réglage, bonhomme en butée droite', [['advance', 2.6], ['stop'], ['interact']]],
      ['trajet', [['setKp', 2500], ['launch'], ['advance', 1]]],
      ['trajet en pause (bouton « Menu » visible)', [['pause']]],
      ['victoire (bouton « Menu » dans l’issue)', [['resume'], ['advance', 3]]],
    ];
    let walkerX: number | null = null;
    for (const [name, steps] of states) {
      const s = await run(page, steps);
      walkerX = s.walkerInCabin ? null : s.walkerX;
      await settle(page);
      const boxes = await checkPanelsAvoidCage(page, width, height, walkerX);
      report.push(`${name} (x = ${String(walkerX)}) : ${boxes.join(' ; ')}`);
    }
    await page.getByRole('button', { name: FR('controls.help.show') }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    report.push(`aide : ${(await checkPanelsAvoidCage(page, width, height, walkerX)).join(' ; ')}`);
    test.info().annotations.push({ type: 'boîtes', description: report.join(' | ') });
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(j) aide ouverte pendant un trajet : pause, reprise à la fermeture (bouton et Échap)', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 0.5]]);
  const showHelp = page.getByRole('button', { name: FR('controls.help.show') });
  const dialog = page.getByRole('dialog', { name: FR('controls.help.title') });
  const close = dialog.getByRole('button', { name: FR('controls.help.close') });

  await showHelp.click();
  await expect(dialog).toBeVisible();
  const paused = await run(page, []);
  expect(paused.phase).toBe('paused');
  expect(paused.resumePhase).toBe('trip');
  await close.click();
  await expect(dialog).toBeHidden();
  expect((await run(page, [])).phase).toBe('trip');

  await showHelp.click();
  expect((await run(page, [])).phase).toBe('paused');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await run(page, [])).phase).toBe('trip');
  await expect(showHelp).toBeFocused();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(k) pause du joueur puis aide : la fermeture de l’aide ne reprend pas', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 0.5]]);
  await page.getByRole('button', { name: FR('controls.pause') }).click();
  expect((await run(page, [])).phase).toBe('paused');
  await page.getByRole('button', { name: FR('controls.help.show') }).click();
  await page.getByRole('button', { name: FR('controls.help.close') }).click();
  const s = await run(page, []);
  expect(s.phase).toBe('paused');
  expect(s.resumePhase).toBe('trip');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(l) hors trajet, l’aide ne change pas la phase', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await page.getByRole('button', { name: FR('controls.help.show') }).click();
  expect((await run(page, [])).phase).toBe('approach');
  await page.keyboard.press('Escape');
  expect((await run(page, [])).phase).toBe('approach');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(m) aide modale : focus dedans, Tab piégé, focus rendu à l’ouvreur', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  const showHelp = page.getByRole('button', { name: FR('controls.help.show') });
  const dialog = page.getByRole('dialog', { name: FR('controls.help.title') });
  const close = dialog.getByRole('button', { name: FR('controls.help.close') });
  await expect(page.locator('#ui .ui-help')).toHaveAttribute('aria-modal', 'true');

  await showHelp.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect(close).toBeFocused();
  }
  // Focus sorti de l'aide : Tab y revient.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement).blur();
  });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(showHelp).toBeFocused();

  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(n) bouton Pause sans aria-pressed ; focus sur « Rejouer » à l’issue', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  const pause = page.locator('#ui .ui-pause');
  await expect(pause).not.toHaveAttribute('aria-pressed', /.*/);
  await pause.click();
  await expect(pause).toHaveText(FR('controls.resume'));
  await expect(pause).not.toHaveAttribute('aria-pressed', /.*/);
  await pause.click();
  await expect(pause).toHaveText(FR('controls.pause'));

  const replay = page.locator('#ui .ui-outcome button.ui-primary');
  const win = await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 4.0]]);
  expect(win.phase).toBe('outcome');
  await expect(replay).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(replay).toBeHidden();
  expect((await run(page, [])).phase).toBe('tuning');

  const bonk = await run(page, [['setKp', 7000], ['launch'], ['advance', 1.0]]);
  expect(bonk.phase).toBe('outcome');
  await expect(replay).toBeFocused();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(o) K24 : aide ouverte pendant un trajet, « Reprendre » ne relance pas le jeu', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 0.5]]);
  await page.getByRole('button', { name: FR('controls.help.show') }).click();
  const dialog = page.getByRole('dialog', { name: FR('controls.help.title') });
  await expect(dialog).toBeVisible();
  const before = await page.evaluate(() => window.__huygens?.snapshot());
  expect(before?.phase).toBe('paused');

  // Le bouton « Reprendre » est recouvert par l'aide : le clic est envoyé tel quel, sans test de
  // visibilité de Playwright, pour prouver que le gestionnaire lui-même est gardé.
  const resume = page.locator('#ui .ui-pause');
  await expect(resume).toHaveText(FR('controls.resume'));
  await resume.dispatchEvent('click');
  await page.locator('#ui .ui-touch-action').dispatchEvent('click');
  await run(page, [['advance', 1.0]]);
  const after = await page.evaluate(() => window.__huygens?.snapshot());
  expect(after).toEqual(before);
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: FR('controls.help.close') }).click();
  expect((await run(page, [])).phase).toBe('trip');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(p) K23 : l’aide est opaque, les mesures ne transparaissent pas', async ({ page }) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 1.5]]);
  await page.getByRole('button', { name: FR('controls.help.show') }).click();
  const dialog = page.getByRole('dialog', { name: FR('controls.help.title') });
  await expect(dialog).toBeVisible();
  const alpha = await dialog.evaluate((node) => {
    const color = getComputedStyle(node).backgroundColor;
    return color.startsWith('rgba') ? Number(color.split(',')[3]?.replace(')', '')) : 1;
  });
  expect(alpha).toBe(1);
  const out = process.env['CAPTURE_DIR'];
  if (out !== undefined && out !== '') {
    await settle(page);
    await page.screenshot({ path: `${out}/t017-aide-trajet.png` });
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(r) K24 : aide ouverte, le clavier ne commande plus le jeu ; il le commande après fermeture', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  const showHelp = page.getByRole('button', { name: FR('controls.help.show') });
  const dialog = page.getByRole('dialog', { name: FR('controls.help.title') });
  const snap = (): Promise<unknown> => page.evaluate(() => window.__huygens?.snapshot());

  // Niveau « approche » : D (marche), E (interaction), R n'ont aucun effet.
  await showHelp.click();
  await expect(dialog).toBeVisible();
  const approach = await snap();
  await page.keyboard.down('d');
  await run(page, [['advance', 1.0]]);
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  await page.keyboard.press('r');
  await run(page, [['advance', 1.0]]);
  expect(await snap()).toEqual(approach);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.down('d');
  await run(page, [['advance', 1.0]]);
  await page.keyboard.up('d');
  expect(((await snap()) as { walkerX: number }).walkerX).toBeGreaterThan(
    (approach as { walkerX: number }).walkerX,
  );

  // Niveau « réglage » : +, Page préc., E (lancement) et R n'ont aucun effet.
  await run(page, [['stop'], ...TO_CONSOLE, ['setKp', 2500]]);
  await showHelp.click();
  await expect(dialog).toBeVisible();
  const tuning = await snap();
  expect((tuning as { phase: string }).phase).toBe('tuning');
  for (const key of ['+', 'PageUp', 'PageDown', '-', 'e', 'r']) {
    await page.keyboard.press(key);
  }
  await run(page, [['advance', 1.0]]);
  expect(await snap()).toEqual(tuning);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('+');
  expect((await run(page, [])).kp).toBe(2600);
  await page.keyboard.press('PageUp');
  expect((await run(page, [])).kp).toBe(3600);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(q) cycle de vie de la vue : attach, detach, attach sans fuite ni erreur', async ({
  page,
}) => {
  const problems = await open(page, '?renderer=webgl&e2e=1&lang=fr');
  // Compteurs d'une image de la boucle (les images de `advance` ne remettent pas ceux de three à 0).
  const draws = async (): Promise<number> => {
    await settle(page);
    await settle(page);
    return page.evaluate(() => window.__huygens?.stats().drawCalls ?? -1);
  };
  await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 1.5]]);
  const initial = await draws();
  expect(initial).toBeGreaterThan(2);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.evaluate(() => {
      window.__huygens?.detachLevel();
    });
    expect(await draws(), 'papier seul : moins d’appels de dessin').toBeLessThan(initial);
    expect(await page.evaluate(() => window.__huygens?.trace().length)).toBe(0);
    await page.evaluate(() => {
      window.__huygens?.attachLevel();
    });
    expect(await draws()).toBe(initial);
    expect(await page.evaluate(() => (window.__huygens?.trace().length ?? 0) > 0)).toBe(true);
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

/** A-02 : en paysage bas, les boutons de l'issue restent dans la partie visible du panneau. */
const LOW_LANDSCAPE: readonly (readonly [number, number])[] = [
  [1024, 600],
  [844, 390],
  [740, 360],
  [667, 375],
];

for (const [width, height] of LOW_LANDSCAPE) {
  for (const level of [1, 2]) {
    for (const issue of ['win', 'bonk'] as const) {
      test(`(r) issue ${issue} niveau ${String(level)} à ${String(width)}×${String(height)} : « Rejouer » et « Menu » visibles et cliquables`, async ({
        page,
      }) => {
        const problems = await open(
          page,
          `?renderer=webgl&e2e=1&lang=fr&screen=level${String(level)}`,
          width,
          height,
        );
        await page.evaluate(
          ([lvl, win]) => {
            const hook = window.__huygens;
            if (hook === undefined) throw new Error('window.__huygens absent');
            hook.commands.moveRight();
            hook.advance(2.6);
            hook.commands.stop();
            hook.commands.interact();
            if (lvl === 1) hook.commands.setKp(win ? 2500 : 7000);
            else hook.commands.setKi(win ? 800 : 2500);
            hook.commands.launch();
            hook.advance(12);
            hook.advance(0);
          },
          [level, issue === 'win'] as const,
        );
        const outcome = page.locator('#ui .ui-outcome');
        await expect(outcome).toBeVisible();
        await settle(page);
        const replay = outcome.locator('button.ui-primary');
        const menu = outcome.locator('button.ui-menu');
        await expect(replay).toBeFocused();
        const result = await page.evaluate(() => {
          const panel = document.querySelector('#ui .ui-outcome');
          if (panel === null) throw new Error('panneau absent');
          const p = panel.getBoundingClientRect();
          const one = (selector: string) => {
            const node = panel.querySelector(selector);
            if (node === null) throw new Error(`${selector} absent`);
            const r = node.getBoundingClientRect();
            const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              hit: hit === node,
            };
          };
          return {
            panel: { left: p.left, right: p.right, top: p.top, bottom: p.bottom },
            replay: one('button.ui-primary'),
            menu: one('button.ui-menu'),
            width: window.innerWidth,
            height: window.innerHeight,
          };
        });
        for (const b of [result.replay, result.menu]) {
          expect(b.left).toBeGreaterThanOrEqual(result.panel.left - 0.5);
          expect(b.right).toBeLessThanOrEqual(result.panel.right + 0.5);
          expect(b.top).toBeGreaterThanOrEqual(result.panel.top - 0.5);
          expect(b.bottom).toBeLessThanOrEqual(result.panel.bottom + 0.5);
          expect(b.top).toBeGreaterThanOrEqual(0);
          expect(b.bottom).toBeLessThanOrEqual(result.height);
          expect(b.right).toBeLessThanOrEqual(result.width);
          expect(b.hit).toBe(true);
        }
        await page.keyboard.press('Tab');
        await expect(menu).toBeFocused();
        if (process.env['CAPTURE_DIR'] !== undefined && process.env['CAPTURE_DIR'] !== '') {
          await page.screenshot({
            path: `${process.env['CAPTURE_DIR']}/a02-l${String(level)}-${issue}-${String(width)}x${String(height)}.png`,
          });
        }
        expect(problems, CONSOLE_FAILURE).toEqual([]);
      });
    }
  }
}
