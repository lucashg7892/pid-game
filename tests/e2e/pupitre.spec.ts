/**
 * Pupitre de contrôle (T-049, D35) en navigateur réel, WebGL2 imposé, aux DEUX niveaux : ouverture
 * (touche E, bouton de la barre du haut, clic sur la console), colonne de réglage (leviers, champs,
 * Lancer), lecture seule en trajet sans pause, issue (boutons Rejouer, Niveau suivant et Menu
 * toujours accessibles), clavier complet et focus piégé, lecteur d'écran, captures.
 *
 * Captures dans docs/img/pupitre-<niveau>-<cas>.png (avant, trajet, issue). Les colonnes du centre
 * et de droite sont vides à ce stade (T-050 et T-051).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CONSOLE_X } from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { CONSOLE_ANCHOR_Y } from '../../src/render/level-display';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

type Lang = 'fr' | 'en';

/** Textes lus dans les locales (le chargeur de Playwright n'importe pas le JSON de src/i18n). */
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
const T = { fr: catalog('fr'), en: catalog('en') } as const;

interface Snap {
  phase: string;
  resumePhase: string | null;
  t: number;
  kp: number;
  ki: number;
  outcome: string | null;
  attempt: number;
}

type Step =
  | readonly ['advance' | 'setKp' | 'setKi', number]
  | readonly ['moveRight' | 'stop' | 'interact' | 'launch' | 'restart' | 'pause' | 'resume'];

/** Exécute des étapes par le crochet de test, met l'interface à jour, rend l'état. */
async function run(page: Page, steps: readonly Step[]): Promise<Snap> {
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
    return {
      phase: s.phase,
      resumePhase: s.resumePhase,
      t: s.t,
      kp: s.kp,
      ki: s.ki,
      outcome: s.outcome,
      attempt: s.attempt,
    };
  }, steps);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop']];

async function open(
  page: Page,
  query: string,
  size: { width: number; height: number } = { width: 1280, height: 720 },
): Promise<string[]> {
  await page.setViewportSize(size);
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  await expect(page.locator('#ui .ui-banner')).toBeVisible();
  return problems;
}

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

interface Controls {
  pupitre: Locator;
  kpSlider: Locator;
  kiSlider: Locator;
  kpField: Locator;
  kiField: Locator;
  launch: Locator;
  restart: Locator;
  close: Locator;
}

function controls(page: Page, lang: Lang): Controls {
  const t = T[lang];
  return {
    pupitre: page.locator('#ui .ui-pupitre'),
    kpSlider: page.getByRole('slider', { name: t('level1.kp.label') }),
    kiSlider: page.getByRole('slider', { name: t('level2.ki.label') }),
    kpField: page.getByRole('spinbutton', { name: t('level1.kp.field') }),
    kiField: page.getByRole('spinbutton', { name: t('level2.ki.field') }),
    launch: page.getByRole('button', { name: t('controls.launch'), exact: true }),
    restart: page.locator('#ui .ui-pupitre-recommencer'),
    close: page.getByRole('button', { name: t('pupitre.fermer'), exact: true }),
  };
}

const LEVELS = [
  { n: 1, id: 'level1', win: 2500, tuned: 'kp' },
  { n: 2, id: 'level2', win: 800, tuned: 'ki' },
] as const;

