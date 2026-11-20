/**
 * Tableau d'école (T-042), navigateur réel, WebGL2 imposé, `?e2e=1` : la touche T et le clic sur le
 * chevalet l'ouvrent aux deux niveaux ; fenêtre modale (focus, Échap, clic hors du tableau, double
 * activation) ; pause du trajet et reprise à la fermeture ; exclusion avec l'aide ; formules MathML
 * présentes et rendues ; valeurs de Kp et Ki lues en direct dans l'instantané ; aucune commande du
 * jeu tant qu'il est ouvert ; tenue dans 1280×720 et 390×844. Captures dans docs/img/t042-*.png.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
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
const FR = catalog('fr');
const EN = catalog('en');
const NB = ' ';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

const LEVELS = [
  { id: 'level1', win: 2500 },
  { id: 'level2', win: 800 },
] as const;
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;

async function open(
  page: Page,
  id: string,
  lang: Lang = 'fr',
  size: { width: number; height: number } = { width: 1280, height: 720 },
): Promise<string[]> {
  await page.setViewportSize(size);
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&lang=${lang}&e2e=1&screen=${id}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  await page.waitForFunction(() => window.__huygens !== undefined);
  return problems;
}

/** Règle la grandeur du niveau (Kp au niveau 1, Ki au niveau 2) et ouvre le réglage. */
async function tune(page: Page, id: string, value: number): Promise<void> {
  await page.evaluate(
    ([level, v]) => {
      const hook = window.__huygens;
      if (hook === undefined) throw new Error('crochet absent');
      hook.commands.interact();
      if (level === 'level2') hook.commands.setKi(v);
      else hook.commands.setKp(v);
      hook.advance(0);
    },
    [id, value] as const,
  );
}

/** Amène le niveau en plein trajet (une seconde de trajet écoulée). */
async function toTrip(page: Page, id: string, value: number): Promise<void> {
  await tune(page, id, value);
  await page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('crochet absent');
    hook.commands.launch();
    hook.advance(1);
  });
}

interface Snap {
  phase: string;
  t: number;
  attempt: number;
  walkerX: number;
  kp: number;
  ki: number;
}

async function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const hook = window.__huygens;
    if (hook === undefined) throw new Error('crochet absent');
    const s = hook.snapshot();
    return { phase: s.phase, t: s.t, attempt: s.attempt, walkerX: s.walkerX, kp: s.kp, ki: s.ki };
  });
}

async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    window.__huygens?.advance(s);
  }, seconds);
}

/** Centre de la zone cliquable du chevalet (pixels CSS). */
async function easelCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByRole('button', { name: FR('board.open') }).boundingBox();
  if (box === null) throw new Error('chevalet introuvable');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const dialogOf = (page: Page, lang: Lang = 'fr'): Locator =>
  page.getByRole('dialog', { name: (lang === 'fr' ? FR : EN)('board.title') });

