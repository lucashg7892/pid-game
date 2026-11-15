/**
 * Réserves d'interface de T-037 (T-039), navigateur réel, WebGL2 imposé, animations activées par
 * `anim=1` : R3 le panneau de réglage ne bouge pas de l'ouverture au départ du trajet ; R4
 * l'annonce de lancement attend le départ réel ; R5 le bouton tactile « Action » ne rejoue pas
 * depuis l'issue.
 */
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

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
  query: string,
  size: { width: number; height: number } = { width: 1280, height: 720 },
): Promise<string[]> {
  await page.setViewportSize(size);
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto(`?renderer=webgl&lang=fr&${query}`);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

for (const lvl of LEVELS) {
  for (const size of VIEWPORTS) {
    test(`R3 ${lvl.id} ${String(size.width)}×${String(size.height)} : le panneau de réglage ne bouge pas de E au départ du trajet`, async ({
      page,
    }) => {
      const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`, size);
      await page.keyboard.press('e');
      const result = await page.evaluate(
        ([id, value]) => {
          const hook = window.__huygens;
          const panel = document.querySelector('#ui .ui-panel');
          if (hook === undefined || !(panel instanceof HTMLElement)) throw new Error('absent');
          const boxes: Box[] = [];
          const read = (): void => {
            const r = panel.getBoundingClientRect();
            boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
          };
          read();
          for (let i = 0; i < 600 && !hook.snapshot().atPost; i += 1) {
            hook.advance(1 / 60);
            read();
          }
          const arrived = hook.snapshot().atPost;
          if (id === 'level2') hook.commands.setKi(value);
          else hook.commands.setKp(value);
          hook.commands.launch();
          let boarding = 0;
          for (let i = 0; i < 600 && hook.snapshot().phase === 'boarding'; i += 1) {
            hook.advance(1 / 60);
            boarding += 1;
            if (hook.snapshot().phase === 'boarding') read();
          }
          return { boxes, arrived, boarding, phase: hook.snapshot().phase };
        },
        [lvl.id, lvl.win] as const,
      );
      expect(result.arrived).toBe(true);
      expect(result.phase).toBe('trip');
      expect(result.boarding).toBeGreaterThan(60);
      expect(result.boxes.length).toBeGreaterThan(150);
      const first = result.boxes[0];
      if (first === undefined) throw new Error('aucun échantillon');
      expect(first.width).toBeGreaterThan(0);
      for (const b of result.boxes) {
        expect(Math.abs(b.x - first.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.y - first.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.width - first.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.height - first.height)).toBeLessThanOrEqual(1);
      }
      expect(problems, CONSOLE_FAILURE).toEqual([]);
    });
  }

  test(`R4 ${lvl.id} : l'annonce de lancement attend le départ réel du trajet`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    await page.keyboard.press('e');
    const result = await page.evaluate(
      ([id, value]) => {
        const hook = window.__huygens;
        const live = document.querySelector('#ui [aria-live]');
        if (hook === undefined || live === null) throw new Error('absent');
        const count = (): number =>
          Array.from(live.querySelectorAll('p')).filter((p) =>
            p.textContent.startsWith('Lancement'),
          ).length;
        for (let i = 0; i < 600 && !hook.snapshot().atPost; i += 1) hook.advance(1 / 60);
        if (id === 'level2') hook.commands.setKi(value);
        else hook.commands.setKp(value);
        hook.commands.launch();
        let duringBoarding = count();
        for (let i = 0; i < 600 && hook.snapshot().phase === 'boarding'; i += 1) {
          hook.advance(1 / 60);
          if (hook.snapshot().phase === 'boarding') duringBoarding += count();
        }
        const atTrip = count();
        hook.advance(1);
        return { duringBoarding, atTrip, later: count(), phase: hook.snapshot().phase };
      },
      [lvl.id, lvl.win] as const,
    );
    expect(result.phase).toBe('trip');
    expect(result.duringBoarding).toBe(0);
    expect(result.atTrip).toBe(1);
    expect(result.later).toBe(1);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`R4 ${lvl.id} : recommencer pendant l'embarquement annule l'annonce`, async ({ page }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    await page.keyboard.press('e');
    const lines = await page.evaluate(() => {
      const hook = window.__huygens;
      const live = document.querySelector('#ui [aria-live]');
      if (hook === undefined || live === null) throw new Error('absent');
      for (let i = 0; i < 600 && !hook.snapshot().atPost; i += 1) hook.advance(1 / 60);
      hook.commands.launch();
      hook.advance(0.5);
      hook.commands.restart();
      hook.advance(3);
      return Array.from(live.querySelectorAll('p')).map((p) => p.textContent);
    });
    expect(lines.filter((l) => l.startsWith('Lancement'))).toEqual([]);
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`R5 ${lvl.id} : deux appuis sur « Action » pendant la sortie gardent l'issue`, async ({
    page,
  }) => {
    const problems = await open(page, `e2e=1&anim=1&screen=${lvl.id}`);
    const action = page.locator('#ui .ui-touch-action');
    await page.keyboard.press('e');
    await page.evaluate(
      ([id, value]) => {
        const hook = window.__huygens;
        if (hook === undefined) throw new Error('absent');
        for (let i = 0; i < 600 && !hook.snapshot().atPost; i += 1) hook.advance(1 / 60);
        if (id === 'level2') hook.commands.setKi(value);
        else hook.commands.setKp(value);
      },
      [lvl.id, lvl.win] as const,
    );
    // Réglage : « Action » lance toujours.
    await action.dispatchEvent('click');
    expect(await page.evaluate(() => window.__huygens?.snapshot().phase)).toBe('boarding');
    await page.evaluate(() => {
      const hook = window.__huygens;
      if (hook === undefined) throw new Error('absent');
      for (let i = 0; i < 6000 && hook.snapshot().phase !== 'exit'; i += 1) hook.advance(1 / 60);
    });
    expect(await page.evaluate(() => window.__huygens?.snapshot().phase)).toBe('exit');
    await action.dispatchEvent('click');
    await action.dispatchEvent('click');
    const after = await page.evaluate(() => {
      const snap = window.__huygens?.snapshot();
      return { phase: snap?.phase, attempt: snap?.attempt };
    });
    expect(after).toEqual({ phase: 'outcome', attempt: 1 });
    await expect(page.locator('#ui .ui-outcome')).toBeVisible();
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}
