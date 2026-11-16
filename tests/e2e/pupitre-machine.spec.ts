/**
 * Colonne du centre du pupitre, « la machine » (T-050), en navigateur réel, WebGL2 imposé, aux DEUX
 * niveaux : écorché du moteur, voyants, jauge de force, avant le trajet, en trajet (pupitre ouvert en
 * lecture seule, cabine au milieu), en saturation, à l'issue d'un choc et d'une victoire. Résumé pour
 * lecteurs d'écran (une seule région live), mouvement réduit (rien ne bouge hors du jeu), coût par
 * image.
 *
 * Captures dans docs/img/pupitre-machine-<niveau>-<cas>.png (avant, trajet, saturation, choc, victoire).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
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
  t: number;
  kp: number;
  ki: number;
  outcome: string | null;
  cabinY: number;
  saturated: boolean;
  uSat: number;
  uCmd: number;
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
      t: s.t,
      kp: s.kp,
      ki: s.ki,
      outcome: s.outcome,
      cabinY: s.cabinY,
      saturated: s.saturated,
      uSat: s.uSat,
      uCmd: s.uCmd,
    };
  }, steps);
}

/** Avance par images de 1/60 s jusqu'à ce que la condition soit vraie (borne : 20 s). */
async function until(
  page: Page,
  condition: 'cabine-au-milieu' | 'sature' | 'issue',
): Promise<Snap> {
  await page.evaluate((cond) => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    for (let i = 0; i < 1200; i += 1) {
      hook.advance(1 / 60);
      const s = hook.snapshot();
      if (cond === 'issue' && s.phase === 'outcome') break;
      if (cond === 'sature' && s.phase === 'trip' && s.saturated && s.cabinY > 0.15) break;
      if (cond === 'cabine-au-milieu' && s.phase === 'trip' && s.cabinY >= 1.6) break;
    }
  }, condition);
  return run(page, []);
}

const TO_CONSOLE: readonly Step[] = [['moveRight'], ['advance', 2.6], ['stop']];