for (const lvl of LEVELS) {
  test.describe(lvl.id, () => {
    test('la touche T ouvre le tableau, le trajet est en pause, il reprend à la fermeture, focus rendu', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await toTrip(page, lvl.id, lvl.win);
      const before = await snapshot(page);
      expect(before.phase).toBe('trip');
      const helpButton = page.getByRole('button', { name: FR('controls.help.show') });
      await helpButton.focus();
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(dialog.getByRole('button', { name: FR('board.close') })).toBeFocused();
      await expect(page.locator('#ui .ui-banner')).toContainText(FR('hud.hint.closeBoard'));
      expect((await snapshot(page)).phase).toBe('paused');
      await advance(page, 1);
      expect((await snapshot(page)).t).toBe(before.t);
      // Échap ferme (pas de pause supplémentaire), le trajet reprend, le focus revient au « ? ».
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(helpButton).toBeFocused();
      expect((await snapshot(page)).phase).toBe('trip');
      await advance(page, 0.5);
      expect((await snapshot(page)).t).toBeGreaterThan(before.t);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('T ferme aussi le tableau ; sans focus précis, le focus revient au chevalet', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('t');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: FR('board.open') })).toBeFocused();
      // Une touche maintenue ne referme pas aussitôt le tableau qu'elle vient d'ouvrir.
      await page.keyboard.down('t');
      await page.keyboard.down('t');
      await page.keyboard.up('t');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test("la pause du joueur n'est pas reprise par la fermeture du tableau", async ({ page }) => {
      const problems = await open(page, lvl.id);
      await toTrip(page, lvl.id, lvl.win);
      await page.evaluate(() => window.__huygens?.commands.pause());
      await advance(page, 0);
      expect((await snapshot(page)).phase).toBe('paused');
      await page.keyboard.press('t');
      await expect(dialogOf(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toBeHidden();
      expect((await snapshot(page)).phase).toBe('paused');
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test("le clic sur le chevalet ouvre le tableau ; Fermer, Échap et le clic hors du tableau le ferment ; le double-clic n'ouvre-ferme pas", async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      const opener = page.getByRole('button', { name: FR('board.open') });
      await expect(opener).toBeVisible();
      const dialog = dialogOf(page);
      const { x, y } = await easelCenter(page);
      // Clic réel sur le dessin : en approche, le jeu n'est pas mis en pause.
      await page.mouse.click(x, y);
      await expect(dialog).toBeVisible();
      expect((await snapshot(page)).phase).toBe('approach');
      await dialog.getByRole('button', { name: FR('board.close') }).click();
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
      // Échap.
      await page.mouse.click(x, y);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      // Clic hors du tableau (sur le fond, dans la marge).
      await page.mouse.click(x, y);
      await expect(dialog).toBeVisible();
      await page.mouse.click(4, 4);
      await expect(dialog).toBeHidden();
      // Double-clic (A-01) : le tableau s'ouvre et reste ouvert.
      await page.mouse.dblclick(x, y);
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(150);
      await expect(dialog).toBeVisible();
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('les formules MathML sont présentes et rendues : fractions, indices, accents, intégrale', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await page.keyboard.press('t');
      await expect(dialogOf(page)).toBeVisible();
      const info = await page.evaluate(() => {
        const dialog = document.querySelector('#ui .ui-board');
        if (dialog === null) throw new Error('tableau absent');
        const rect = (e: Element | undefined): { x: number; y: number; w: number; h: number } => {
          if (e === undefined) throw new Error('élément absent');
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const all = (selector: string): Element[] => Array.from(dialog.querySelectorAll(selector));
        return {
          maths: all('math').map((m) => ({
            ns: m.namespaceURI,
            isMathMl: m instanceof MathMLElement,
            label: m.getAttribute('aria-label') ?? '',
            box: rect(m),
          })),
          fracs: all('mfrac').map((f) => ({
            box: rect(f),
            num: rect(f.children[0]),
            den: rect(f.children[1]),
          })),
          movers: all('mover').map((m) => ({
            box: rect(m),
            base: rect(m.children[0]),
            accent: rect(m.children[1]),
          })),
          subs: all('msub').map((m) => ({
            base: rect(m.children[0]),
            sub: rect(m.children[1]),
          })),
          unders: all('munderover').map((u) => ({
            base: rect(u.children[0]),
            lower: rect(u.children[1]),
            upper: rect(u.children[2]),
          })),
        };
      });
      const expected = lvl.id === 'level1' ? 5 : 7;
      expect(info.maths).toHaveLength(expected);
      for (const m of info.maths) {
        expect(m.ns).toBe(MATHML_NS);
        expect(m.isMathMl).toBe(true);
        expect(m.label.length).toBeGreaterThan(5);
        expect(m.box.w).toBeGreaterThan(20);
        expect(m.box.h).toBeGreaterThan(10);
      }
      expect(info.maths[0]?.label).toBe(FR('board.motion.label'));
      // Fraction : le numérateur est au-dessus du dénominateur, tous deux rendus.
      expect(info.fracs).toHaveLength(1);
      for (const f of info.fracs) {
        expect(f.box.h).toBeGreaterThan(f.num.h);
        expect(f.num.w).toBeGreaterThan(20);
        expect(f.den.w).toBeGreaterThan(3);
        expect(f.num.y + f.num.h).toBeLessThanOrEqual(f.den.y + 1);
      }
      // Accents point et double point (ÿ et ẏ, deux fois chacun) : l'accent est au-dessus de la base.
      expect(info.movers).toHaveLength(4);
      for (const m of info.movers) {
        expect(m.accent.w).toBeGreaterThan(0);
        expect(m.accent.y).toBeLessThan(m.base.y + m.base.h);
        expect(m.box.h).toBeGreaterThan(m.base.h - 1);
      }
      // Indices (K_p, u_sat, U_max, et K_i au niveau 2) : l'indice est plus bas et plus petit.
      expect(info.subs.length).toBeGreaterThanOrEqual(lvl.id === 'level1' ? 6 : 8);
      for (const s of info.subs) {
        expect(s.sub.y + s.sub.h / 2).toBeGreaterThan(s.base.y + s.base.h / 2);
      }
      if (lvl.id === 'level2') {
        // Intégrale : borne haute au-dessus, borne basse en dessous.
        expect(info.unders).toHaveLength(1);
        const u = info.unders[0];
        expect(u?.upper.y).toBeLessThan(u?.base.y ?? 0);
        expect(u?.lower.y).toBeGreaterThan(u?.base.y ?? 0);
        expect(u?.base.h).toBeGreaterThan(20);
      } else {
        expect(info.unders).toHaveLength(0);
      }
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('les valeurs de Kp et de Ki affichées sont celles de l’instantané, en direct', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await tune(page, lvl.id, lvl.win);
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      const kpLine = dialog.locator('.ui-board-value-kp');
      const kiLine = dialog.locator('.ui-board-value-ki');
      let s = await snapshot(page);
      if (lvl.id === 'level1') {
        expect(s.kp).toBe(2500);
        await expect(kpLine).toHaveText(`Kp = 2500${NB}N/m`);
        await expect(kiLine).toHaveCount(0);
        // Le tableau suit le réglage en direct.
        await page.evaluate(() => {
          window.__huygens?.commands.setKp(3300);
          window.__huygens?.advance(0);
        });
        s = await snapshot(page);
        expect(s.kp).toBe(3300);
        await expect(kpLine).toHaveText(`Kp = ${String(s.kp)}${NB}N/m`);
        await expect(dialog.getByText(FR('board.law.integral'))).toHaveCount(0);
        await expect(dialog.getByText(FR('board.law.titleP'))).toBeVisible();
      } else {
        expect(s.kp).toBe(2500);
        expect(s.ki).toBe(800);
        await expect(kpLine).toHaveText(`Kp = 2500${NB}N/m (fixé)`);
        await expect(kiLine).toHaveText(`Ki = 800${NB}N/(m·s)`);
        await page.evaluate(() => {
          window.__huygens?.commands.setKi(300);
          window.__huygens?.advance(0);
        });
        s = await snapshot(page);
        expect(s.ki).toBe(300);
        await expect(kiLine).toHaveText(`Ki = ${String(s.ki)}${NB}N/(m·s)`);
        await expect(dialog.getByText(FR('board.law.titlePi'))).toBeVisible();
        await expect(dialog.getByText(FR('board.law.integral'))).toBeVisible();
      }
      // Valeurs du modèle : lues du jeu (m, g, c, r, Umax).
      await expect(dialog).toContainText(`m = 50${NB}kg`);
      await expect(dialog).toContainText(`g = 9,81${NB}m/s²`);
      await expect(dialog).toContainText(`c = 400${NB}N·s/m`);
      await expect(dialog).toContainText(`r = 3${NB}m`);
      await expect(dialog).toContainText(`Umax = 5000${NB}N`);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test("« D'où vient la force ? » : les dessins et les calculs sont ceux de l'instant de la pause", async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await toTrip(page, lvl.id, lvl.win);
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      const forces = dialog.locator('.ui-board-forces');
      await expect(forces.getByRole('heading', { name: FR('board.forces.title') })).toBeVisible();
      // Instantané figé par la pause : les valeurs lues par le tableau.
      const s = await page.evaluate(() => {
        const hook = window.__huygens;
        if (hook === undefined) throw new Error('crochet absent');
        const q = hook.snapshot();
        return {
          phase: q.phase,
          e: q.stepError,
          p: q.pTerm,
          i: q.iTermUsed,
          uCmd: q.uCmd,
          uSat: q.uSat,
          saturated: q.saturated,
          v: q.stepVelocity,
          kp: q.kp,
          ki: q.ki,
        };
      });
      expect(s.phase).toBe('paused');
      const fmt = (v: number, d = 0): string =>
        new Intl.NumberFormat('fr', { maximumFractionDigits: d, useGrouping: false })
          .format(v)
          .replace('-', '−');
      await expect(forces.locator('.ui-board-forces-idle')).toBeHidden();
      // Ressort P, butée, bilan : présents aux deux niveaux ; le bocal au niveau 2 seulement.
      const cards = forces.locator('.ui-board-card');
      await expect(cards).toHaveCount(lvl.id === 'level1' ? 3 : 4);
      await expect(forces.locator('.ui-board-card-i')).toHaveCount(lvl.id === 'level1' ? 0 : 1);
      await expect(forces.locator('.ui-board-card-p .ui-board-calc').nth(1)).toContainText(
        `P = Kp × e = ${fmt(s.kp)} × ${fmt(s.e, 3)} = ${fmt(s.p)}${NB}N`,
      );
      await expect(forces.locator('.ui-board-card-stop .ui-board-calc').nth(0)).toContainText(
        `${fmt(s.uCmd)}${NB}N`,
      );
      await expect(forces.locator('.ui-board-card-stop .ui-board-calc').nth(1)).toContainText(
        `${fmt(s.uSat)}${NB}N`,
      );
      await expect(forces.locator('.ui-board-card-stop .ui-board-calc').nth(2)).toHaveText(
        s.saturated ? new RegExp('N en trop') : FR('board.forces.stop.ok'),
      );
      const bal = forces.locator('.ui-board-card-bal .ui-board-calc');
      await expect(bal.nth(0)).toContainText(`T = ${fmt(s.uSat)}${NB}N`);
      await expect(bal.nth(1)).toContainText(`m·g = 50 × 9,81 = 491${NB}N`);
      if (lvl.id === 'level2') {
        await expect(forces.locator('.ui-board-card-i .ui-board-calc').nth(1)).toContainText(
          `I = Ki × ∫e dt = ${fmt(s.ki)}`,
        );
        await expect(forces.locator('.ui-board-card-i .ui-board-calc').nth(1)).toContainText(
          `= ${fmt(s.i)}${NB}N`,
        );
      }
      // Chaque dessin est une image nommée, avec les valeurs.
      const svgs = forces.locator('svg[role="img"]');
      await expect(svgs).toHaveCount(lvl.id === 'level1' ? 3 : 4);
      for (let n = 0; n < (await svgs.count()); n += 1) {
        const name = await svgs.nth(n).getAttribute('aria-label');
        expect(name?.length ?? 0).toBeGreaterThan(30);
      }
      await expect(forces.locator('.ui-board-card-p svg')).toHaveAttribute(
        'aria-label',
        new RegExp(fmt(s.p)),
      );
      // Les dessins ont une taille et le ressort est tracé.
      const boxes = await forces.locator('svg[role="img"]').evaluateAll((all) =>
        all.map((e) => {
          const r = e.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      );
      for (const b of boxes) {
        expect(b.w).toBeGreaterThan(100);
        expect(b.h).toBeGreaterThan(40);
      }
      const points = await forces
        .locator('.ui-board-card-p polyline')
        .first()
        .getAttribute('points');
      expect(points?.split(' ').length).toBeGreaterThan(8);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test("« D'où vient la force ? » avant tout trajet : tout à zéro, message d'attente, cabine posée", async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await tune(page, lvl.id, lvl.win);
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      const forces = dialog.locator('.ui-board-forces');
      await expect(forces.locator('.ui-board-forces-idle')).toHaveText(FR('board.forces.idle'));
      await expect(forces.locator('.ui-board-card-stop .ui-board-calc').nth(1)).toContainText(
        `0${NB}N`,
      );
      await expect(forces.locator('.ui-board-card-bal .ui-board-calc').nth(3)).toHaveText(
        FR('board.forces.bal.ground'),
      );
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test('aucune commande de jeu ne passe tant que le tableau est ouvert (clavier et pointeur)', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      const start = await snapshot(page);
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      for (const key of [
        'e',
        'Enter',
        'Space',
        'r',
        'd',
        'ArrowRight',
        'ArrowLeft',
        '+',
        'PageUp',
      ]) {
        await page.keyboard.press(key);
      }
      await page.keyboard.down('d');
      await advance(page, 0.5);
      await page.keyboard.up('d');
      const after = await snapshot(page);
      expect(after.phase).toBe('approach');
      expect(after.walkerX).toBe(start.walkerX);
      await expect(dialog).toBeVisible();
      // Clic à l'emplacement de la console : il tombe sur la fenêtre, n'active pas la console.
      const frame = computeFrame(1280, 720);
      await page.mouse.click(worldXToPixel(frame, 1280, -1), worldYToPixel(frame, 720, 0.9));
      await expect(dialog).toBeVisible();
      expect((await snapshot(page)).phase).toBe('approach');
      // Clic sur le fond, au-dessus du dessin : il ferme le tableau sans rien activer dessous.
      await page.mouse.click(4, 360);
      await expect(dialog).toBeHidden();
      expect((await snapshot(page)).phase).toBe('approach');
      // En plein trajet : R ne recommence pas, le trajet reste en pause.
      await toTrip(page, lvl.id, lvl.win);
      const trip = await snapshot(page);
      await page.keyboard.press('t');
      await page.keyboard.press('r');
      await advance(page, 1);
      const held = await snapshot(page);
      expect(held.phase).toBe('paused');
      expect(held.attempt).toBe(trip.attempt);
      expect(held.t).toBe(trip.t);
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    test("le tableau et l'aide s'excluent, sans double pause ni reprise intempestive", async ({
      page,
    }) => {
      const problems = await open(page, lvl.id);
      await toTrip(page, lvl.id, lvl.win);
      await page.getByRole('button', { name: FR('controls.help.show') }).click();
      const help = page.getByRole('dialog', { name: FR('controls.help.title') });
      const board = dialogOf(page);
      await expect(help).toBeVisible();
      expect((await snapshot(page)).phase).toBe('paused');
      await expect(help).toContainText(FR('controls.help.board'));
      // T : le tableau remplace l'aide, la pause tenue est conservée.
      await page.keyboard.press('t');
      await expect(board).toBeVisible();
      await expect(help).toBeHidden();
      expect((await snapshot(page)).phase).toBe('paused');
      // Fermeture : une seule reprise.
      await page.keyboard.press('t');
      await expect(board).toBeHidden();
      await expect(help).toBeHidden();
      expect((await snapshot(page)).phase).toBe('trip');
      // Sans pause du jeu : tableau, puis aide impossible (couverte), Échap ne met pas en pause.
      await page.keyboard.press('t');
      await expect(board).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(board).toBeHidden();
      expect((await snapshot(page)).phase).toBe('trip');
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });

    for (const size of VIEWPORTS) {
      test(`la fenêtre tient dans ${String(size.width)}×${String(size.height)}, « Fermer » reste visible`, async ({
        page,
      }) => {
        const problems = await open(page, lvl.id, 'fr', size);
        await tune(page, lvl.id, lvl.win);
        await page.keyboard.press('t');
        const dialog = dialogOf(page);
        await expect(dialog).toBeVisible();
        const close = dialog.getByRole('button', { name: FR('board.close') });
        const measure = async (): Promise<{
          dialog: { x: number; y: number; w: number; h: number };
          close: { x: number; y: number; w: number; h: number };
          scroll: { client: number; height: number; width: number; clientWidth: number };
        }> =>
          page.evaluate(() => {
            const d = document.querySelector('#ui .ui-board');
            const c = document.querySelector('#ui .ui-board-close');
            const b = document.querySelector('#ui .ui-board-body');
            if (d === null || c === null || b === null) throw new Error('tableau absent');
            const r = (e: Element): { x: number; y: number; w: number; h: number } => {
              const q = e.getBoundingClientRect();
              return { x: q.x, y: q.y, w: q.width, h: q.height };
            };
            return {
              dialog: r(d),
              close: r(c),
              scroll: {
                client: b.clientHeight,
                height: b.scrollHeight,
                width: b.scrollWidth,
                clientWidth: b.clientWidth,
              },
            };
          });
        const inside = (b: { x: number; y: number; w: number; h: number }): void => {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(size.width);
          expect(b.y + b.h).toBeLessThanOrEqual(size.height);
        };
        const m = await measure();
        inside(m.dialog);
        inside(m.close);
        // Pas de défilement horizontal ; le vertical est interne au tableau.
        expect(m.scroll.width).toBeLessThanOrEqual(m.scroll.clientWidth + 1);
        // En défilant jusqu'en bas, la dernière ligne (valeurs) apparaît, « Fermer » reste visible.
        await page.locator('#ui .ui-board-body').evaluate((e) => {
          e.scrollTop = e.scrollHeight;
        });
        const last = dialog.locator(
          lvl.id === 'level1' ? '.ui-board-value-kp' : '.ui-board-value-ki',
        );
        await expect(last).toBeInViewport();
        inside((await measure()).close);
        await expect(close).toBeInViewport({ ratio: 1 });
        if (size.width === 390) {
          // Portrait : tout ne tient pas, le défilement est interne.
          expect(m.scroll.height).toBeGreaterThan(m.scroll.client);
        }
        expect(problems, CONSOLE_FAILURE).toEqual([]);
      });
    }

    test('anglais : nom de la fenêtre, étiquettes des formules et du chevalet', async ({
      page,
    }) => {
      const problems = await open(page, lvl.id, 'en');
      await expect(page.getByRole('button', { name: EN('board.open') })).toBeVisible();
      await page.keyboard.press('t');
      const dialog = dialogOf(page, 'en');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: EN('board.close') })).toBeFocused();
      await expect(dialog.locator('math').first()).toHaveAttribute(
        'aria-label',
        EN('board.motion.label'),
      );
      await expect(dialog).toContainText(`g = 9.81${NB}m/s²`);
      await expect(dialog).toContainText(
        EN(lvl.id === 'level1' ? 'board.law.titleP' : 'board.law.titlePi'),
      );
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });
  });
}

test('captures du tableau d’école (niveaux 1 et 2) et du chevalet sur le quai', async ({
  page,
}) => {
  // Quai de départ, interface visible, en approche.
  let problems = await open(page, 'level1');
  await advance(page, 0);
  await page.screenshot({ path: 'docs/img/t042-quai-chevalet.png' });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
  // Niveau 1 : Kp = 2500.
  await tune(page, 'level1', 2500);
  await page.keyboard.press('t');
  await expect(dialogOf(page)).toBeVisible();
  await page.screenshot({ path: 'docs/img/t042-tableau-niveau1.png' });
  // Niveau 2 : Kp fixé, Ki = 800.
  problems = await open(page, 'level2');
  await tune(page, 'level2', 800);
  await page.keyboard.press('t');
  await expect(dialogOf(page)).toBeVisible();
  await page.screenshot({ path: 'docs/img/t042-tableau-niveau2.png' });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('captures « d’où vient la force ? » en pause pendant un trajet (niveaux 1 et 2, paysage et portrait)', async ({
  page,
}, testInfo) => {
  for (const lvl of LEVELS) {
    for (const size of VIEWPORTS) {
      const problems = await open(page, lvl.id, 'fr', size);
      // Au départ du trajet (0,3 s) : la demande dépasse la butée (niveau 1) ou le bocal se remplit.
      await tune(page, lvl.id, lvl.win);
      await page.evaluate(() => {
        window.__huygens?.commands.launch();
        window.__huygens?.advance(0.3);
      });
      await page.keyboard.press('t');
      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      const forces = dialog.locator('.ui-board-forces');
      await forces.scrollIntoViewIfNeeded();
      await page.locator('#ui .ui-board-body').evaluate((e) => {
        e.scrollTop = e.scrollHeight;
      });
      // Rien ne déborde du tableau, ni en largeur ni sous « Fermer ».
      const overflow = await page.evaluate(() => {
        const body = document.querySelector('#ui .ui-board-body');
        if (body === null) throw new Error('tableau absent');
        const b = body.getBoundingClientRect();
        return Array.from(body.querySelectorAll('.ui-board-forces svg, .ui-board-forces p'))
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.left < b.left - 1 || r.right > b.right + 1);
          })
          .map((e) => `${e.tagName}.${e.getAttribute('class') ?? ''}`);
      });
      expect(overflow).toEqual([]);
      const landscape = size.width > size.height;
      const path = landscape
        ? `docs/img/t053-tableau-${lvl.id.replace('level', 'niveau')}.png`
        : testInfo.outputPath(`t053-portrait-${lvl.id}.png`);
      await page.screenshot({ path });
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    }
  }
});
