/**
 * Écrans titre et menu (T-017e) en navigateur réel, WebGL2 imposé : chargement par défaut, parcours
 * au clavier seul et à la souris, retour au menu depuis la pause et depuis l'issue, aller-retours
 * sans fuite, langue, page de repli sans titre. Le mode `?e2e=1&screen=title|menu` choisit l'écran
 * de départ (sans `e2e=1`, le paramètre est ignoré et le jeu démarre sur le titre).
 *
 * Captures : cinq PNG dans docs/img/t017-*.png (titre, menu, titre et menu en portrait, issue avec
 * le bouton « Menu ») ; les autres, seulement si la variable CAPTURE_DIR est définie.
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

/** Ligne de copyright du fichier LICENSE. */
const LICENSE_LINE = (() => {
  const text = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8');
  const match = /^Copyright \(c\) \d{4} \S.*$/m.exec(text);
  if (match === null) throw new Error('LICENSE : ligne de copyright absente');
  return match[0].trim();
})();

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
  | readonly ['advance' | 'setKp', number]
  | readonly ['moveRight' | 'stop' | 'interact' | 'launch' | 'restart' | 'pause' | 'resume'];

/** Exécute des étapes par le crochet, puis met l'interface à jour ; renvoie phase et Kp. */
async function run(
  page: Page,
  steps: readonly Step[],
): Promise<{ phase: string; kp: number; screen: string }> {
  return page.evaluate((list) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    for (const step of list) {
      if (step[0] === 'advance') hook.advance(step[1]);
      else if (step[0] === 'setKp') hook.commands.setKp(step[1]);
      else hook.commands[step[0]]();
    }
    hook.advance(0);
    const screen = hook.app.state().screen;
    if (screen !== 'level') return { phase: 'none', kp: 0, screen };
    const s = hook.snapshot();
    return { phase: s.phase, kp: s.kp, screen };
  }, steps);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop'], ['interact']];
const WIN: readonly Step[] = [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 4]];

/** Écran courant du crochet. */
function screenOf(page: Page): Promise<string> {
  return page.evaluate(() => window.__huygens?.app.state().screen ?? 'absent');
}