for (const lvl of LEVELS) {
  test.describe(`niveau ${String(lvl.n)}`, () => {
    test(`(a) avant le trajet : E ouvre le pupitre, réglage libre, verrous du niveau, capture`, async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const t = T[lang];
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      const c = controls(page, lang);
      await expect(c.pupitre).toBeHidden();
      await run(page, TO_CONSOLE);
      await page.keyboard.press('e');
      await expect(c.pupitre).toBeVisible();
      await expect(c.pupitre).toHaveAttribute('role', 'dialog');
      await expect(page.getByRole('dialog', { name: t('pupitre.titre') })).toBeVisible();
      const tuned = lvl.id === 'level1' ? c.kpSlider : c.kiSlider;
      const tunedField = lvl.id === 'level1' ? c.kpField : c.kiField;
      const fixed = lvl.id === 'level1' ? c.kiSlider : c.kpSlider;
      const fixedField = lvl.id === 'level1' ? c.kiField : c.kpField;
      await expect(tuned).toBeFocused();
      await expect(tuned).toBeEnabled();
      await expect(tunedField).toBeEnabled();
      await expect(tunedField).toHaveValue('2000');
      await expect(tuned).toHaveAttribute('min', '0');
      await expect(tuned).toHaveAttribute('max', '8000');
      await expect(tuned).toHaveAttribute('step', '100');
      await expect(tuned).toHaveAttribute('aria-valuetext', /2000|2 000/);
      // Verrous du niveau : Ki hors service au niveau 1, Kp fixé (2500) au niveau 2.
      await expect(fixed).toBeDisabled();
      await expect(fixedField).toBeDisabled();
      if (lvl.id === 'level1') {
        await expect(fixed).toHaveAttribute('aria-valuetext', t('pupitre.ki.horsService'));
      } else {
        await expect(fixed).toHaveValue('2500');
        await expect(fixedField).toHaveValue('2500');
      }
      await expect(c.launch).toBeEnabled();
      await expect(c.restart).toBeHidden();
      // Chiffres lisibles : 16 px au moins à 1280×720 (champ : 26 px à l'échelle 1).
      const size = await tunedField.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      const scale = await c.pupitre.locator('.ui-pupitre-plan').evaluate((node) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return m.a;
      });
      expect(size * scale).toBeGreaterThanOrEqual(16);
      // La région aria-live du jeu est unique ; le bandeau parle du réglage.
      await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
      await capture(page, `pupitre-niveau${String(lvl.n)}-avant.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test(`(b) en trajet : lecture seule, la simulation avance, aucune pause, capture`, async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'en' : 'fr';
      const t = T[lang];
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      const c = controls(page, lang);
      const setter: Step = lvl.id === 'level1' ? ['setKp', lvl.win] : ['setKi', lvl.win];
      await run(page, [...TO_CONSOLE, ['interact'], setter]);
      await expect(c.pupitre).toBeVisible();
      await page.keyboard.press('Enter'); // lance depuis le levier
      // Lancé : le pupitre de réglage se range, la scène montre le trajet.
      await expect(c.pupitre).toBeHidden();
      let s = await run(page, [['advance', 0.5]]);
      expect(s.phase).toBe('trip');
      // E l'ouvre en lecture seule, sans pause.
      await page.keyboard.press('e');
      await expect(c.pupitre).toBeVisible();
      s = await run(page, []);
      expect(s.phase).toBe('trip');
      expect(s.resumePhase).toBeNull();
      await expect(c.kpSlider).toBeDisabled();
      await expect(c.kiSlider).toBeDisabled();
      await expect(c.kpField).toBeDisabled();
      await expect(c.kiField).toBeDisabled();
      await expect(c.launch).toBeHidden();
      await expect(c.restart).toBeVisible();
      await expect(c.restart).toBeEnabled();
      await expect(c.close).toBeFocused();
      // Les valeurs du réglage utilisé restent affichées.
      await expect(lvl.id === 'level1' ? c.kpField : c.kiField).toHaveValue(String(lvl.win));
      // La simulation continue avec le pupitre ouvert : le temps avance, toujours en trajet.
      const before = (await run(page, [])).t;
      await run(page, [['advance', 0.3]]);
      const after = await run(page, []);
      expect(after.t).toBeGreaterThan(before + 0.2);
      expect(after.phase === 'trip' || after.phase === 'outcome').toBe(true);
      expect(after.phase).not.toBe('paused');
      // Le réglage ne bouge pas : ni touches, ni commandes.
      await page.keyboard.press('+');
      await page.keyboard.press('PageUp');
      expect((await run(page, [])).kp).toBe(lvl.id === 'level1' ? lvl.win : 2500);
      expect((await run(page, [])).ki).toBe(lvl.id === 'level2' ? lvl.win : 0);
      await run(page, [['advance', 0.2]]);
      await capture(page, `pupitre-niveau${String(lvl.n)}-trajet.png`);
      // Échap ferme le pupitre sans mettre en pause ; E le rouvre ; E le referme.
      await page.keyboard.press('Escape');
      await expect(c.pupitre).toBeHidden();
      expect((await run(page, [])).phase).not.toBe('paused');
      await page.keyboard.press('e');
      await expect(c.pupitre).toBeVisible();
      await page.keyboard.press('e');
      await expect(c.pupitre).toBeHidden();
      // Le bouton « Pupitre » de la barre du haut l'ouvre aussi, et le referme.
      const button = page.getByRole('button', { name: t('pupitre.titre'), exact: true });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      await expect(c.pupitre).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await c.close.click();
      await expect(c.pupitre).toBeHidden();
      await expect(button).toBeFocused();
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test(`(c) à l'issue : valeurs du dernier réglage, boutons de l'issue accessibles, R rejoue, capture`, async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const t = T[lang];
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      const c = controls(page, lang);
      const setter: Step = lvl.id === 'level1' ? ['setKp', lvl.win] : ['setKi', lvl.win];
      await run(page, [...TO_CONSOLE, ['interact'], setter, ['launch'], ['advance', 8]]);
      expect((await run(page, [])).phase).toBe('outcome');
      const outcome = page.locator('#ui .ui-outcome');
      await expect(outcome).toBeVisible();
      await page.keyboard.press('e');
      await expect(c.pupitre).toBeVisible();
      await expect(lvl.id === 'level1' ? c.kpField : c.kiField).toHaveValue(String(lvl.win));
      await expect(c.kpSlider).toBeDisabled();
      await expect(c.launch).toBeVisible();
      await expect(c.launch).toBeDisabled();
      // L'issue se replie dans la bande du bas : titre et boutons visibles, au-dessus du pupitre.
      await expect(outcome).toHaveClass(/is-docked/);
      await expect(outcome.getByRole('button', { name: t('level1.replay') })).toBeVisible();
      await expect(outcome.getByRole('button', { name: t('controls.menu') })).toBeVisible();
      if (lvl.id === 'level1') {
        await expect(outcome.getByRole('button', { name: t('controls.nextLevel') })).toBeVisible();
      }
      const box = await outcome.boundingBox();
      expect(box).not.toBeNull();
      const pupitreBox = await c.pupitre.boundingBox();
      if (box !== null && pupitreBox !== null) {
        expect(box.y).toBeGreaterThanOrEqual(pupitreBox.y + pupitreBox.height - 1);
        expect(box.y + box.height).toBeLessThanOrEqual(720);
      }
      // Chaque bouton de l'issue reçoit bien les clics (rien ne les recouvre).
      const buttons = await outcome.getByRole('button').all();
      for (const b of buttons) {
        if (!(await b.isVisible())) continue;
        const ok = await b.evaluate((node) => {
          const r = node.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === node || node.contains(hit);
        });
        expect(ok, await b.innerText()).toBe(true);
      }
      await capture(page, `pupitre-niveau${String(lvl.n)}-issue.png`);
      // Tab reste dans le pupitre et l'issue repliée : Rejouer est atteignable au clavier.
      const reachable = new Set<string>();
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        reachable.add(
          await page.evaluate(() => {
            const a = document.activeElement;
            return a instanceof HTMLElement
              ? a.innerText || a.getAttribute('aria-label') || ''
              : '';
          }),
        );
      }
      expect(reachable.has(t('level1.replay'))).toBe(true);
      expect(reachable.has(t('controls.menu'))).toBe(true);
      // R rejoue, pupitre ouvert : retour au réglage, pupitre libre et focalisé.
      await page
        .locator('body')
        .click({ position: { x: 640, y: 300 } })
        .catch(() => undefined);
      await page.keyboard.press('r');
      const after = await run(page, []);
      expect(after.phase).toBe('tuning');
      await expect(c.pupitre).toBeVisible();
      await expect(lvl.id === 'level1' ? c.kpSlider : c.kiSlider).toBeEnabled();
      await expect(lvl.id === 'level1' ? c.kpSlider : c.kiSlider).toBeFocused();
      await expect(outcome).toBeHidden();
      await expect(lvl.id === 'level1' ? c.kpField : c.kiField).toHaveValue(String(lvl.win));
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });
  });
}

test('(d) clavier : Tab et Maj+Tab piégés, flèches, Page, Début, Fin, Entrée dans le champ, Échap', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  const c = controls(page, 'fr');
  await run(page, TO_CONSOLE);
  await page.keyboard.press('e');
  await expect(c.kpSlider).toBeFocused();
  // Ordre logique : levier, champ, Lancer, Fermer, puis retour au levier (Ki hors service : sauté).
  const order: Locator[] = [c.kpField, c.launch, c.close, c.kpSlider];
  for (const next of order) {
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(c.close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(c.launch).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(c.kpField).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(c.kpSlider).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(c.close).toBeFocused();
  // Levier : flèches (± 100), Page (± 1000), Début et Fin (bornes).
  await page.keyboard.press('Tab');
  await expect(c.kpSlider).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(c.kpSlider).toHaveValue('2100');
  await page.keyboard.press('ArrowRight');
  await expect(c.kpSlider).toHaveValue('2200');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await expect(c.kpSlider).toHaveValue('2000');
  await page.keyboard.press('PageUp');
  await expect(c.kpSlider).toHaveValue('3000');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect(c.kpSlider).toHaveValue('1000');
  await page.keyboard.press('End');
  await expect(c.kpSlider).toHaveValue('8000');
  await page.keyboard.press('PageUp');
  await expect(c.kpSlider).toHaveValue('8000');
  await page.keyboard.press('Home');
  await expect(c.kpSlider).toHaveValue('0');
  await page.keyboard.press('PageDown');
  await expect(c.kpSlider).toHaveValue('0');
  // Champ : saisie, Entrée valide sans lancer, valeur hors bornes ramenée, Échap annule.
  await page.keyboard.press('Tab');
  await expect(c.kpField).toBeFocused();
  await c.kpField.fill('3470');
  await page.keyboard.press('Enter');
  await expect(c.kpField).toHaveValue('3500');
  await expect(c.kpSlider).toHaveValue('3500');
  expect((await run(page, [])).phase).toBe('tuning');
  await c.kpField.fill('99999');
  await page.keyboard.press('Enter');
  await expect(c.kpField).toHaveValue('8000');
  await c.kpField.fill('1234');
  await page.keyboard.press('Escape');
  // Échap ferme le pupitre (retour à l'approche) ; la saisie annulée n'a rien changé.
  await expect(c.pupitre).toBeHidden();
  const s = await run(page, []);
  expect(s.phase).toBe('approach');
  expect(s.kp).toBe(8000);
  // E le rouvre ; Fermer le referme.
  await page.keyboard.press('e');
  await expect(c.pupitre).toBeVisible();
  await c.close.click();
  await expect(c.pupitre).toBeHidden();
  expect((await run(page, [])).phase).toBe('approach');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(e) souris : manette tirée le long de la fente, Lancer au clic, console de la scène', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  const c = controls(page, 'fr');
  // Clic sur la console de la scène : ouvre le pupitre (en approche, par le réglage).
  const f = computeFrame(1280, 720);
  const consoleX = worldXToPixel(f, 1280, CONSOLE_X);
  const consoleY = worldYToPixel(f, 720, CONSOLE_ANCHOR_Y - 0.3);
  await run(page, [['moveRight'], ['advance', 2.6], ['stop']]);
  await expect(c.pupitre).toBeHidden();
  await page.mouse.click(consoleX, consoleY);
  await expect(c.pupitre).toBeVisible();
  expect((await run(page, [])).phase).toBe('tuning');
  // Zone du levier : haut = 8000, bas = 0, par pas de 100.
  const zone = c.pupitre.locator('.ui-pupitre-zone').first();
  const zb = await zone.boundingBox();
  expect(zb).not.toBeNull();
  if (zb === null) return;
  const x = zb.x + zb.width / 2;
  await page.mouse.move(x, zb.y + zb.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, zb.y + 6);
  await page.mouse.up();
  const top = (await run(page, [])).kp;
  expect(top).toBeGreaterThanOrEqual(7500);
  await page.mouse.move(x, zb.y + zb.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, zb.y + zb.height - 4);
  await page.mouse.up();
  expect((await run(page, [])).kp).toBeLessThanOrEqual(500);
  // Le levier a pris le focus ; la valeur est un multiple du pas.
  await expect(c.kpSlider).toBeFocused();
  expect((await run(page, [])).kp % 100).toBe(0);
  await c.kpField.fill('2500');
  await c.kpField.press('Enter');
  await c.launch.click();
  const s = await run(page, [['advance', 0.5]]);
  expect(s.phase).toBe('trip');
  expect(s.kp).toBe(2500);
  await expect(c.pupitre).toBeHidden();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(f) mouvement réduit : le pupitre ne bouge pas, les leviers sautent à la valeur', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  const c = controls(page, 'fr');
  await run(page, TO_CONSOLE);
  await page.keyboard.press('e');
  await expect(c.pupitre).toBeVisible();
  const transitions = await page.evaluate(() => {
    const out: string[] = [];
    for (const node of document.querySelectorAll('#ui .ui-pupitre, #ui .ui-pupitre *')) {
      const s = getComputedStyle(node);
      if (s.transitionDuration !== '0s' || s.animationName !== 'none') out.push(node.tagName);
    }
    return out;
  });
  expect(transitions).toEqual([]);
  await page.keyboard.press('PageUp');
  await expect(c.kpSlider).toHaveValue('3000');
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(g) petite fenêtre 1024×576 et portrait 390×844 : le pupitre tient, les boutons restent visibles', async ({
  page,
}) => {
  for (const size of [
    { width: 1024, height: 576 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    const problems = await open(page, 'e2e=1&screen=level2&lang=fr', size);
    const c = controls(page, 'fr');
    await run(page, TO_CONSOLE);
    await page.keyboard.press('e');
    await expect(c.pupitre).toBeVisible();
    for (const control of [c.kiSlider, c.kiField, c.launch, c.close]) {
      const b = await control.boundingBox();
      expect(b, `${String(size.width)}×${String(size.height)}`).not.toBeNull();
      if (b === null) continue;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(size.height + 0.5);
    }
    // Les boutons de la barre du haut ne sont pas recouverts par le pupitre.
    const top = await page.locator('#ui .ui-help-btn').boundingBox();
    expect(top).not.toBeNull();
    const pb = await c.pupitre.boundingBox();
    if (top !== null && pb !== null) expect(top.y + top.height).toBeLessThanOrEqual(pb.y + 1);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  }
});

test('(h) valeurs lues aux lecteurs d’écran : aria-valuetext, description, annonce unique à l’issue', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level2&lang=en');
  const c = controls(page, 'en');
  const t = T.en;
  await run(page, [...TO_CONSOLE, ['interact'], ['setKi', 800]]);
  await expect(c.kiSlider).toHaveAttribute(
    'aria-valuetext',
    t('level2.ki.valueText').replace('{ki}', '800'),
  );
  await expect(c.kpSlider).toHaveAttribute(
    'aria-valuetext',
    t('level1.kp.valueText').replace('{kp}', '2500'),
  );
  const describedBy = await c.kiSlider.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`#${describedBy ?? 'x'}`)).toHaveText(
    `${t('level2.ki.help')} ${t('level2.ki.range')}`,
  );
  const live = page.locator('[aria-live="polite"]');
  await run(page, [['launch'], ['advance', 0.2]]);
  await page.keyboard.press('e');
  await expect(c.pupitre).toBeVisible();
  // Pas de bavardage par pas de simulation : l'annonce du pupitre n'a lieu qu'à l'issue.
  await run(page, [['advance', 2]]);
  await expect(live).not.toContainText('Control desk: last setting');
  await run(page, [['advance', 6]]);
  expect((await run(page, [])).phase).toBe('outcome');
  await expect(live).toContainText('Control desk: last setting Kp = 2500 · Ki = 800.');
  await expect(live.locator('p', { hasText: 'Control desk: last setting' })).toHaveCount(1);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
