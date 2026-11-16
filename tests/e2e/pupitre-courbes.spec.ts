/**
 * Colonne de droite du pupitre, « les courbes » (T-051), en navigateur réel, WebGL2 imposé, aux DEUX
 * niveaux : quatre enregistreurs à papier tracés en direct d'après le journal du trajet, curseur à
 * l'issue (souris, clavier, accessible) qui fait suivre la machine du centre, retour au direct au
 * nouveau trajet, résumé pour lecteurs d'écran, jeu inchangé par le curseur.
 *
 * Captures dans docs/img/pupitre-courbes-<niveau>-<cas>.png (avant, trajet, saturation, curseur,
 * victoire).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
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
  k: number;
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
      k: s.k,
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

/** Le curseur du trajet (champ accessible) dans la langue donnée. */
function curseurDe(page: Page, lang: Lang): Locator {
  return page.getByRole('slider', { name: T[lang]('pupitre.courbes.curseur.label') });
}

/** Valeur du curseur (entier). */
async function indiceDe(curseur: Locator): Promise<number> {
  return Number(await curseur.inputValue());
}

/** Relit le résumé d'une colonne après avoir fait avancer l'interface (au plus deux fois par seconde). */
async function resume(page: Page, colonne: 'courbes' | 'machine'): Promise<string> {
  await run(page, []);
  return (await page.locator(`#ui-pupitre-resume-${colonne}`).textContent()) ?? '';
}