for (const lang of ['fr', 'en'] as const) {
  const t = T[lang];
  const play = (page: Page): Locator =>
    page.getByRole('button', { name: t('title.play'), exact: true });
  const levelButton = (page: Page): Locator =>
    page.getByRole('button', { name: t('level1.title'), exact: true });
  const level2Button = (page: Page): Locator =>
    page.getByRole('button', { name: t('level2.title'), exact: true });
  const menuButton = (page: Page): Locator =>
    page.getByRole('button', { name: t('controls.menu'), exact: true });

  test(`(a) ${lang} : chargement par défaut sur le titre, focus sur « ${t('title.play')} », copyright de LICENSE`, async ({
    page,
  }) => {
    const problems = await open(page, `lang=${lang}`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    expect(await page.title()).toBe(t('app.title'));
    const main = page.getByRole('main', { name: t('app.title') });
    await expect(main).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('app.title'));
    await expect(play(page)).toBeFocused();
    const copyright = page.getByText(LICENSE_LINE, { exact: true });
    await expect(copyright).toBeVisible();
    expect(t('title.copyright')).toBe(LICENSE_LINE);
    await expect(page.getByText(t('title.license'), { exact: true })).toBeVisible();
    // Pas de niveau derrière le titre ; le canvas n'est que du papier, masqué aux lecteurs d'écran.
    await expect(page.locator('#ui')).toHaveCount(0);
    await expect(page.locator('#scene')).toHaveAttribute('aria-hidden', 'true');
    // Le paramètre `screen` est ignoré hors `?e2e=1`.
    await page.goto(`?renderer=webgl&lang=${lang}&screen=level1`);
    await expect(play(page)).toBeVisible();
    await expect(page.locator('#ui')).toHaveCount(0);
    if (lang === 'fr') await shot(page, 't017-titre-fr.png', true);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(b) ${lang} : parcours au clavier seul, victoire, pause, « Menu », Échap`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=title&lang=${lang}`);
    await expect(play(page)).toBeFocused();
    // Échap ne fait rien au titre.
    await page.keyboard.press('Escape');
    expect(await screenOf(page)).toBe('title');
    await expect(play(page)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('main', { name: t('menu.title') })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(levelButton(page)).toBeFocused();
    await expect(page.locator('#scene')).toHaveAttribute('aria-hidden', 'true');
    // Deux niveaux puis « Retour » : les flèches parcourent la liste dans l'ordre du menu.
    await page.keyboard.press('ArrowDown');
    await expect(level2Button(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: t('menu.back'), exact: true })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(level2Button(page)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(levelButton(page)).toBeFocused();
    await page.keyboard.press('Enter');

    const banner = page.locator('#ui .ui-banner');
    await expect(banner).toBeVisible();
    await expect(page.locator('#screens')).toHaveCount(0);
    await expect(page.locator('#scene')).not.toHaveAttribute('aria-hidden', /.*/);
    const win = await run(page, WIN);
    expect(win.phase).toBe('outcome');
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    // « Niveau suivant » a le focus ; Tab mène à « Rejouer » : Entrée recommence (réglage), Échap
    // ferme le réglage puis met en pause.
    await expect(page.locator('#ui .ui-outcome button.ui-next')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#ui .ui-outcome button.ui-primary:not(.ui-next)')).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await run(page, [])).phase).toBe('tuning');
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('approach');
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('paused');

    // Tab depuis « ? » : langue, puis « Menu » (visible seulement en pause).
    await page.getByRole('button', { name: t('controls.help.show') }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(menuButton(page).first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main', { name: t('menu.title') })).toBeVisible();
    await expect(page.locator('#ui')).toHaveCount(0);
    // Le focus revient sur le niveau qu'on vient de quitter ; Échap mène au titre.
    await expect(levelButton(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('main', { name: t('app.title') })).toBeVisible();
    await expect(play(page)).toBeFocused();
    expect(await screenOf(page)).toBe('title');
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`(c) ${lang} : parcours à la souris, retour au menu depuis l'issue, puis « Retour »`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&screen=title&lang=${lang}`);
    await play(page).click();
    await expect(levelButton(page)).toBeVisible();
    if (lang === 'fr') await shot(page, 't017-menu-fr.png', true);
    await levelButton(page).click();
    await expect(page.locator('#ui .ui-banner')).toBeVisible();
    // « Menu » n'apparaît pas en jeu courant, ni en approche.
    await expect(page.locator('#ui .ui-tools .ui-menu')).toBeHidden();
    await expect(page.locator('#ui .ui-outcome .ui-menu')).toBeHidden();
    expect((await run(page, WIN)).phase).toBe('outcome');
    const inOutcome = page.locator('#ui .ui-outcome').getByRole('button', {
      name: t('controls.menu'),
      exact: true,
    });
    await expect(inOutcome).toBeVisible();
    if (lang === 'fr') await shot(page, 't017-issue-menu.png', true);
    await inOutcome.click();
    await expect(page.getByRole('main', { name: t('menu.title') })).toBeVisible();
    await page.getByRole('button', { name: t('menu.back'), exact: true }).click();
    await expect(play(page)).toBeVisible();
    expect(await screenOf(page)).toBe('title');
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('(d) trois allers-retours niveau → menu → niveau : une interface, un effet par frappe, niveau neuf', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=menu&lang=fr');
  const FR = T.fr;
  const draws = async (): Promise<number> => {
    await settle(page);
    await page.evaluate(() => {
      window.__huygens?.advance(0);
    });
    await settle(page);
    return page.evaluate(() => window.__huygens?.stats().drawCalls ?? -1);
  };
  let initialDraws = -1;
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.getByRole('button', { name: FR('level1.title'), exact: true }).click();
    await expect(page.locator('#ui')).toHaveCount(1);
    await expect(page.locator('#ui .ui-top')).toHaveCount(1);
    await expect(page.locator('#screens')).toHaveCount(0);
    // Niveau neuf : phase d'approche, Kp par défaut 2000, bonhomme au départ.
    const start = await page.evaluate(() => window.__huygens?.snapshot());
    expect(start?.phase, `cycle ${String(cycle)}`).toBe('approach');
    expect(start?.kp).toBe(2000);
    const d = await draws();
    if (initialDraws < 0) initialDraws = d;
    expect(d, 'mêmes compteurs de dessin à chaque entrée').toBe(initialDraws);
    // Un seul effet par frappe : « + » ajoute exactement 100 N/m.
    await run(page, TO_CONSOLE);
    await page.keyboard.press('+');
    expect((await run(page, [])).kp).toBe(2100);
    // Une frappe d'Échap : un seul changement (réglage fermé), pas deux.
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('approach');
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('paused');
    await page.locator('#ui .ui-tools .ui-menu').click();
    await expect(page.locator('#ui')).toHaveCount(0);
    await expect(page.getByRole('main')).toHaveCount(1);
    expect(await screenOf(page)).toBe('menu');
    // Le niveau abandonné ne reçoit plus rien : les commandes du crochet sont ignorées.
    expect(await page.evaluate(() => window.__huygens?.commands.moveRight())).toBe('ignored');
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(e) la langue choisie au titre est conservée au menu, dans le niveau et au retour', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=title&lang=fr');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.title()).toBe(T.en('app.title'));
  await page.getByRole('button', { name: T.en('title.play'), exact: true }).click();
  await expect(page.getByRole('main', { name: T.en('menu.title') })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: T.en('level1.title'), exact: true }).click();
  await expect(page.locator('#ui .ui-banner')).toContainText(T.en('hud.hint.use'));
  await expect(page.locator('#scene')).toHaveAttribute('aria-label', T.en('a11y.canvas'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // Bascule dans le niveau, puis retour au menu : la langue suit.
  await page.getByRole('button', { name: 'Français' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.title()).toBe(T.fr('app.title'));
  await run(page, [['pause']]);
  await page.getByRole('button', { name: T.fr('controls.menu'), exact: true }).click();
  await expect(page.getByRole('main', { name: T.fr('menu.title') })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.title()).toBe(T.fr('app.title'));
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f) ?renderer=none : page de repli, sans titre ni menu', async ({ page }) => {
  await page.goto('?renderer=none&lang=fr');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.getByRole('heading', { name: T.fr('fallback.title') })).toBeVisible();
  await expect(page.locator('#screens')).toHaveCount(0);
  await expect(page.locator('#ui')).toHaveCount(0);
  await expect(page.getByRole('button', { name: T.fr('title.play') })).toHaveCount(0);
  await expect(page.getByText(LICENSE_LINE)).toHaveCount(0);
});

test('(g) échec du rendu sur le menu : l’écran est démonté, la page de repli s’affiche', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=menu&lang=fr');
  await expect(page.getByRole('main', { name: T.fr('menu.title') })).toBeVisible();
  await page.evaluate(() => {
    window.__huygens?.crashNextFrame();
  });
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#screens')).toHaveCount(0);
  await expect(page.getByRole('main')).toHaveCount(1);
  // Seule l'erreur journalisée par la page de repli est attendue.
  expect(problems.filter((p) => !p.includes('panne simulée'))).toEqual([]);
});

test('(h) portrait 390×844 et 360×740 : titre et menu lisibles, boutons d’au moins 44 px', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=title&lang=fr', 390, 844);
  const check = async (): Promise<void> => {
    for (const [width, height] of [
      [390, 844],
      [360, 740],
    ] as const) {
      await page.setViewportSize({ width, height });
      await settle(page);
      const report = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main === null) return null;
        const buttons = [...main.querySelectorAll('button')].map((b) => {
          const r = b.getBoundingClientRect();
          return { height: r.height, width: r.width, left: r.left, right: r.right };
        });
        return {
          overflowX: main.scrollWidth > main.clientWidth,
          buttons,
          viewport: window.innerWidth,
        };
      });
      expect(report, 'écran monté').not.toBeNull();
      expect(report?.overflowX, `${String(width)}: pas de défilement horizontal`).toBe(false);
      for (const b of report?.buttons ?? []) {
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(report?.viewport ?? 0);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };
  await check();
  await shot(page, 't017-titre-portrait.png', true);
  await page.getByRole('button', { name: T.fr('title.play'), exact: true }).click();
  await expect(page.getByRole('main', { name: T.fr('menu.title') })).toBeVisible();
  await check();
  await shot(page, 't017-menu-portrait.png', true);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const [width, height] of [
  [1280, 720],
  [390, 844],
  [360, 740],
] as const) {
  test(`(i) ${String(width)}×${String(height)} : en pause, « Menu » reste dans l’écran, sans chevaucher les autres boutons de la barre`, async ({
    page,
  }) => {
    const problems = await open(page, 'e2e=1&lang=fr', width, height);
    await run(page, [...TO_CONSOLE, ['setKp', 2500], ['launch'], ['advance', 1], ['pause']]);
    await settle(page);
    const boxes = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('#ui .ui-tools > button')]
        .filter((b) => b.getClientRects().length > 0)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return {
            name: b.textContent,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        });
      const brand = document.querySelector('#ui .ui-brand')?.getBoundingClientRect();
      return { rects, brandRight: brand?.right ?? 0, brandBottom: brand?.bottom ?? 0 };
    });
    expect(boxes.rects.map((r) => r.name)).toContain('Menu');
    for (const [i, a] of boxes.rects.entries()) {
      expect(a.left, `${a.name} dans l'écran`).toBeGreaterThanOrEqual(0);
      expect(a.right, `${a.name} dans l'écran`).toBeLessThanOrEqual(width);
      for (const b of boxes.rects.slice(i + 1)) {
        const hit = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(hit, `${a.name} chevauche ${b.name}`).toBe(false);
      }
    }
    // Le bandeau de marque (titre, Kp) ne passe pas sous les boutons.
    const first = boxes.rects[0];
    expect(first).toBeDefined();
    expect(boxes.brandRight, 'marque à gauche des boutons').toBeLessThanOrEqual(first?.left ?? 0);
    const menu = page.locator('#ui .ui-tools .ui-menu');
    await expect(menu).toBeVisible();
    await shot(page, `t017-pause-menu-${String(width)}.png`, false);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

/** Centre horizontal et point à 8 px sous le bord haut d'un bouton (là où le deuxième clic tombe). */
async function topPoint(button: Locator): Promise<{ x: number; y: number }> {
  const box = await button.boundingBox();
  if (box === null) throw new Error('bouton sans boîte');
  return { x: box.x + box.width / 2, y: box.y + 8 };
}

test.describe('(j) une intention = un écran (A-01)', () => {
  const FR = T.fr;
  const play = (page: Page): Locator =>
    page.getByRole('button', { name: FR('title.play'), exact: true });
  const menuTitle = (page: Page): Locator => page.getByRole('main', { name: FR('menu.title') });

  test('double-clic en haut de « Jouer » : le menu s’affiche, aucun niveau', async ({ page }) => {
    const problems = await open(page, 'e2e=1&screen=title&lang=fr');
    const { x, y } = await topPoint(play(page));
    await page.mouse.dblclick(x, y);
    await expect(menuTitle(page)).toBeVisible();
    await settle(page);
    expect(await screenOf(page)).toBe('menu');
    await expect(page.locator('#ui')).toHaveCount(0);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test('Entrée maintenue sur « Jouer » (répétition) : le menu, pas le niveau', async ({ page }) => {
    await open(page, 'e2e=1&screen=title&lang=fr');
    await expect(play(page)).toBeFocused();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(menuTitle(page)).toBeVisible();
    await settle(page);
    expect(await screenOf(page)).toBe('menu');
  });

  test('Espace et Entrée sans répétition, clic souris unique, clic synthétique : fonctionnent', async ({
    page,
  }) => {
    await open(page, 'e2e=1&screen=title&lang=fr');
    await page.keyboard.press('Space');
    await expect(menuTitle(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(play(page)).toBeVisible();
    await play(page).click();
    await expect(menuTitle(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(play(page)).toBeVisible();
    // Sans pointerdown (lecteur d'écran, crochet de test) : accepté.
    await play(page).evaluate((node: HTMLElement) => {
      node.click();
    });
    await expect(menuTitle(page)).toBeVisible();
    expect(await screenOf(page)).toBe('menu');
  });

  test('double-clic sur « Retour » : le titre, langue inchangée', async ({ page }) => {
    await open(page, 'e2e=1&screen=menu&lang=fr');
    const back = page.getByRole('button', { name: FR('menu.back'), exact: true });
    const { x, y } = await topPoint(back);
    await page.mouse.dblclick(x, y);
    await expect(play(page)).toBeVisible();
    await settle(page);
    expect(await screenOf(page)).toBe('title');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('Entrée maintenue sur « Menu » en pause : le menu, pas un niveau neuf', async ({ page }) => {
    await open(page, 'e2e=1&screen=level1&lang=fr');
    await run(page, [['pause']]);
    const menu = page.locator('#ui .ui-tools .ui-menu');
    await menu.focus();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(menuTitle(page)).toBeVisible();
    await settle(page);
    expect(await screenOf(page)).toBe('menu');
  });

  test('Échap maintenue dans un niveau : un seul basculement', async ({ page }) => {
    await open(page, 'e2e=1&screen=level1&lang=fr');
    await page.keyboard.down('Escape');
    expect((await run(page, [])).phase).toBe('paused');
    for (let i = 0; i < 3; i += 1) await page.keyboard.down('Escape');
    expect((await run(page, [])).phase).toBe('paused');
    await page.keyboard.up('Escape');
    await page.keyboard.press('Escape');
    expect((await run(page, [])).phase).toBe('approach');
  });
});

test.describe('(k) double tape tactile sur « Jouer » (A-01)', () => {
  test.use({ hasTouch: true });
  test('le menu s’affiche, aucun niveau', async ({ page }) => {
    await open(page, 'e2e=1&screen=title&lang=fr', 844, 390);
    const { x, y } = await topPoint(
      page.getByRole('button', { name: T.fr('title.play'), exact: true }),
    );
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await expect(page.getByRole('main', { name: T.fr('menu.title') })).toBeVisible();
    await settle(page);
    expect(await screenOf(page)).toBe('menu');
  });
});