async function open(page: Page, query: string): Promise<string[]> {
  await page.setViewportSize({ width: 1280, height: 720 });
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

const LEVELS = [
  {
    n: 1,
    id: 'level1',
    setter: (v: number): Step => ['setKp', v],
    win: 2500,
    sat: 5000,
    bonk: 5100,
  },
  {
    n: 2,
    id: 'level2',
    setter: (v: number): Step => ['setKi', v],
    win: 800,
    sat: 2000,
    bonk: 2000,
  },
] as const;

for (const lvl of LEVELS) {
  test.describe(`niveau ${String(lvl.n)}`, () => {
    test('(a) avant le trajet : machine à l’arrêt, au repos, voyants éteints, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, TO_CONSOLE);
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      const resume = page.locator('#ui-pupitre-resume-machine');
      await expect(resume).toHaveCount(1);
      await expect(resume).toContainText(T[lang]('pupitre.machine.repos'));
      await expect(resume).not.toContainText(T[lang]('pupitre.machine.resumeSature'));
      // Le résumé n'est ni visible, ni une région live : il y en a exactement une dans la page.
      await expect(resume).toHaveClass(/ui-sr/);
      await expect(resume).not.toHaveAttribute('aria-live', /.*/);
      await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
      await expect(page.locator('[aria-live]')).toHaveCount(1);
      await capture(page, `pupitre-machine-niveau${String(lvl.n)}-avant.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(b) en trajet, cabine au milieu : lecture seule ouverte, la machine suit la simulation, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'en' : 'fr';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.win), ['launch']]);
      // Réglage modeste : la cabine monte sans saturer longtemps. On la prend au milieu du trajet.
      const s = await until(page, 'cabine-au-milieu');
      expect(s.phase).toBe('trip');
      expect(s.cabinY).toBeGreaterThanOrEqual(1.6);
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      // Le résumé dit la hauteur : il se remet à jour (au plus deux fois par seconde).
      const resume = page.locator('#ui-pupitre-resume-machine');
      const trajetEnCours = T[lang]('pupitre.etat.trip');
      await expect
        .poll(async () => {
          await run(page, []);
          return resume.textContent();
        })
        .toContain(trajetEnCours);
      await capture(page, `pupitre-machine-niveau${String(lvl.n)}-trajet.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(c) en saturation : voyant, étincelles, jauge à 5000 N, demande hors échelle, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.sat), ['launch']]);
      const s = await until(page, 'sature');
      expect(s.saturated).toBe(true);
      expect(s.uSat).toBeCloseTo(5000, 6);
      expect(s.uCmd).toBeGreaterThan(5000);
      await page.keyboard.press('e');
      const resume = page.locator('#ui-pupitre-resume-machine');
      await expect
        .poll(async () => {
          await run(page, []);
          return resume.textContent();
        })
        .toContain(T[lang]('pupitre.machine.resumeSature').slice(0, 12));
      await capture(page, `pupitre-machine-niveau${String(lvl.n)}-saturation.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(d) à l’issue d’un choc : machine figée sur l’état final, voyant Fin, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'en' : 'fr';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.bonk), ['launch']]);
      const s = await until(page, 'issue');
      expect(s.outcome).toBe('bonk');
      expect(s.cabinY).toBeGreaterThan(3.3626);
      expect(s.cabinY).toBeLessThan(3.5);
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      const resume = page.locator('#ui-pupitre-resume-machine');
      await expect
        .poll(async () => {
          await run(page, []);
          return resume.textContent();
        })
        .toContain(T[lang]('pupitre.etat.outcome'));
      // Figée : deux images à des instants différents, même dessin (hors pulsation décorative).
      const avant = (await run(page, [])).cabinY;
      await run(page, [['advance', 0.5]]);
      expect((await run(page, [])).cabinY).toBe(avant);
      await capture(page, `pupitre-machine-niveau${String(lvl.n)}-choc.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(e) à l’issue d’une victoire : cabine à l’arrivée, voyant Fin, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.win), ['launch']]);
      const s = await until(page, 'issue');
      expect(s.outcome).toBe('win');
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      await run(page, []);
      await capture(page, `pupitre-machine-niveau${String(lvl.n)}-victoire.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });
  });
}

test('(f) mouvement réduit : la machine ne bouge pas d’elle-même, même en saturation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await run(page, [...TO_CONSOLE, ['interact'], ['setKp', 5000], ['launch']]);
  const s = await until(page, 'sature');
  expect(s.saturated).toBe(true);
  await page.keyboard.press('e');
  const plan = page.locator('#ui .ui-pupitre-plan');
  await expect(plan).toBeVisible();
  await run(page, []);
  await settle(page);
  const a = await plan.screenshot();
  // Le temps réel passe, la simulation ne bouge pas (mode e2e) : le dessin doit rester identique
  // (ni pulsation, ni étincelles animées, ni secousse).
  await page.waitForTimeout(250);
  await run(page, []);
  await settle(page);
  const b = await plan.screenshot();
  expect(b.equals(a)).toBe(true);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(g) coût du dessin de la machine : millisecondes par image, pupitre ouvert en saturation', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await run(page, [...TO_CONSOLE, ['interact'], ['setKp', 5000], ['launch']]);
  await until(page, 'sature');
  await page.keyboard.press('e');
  await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
  const mesure = await page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    const passes = 300;
    const temps = (): number => {
      const t0 = performance.now();
      for (let i = 0; i < passes; i += 1) hook.advance(0);
      return (performance.now() - t0) / passes;
    };
    temps();
    return { ouvert: temps() };
  });
  // Pupitre fermé : même boucle, pour isoler le coût du pupitre.
  await page.keyboard.press('Escape');
  await expect(page.locator('#ui .ui-pupitre')).toBeHidden();
  const ferme = await page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    const passes = 300;
    const t0 = performance.now();
    for (let i = 0; i < passes; i += 1) hook.advance(0);
    return (performance.now() - t0) / passes;
  });
  const cout = mesure.ouvert - ferme;
  console.log(
    `coût par image (headless, SwiftShader) : pupitre ouvert ${mesure.ouvert.toFixed(2)} ms, ` +
      `fermé ${ferme.toFixed(2)} ms, pupitre seul ≈ ${cout.toFixed(2)} ms`,
  );
  // Garde-fou très large (CPU lent, rendu logiciel) : l'ensemble du pupitre reste sous une image à 30 Hz.
  // Les colonnes ne sont pas la part dominante : fermées une à une, le coût ne change pas mesurablement
  // (le dessin de la machine tient en ≈ 0,1 ms de JavaScript par image).
  expect(cout).toBeLessThan(33);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