for (const lvl of LEVELS) {
  test.describe(`niveau ${String(lvl.n)}`, () => {
    test('(a) avant le trajet : papier propre, échelles visibles, pas de curseur, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, TO_CONSOLE);
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      const r = page.locator('#ui-pupitre-resume-courbes');
      await expect(r).toHaveCount(1);
      await expect(r).toHaveClass(/ui-sr/);
      await expect(r).not.toHaveAttribute('aria-live', /.*/);
      await expect(page.locator('[aria-live]')).toHaveCount(1);
      await expect.poll(() => resume(page, 'courbes')).toContain(lang === 'fr' ? 'vides' : 'empty');
      await expect(curseurDe(page, lang)).toBeHidden();
      await expect(page.locator('.ui-pupitre-zone-courbes')).toBeHidden();
      await capture(page, `pupitre-courbes-niveau${String(lvl.n)}-avant.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(b) en trajet : courbes tracées en direct, lecture seule, pas de curseur, jeu non pausé, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'en' : 'fr';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.win), ['launch']]);
      const s = await until(page, 'cabine-au-milieu');
      expect(s.phase).toBe('trip');
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      await expect(curseurDe(page, lang)).toBeHidden();
      await expect(page.locator('.ui-pupitre-zone-courbes')).toBeHidden();
      // Le résumé donne l'instant : il avance avec le trajet.
      const mot = lang === 'fr' ? 'Instant' : 'At ';
      await expect.poll(() => resume(page, 'courbes')).toContain(mot);
      const avant = await resume(page, 'courbes');
      // Le jeu continue (aucune pause) : le temps de simulation avance, les courbes avec lui.
      const apres = await run(page, [['advance', 0.4]]);
      expect(apres.phase).toBe('trip');
      expect(apres.t).toBeGreaterThan(s.t + 0.3);
      await expect.poll(() => resume(page, 'courbes')).not.toBe(avant);
      await capture(page, `pupitre-courbes-niveau${String(lvl.n)}-trajet.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(c) en saturation : demande hors échelle écrêtée avec chevron, zone rouge, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.sat), ['launch']]);
      const s = await until(page, 'sature');
      expect(s.saturated).toBe(true);
      // Quelques images de plus : la plume a laissé une trace avant la capture.
      await run(page, [['advance', 0.3]]);
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      await run(page, []);
      await capture(page, `pupitre-courbes-niveau${String(lvl.n)}-saturation.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(d) à l’issue : curseur à la fin, au clavier, à la souris ; la machine suit ; le jeu ne bouge pas, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'en' : 'fr';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.bonk), ['launch']]);
      const fin = await until(page, 'issue');
      expect(fin.outcome).toBe('bonk');
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      const curseur = curseurDe(page, lang);
      await expect(curseur).toBeVisible();
      await expect(curseur).toHaveAttribute('type', 'range');
      await run(page, []);
      // Par défaut à la fin : valeur maximale, nombre de pas du journal.
      const count = Number(await curseur.getAttribute('max'));
      expect(count).toBe(fin.k);
      expect(await indiceDe(curseur)).toBe(count);
      const snapAvant = await page.evaluate(() => JSON.stringify(window.__huygens?.snapshot()));
      const machineFin = await resume(page, 'machine');
      expect(machineFin).toContain(lang === 'fr' ? 'Cabine à' : 'Cabin at');

      // Clavier : Début, flèches ±1, Page ±10, Fin.
      await curseur.focus();
      await page.keyboard.press('Home');
      expect(await indiceDe(curseur)).toBe(0);
      await page.keyboard.press('ArrowRight');
      expect(await indiceDe(curseur)).toBe(1);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');
      expect(await indiceDe(curseur)).toBe(1);
      await page.keyboard.press('PageUp');
      expect(await indiceDe(curseur)).toBe(11);
      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
      expect(await indiceDe(curseur)).toBe(0);
      await page.keyboard.press('End');
      expect(await indiceDe(curseur)).toBe(count);
      // Le texte lu dit l'instant et les valeurs.
      await page.keyboard.press('Home');
      await expect(curseur).toHaveAttribute(
        'aria-valuetext',
        lang === 'fr' ? /^t = 0,00\ss\s: erreur/ : /^t = 0\.00\ss: error/,
      );

      // Souris : un clic au milieu du trajet (la durée affichée est de 10 s, le trajet dure k pas).
      const zone = page.locator('.ui-pupitre-zone-courbes');
      const boite = await zone.boundingBox();
      if (boite === null) throw new Error('zone du curseur absente');
      const capacite = 1200;
      const cible = Math.round(count / 2);
      const xCible = boite.x + (cible / capacite) * boite.width;
      await page.mouse.click(xCible, boite.y + boite.height / 3);
      expect(Math.abs((await indiceDe(curseur)) - cible)).toBeLessThanOrEqual(2);
      // Glisser vers la droite au-delà de la fin du trajet : borné à count.
      await page.mouse.move(xCible, boite.y + 20);
      await page.mouse.down();
      await page.mouse.move(boite.x + boite.width - 2, boite.y + 20, { steps: 6 });
      await page.mouse.up();
      expect(await indiceDe(curseur)).toBe(count);

      // La machine du centre montre la cabine à l'instant du curseur : la hauteur lue change.
      const cabine = async (): Promise<string> => {
        const texte = await resume(page, 'machine');
        const m = /(?:Cabine à|Cabin at) ([−\d,.]+)/.exec(texte);
        if (m === null) throw new Error(`hauteur absente : ${texte}`);
        return m[1] ?? '';
      };
      const zero = lang === 'fr' ? '0,00' : '0.00';
      await curseur.focus();
      await page.keyboard.press('Home');
      // Résumé relu au plus toutes les 500 ms : on attend qu'il change.
      await expect.poll(cabine).toBe(zero);
      await page.keyboard.press('End');
      await expect.poll(cabine).not.toBe(zero);
      const yFin = await cabine();
      await page.mouse.click(xCible, boite.y + boite.height / 3);
      await expect.poll(cabine).not.toBe(yFin);
      // Ni l'issue, ni l'instantané du jeu n'ont changé.
      expect(await page.evaluate(() => JSON.stringify(window.__huygens?.snapshot()))).toBe(
        snapAvant,
      );
      const apres = await run(page, [['advance', 0.5]]);
      expect(apres.outcome).toBe('bonk');
      expect(await page.evaluate(() => JSON.stringify(window.__huygens?.snapshot()))).toBe(
        snapAvant,
      );
      // Le curseur reste là où on l'a laissé : capture au milieu du trajet.
      expect(Math.abs((await indiceDe(curseur)) - cible)).toBeLessThanOrEqual(2);
      await capture(page, `pupitre-courbes-niveau${String(lvl.n)}-curseur.png`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('(e) victoire : courbes finies, curseur à la fin ; un nouveau trajet vide les courbes et retire le curseur, capture', async ({
      page,
    }) => {
      const lang: Lang = lvl.n === 1 ? 'fr' : 'en';
      const problems = await open(page, `e2e=1&screen=${lvl.id}&lang=${lang}`);
      await run(page, [...TO_CONSOLE, ['interact'], lvl.setter(lvl.win), ['launch']]);
      const s = await until(page, 'issue');
      expect(s.outcome).toBe('win');
      await page.keyboard.press('e');
      await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
      const curseur = curseurDe(page, lang);
      await expect(curseur).toBeVisible();
      await run(page, []);
      await capture(page, `pupitre-courbes-niveau${String(lvl.n)}-victoire.png`);
      // Retour au direct : le trajet recommence, le journal se vide, le curseur disparaît.
      await run(page, [['restart']]);
      await expect(curseur).toBeHidden();
      await expect.poll(() => resume(page, 'courbes')).toContain(lang === 'fr' ? 'vides' : 'empty');
      await run(page, [lvl.setter(lvl.sat), ['launch'], ['advance', 0.5]]);
      await expect(curseur).toBeHidden();
      await expect(page.locator('.ui-pupitre-zone-courbes')).toBeHidden();
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });
  });
}

test('(f) clavier : les touches du curseur ne règlent pas Kp, Échap ferme le pupitre', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await run(page, [...TO_CONSOLE, ['interact'], ['setKp', 5100], ['launch']]);
  await until(page, 'issue');
  await page.keyboard.press('e');
  await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
  const curseur = curseurDe(page, 'fr');
  await expect(curseur).toBeVisible();
  await curseur.focus();
  const kpAvant = (await run(page, [])).kp;
  await page.keyboard.press('PageUp');
  expect((await run(page, [])).kp).toBe(kpAvant);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ui .ui-pupitre')).toBeHidden();
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(g) en mouvement réduit : le curseur saute sans animation, le dessin est stable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  await run(page, [...TO_CONSOLE, ['interact'], ['setKp', 5000], ['launch']]);
  await until(page, 'issue');
  await page.keyboard.press('e');
  const curseur = curseurDe(page, 'fr');
  await expect(curseur).toBeVisible();
  await curseur.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await run(page, []);
  await settle(page);
  const plan = page.locator('#ui .ui-pupitre-plan');
  const a = await plan.screenshot();
  await page.waitForTimeout(250);
  await run(page, []);
  await settle(page);
  const b = await plan.screenshot();
  // Plus rien ne bouge d'elle-même (ni pulsation, ni étincelles, ni secousse), curseur compris.
  expect(b.equals(a)).toBe(true);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('(h) coût par image avec un long trajet : le tracé des courbes reste fluide', async ({
  page,
}) => {
  const problems = await open(page, 'e2e=1&screen=level1&lang=fr');
  // Kp faible : la cabine monte lentement, le trajet est long.
  await run(page, [...TO_CONSOLE, ['interact'], ['setKp', 600], ['launch']]);
  const s = await until(page, 'issue');
  await page.keyboard.press('e');
  await expect(page.locator('#ui .ui-pupitre')).toBeVisible();
  const mesure = await page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('window.__huygens absent');
    const passes = 300;
    for (let i = 0; i < 30; i += 1) hook.advance(0);
    const t0 = performance.now();
    for (let i = 0; i < passes; i += 1) hook.advance(0);
    return (performance.now() - t0) / passes;
  });
  console.log(`trajet de ${String(s.k)} pas, pupitre ouvert : ${mesure.toFixed(2)} ms par image`);
  // Garde-fou très large (rendu logiciel SwiftShader : la scène 3D domine) ; le coût JavaScript du
  // pupitre seul est mesuré à part (voir le compte rendu de T-051).
  expect(mesure).toBeLessThan(60);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
