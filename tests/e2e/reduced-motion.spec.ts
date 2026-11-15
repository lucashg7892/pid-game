/**
 * K22 (T-030) : la préférence « mouvement réduit » est suivie en cours de partie, et l'écouteur
 * est retiré à l'arrêt de la session. Navigateur réel, WebGL2 imposé, `?e2e=1`.
 */
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

/** Journal d'échec de main.ts, attendu après `crashNextFrame`. */
const ALLOWED_FAILURE: readonly RegExp[] = [...ALLOWED_WEBGL, /^Huygens’s world : error : /];

declare global {
  interface Window {
    __rmListeners?: { add: number; remove: number };
  }
}

/** Compte les ajouts et retraits d'écouteurs `change` sur la requête `prefers-reduced-motion`. */
async function countListeners(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counts = { add: 0, remove: 0 };
    window.__rmListeners = counts;
    const proto = MediaQueryList.prototype;
    const add = Reflect.get(proto, 'addEventListener') as EventTarget['addEventListener'];
    const remove = Reflect.get(proto, 'removeEventListener') as EventTarget['removeEventListener'];
    const counted = (q: MediaQueryList, type: string): boolean =>
      type === 'change' && q.media.includes('reduced-motion');
    proto.addEventListener = function (
      this: MediaQueryList,
      ...args: Parameters<typeof add>
    ): void {
      if (counted(this, args[0])) counts.add += 1;
      add.apply(this, args);
    };
    proto.removeEventListener = function (
      this: MediaQueryList,
      ...args: Parameters<typeof remove>
    ): void {
      if (counted(this, args[0])) counts.remove += 1;
      remove.apply(this, args);
    };
  });
}

async function open(page: Page, allowed: readonly RegExp[] = ALLOWED_WEBGL): Promise<string[]> {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, allowed);
  await page.goto('?renderer=webgl&e2e=1&screen=level1&lang=fr');
  await page.waitForFunction(() => window.__huygens !== undefined);
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  return problems;
}

/** Capture après avoir avancé le temps visuel de 0,25 s (deux graines du tremblé à 8 Hz). */
async function shotAfterAdvance(page: Page): Promise<Buffer> {
  await page.evaluate(() => {
    window.__huygens?.advance(0.25);
  });
  return page.screenshot();
}

test('le tremblé suit la préférence « mouvement réduit » changée en cours de partie', async ({
  page,
}) => {
  const problems = await open(page);
  const reduced = (): Promise<boolean | undefined> =>
    page.evaluate(() => window.__huygens?.reducedMotion());
  /** Attend que l'événement `change` (asynchrone) ait mis la session à jour. */
  const expectReduced = async (value: boolean): Promise<void> => {
    await page.waitForFunction((v) => window.__huygens?.reducedMotion() === v, value);
    expect(await reduced()).toBe(value);
  };

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectReduced(false);
  const a = await shotAfterAdvance(page);
  const b = await shotAfterAdvance(page);
  expect(a.equals(b), 'sans préférence, le dessin tremble').toBe(false);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectReduced(true);
  await shotAfterAdvance(page);
  const c = await shotAfterAdvance(page);
  const d = await shotAfterAdvance(page);
  expect(c.equals(d), 'avec la préférence, le dessin est immobile').toBe(true);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectReduced(false);
  const e = await shotAfterAdvance(page);
  const f = await shotAfterAdvance(page);
  expect(e.equals(f), 'préférence retirée, le dessin retrouve le tremblé').toBe(false);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test("l'écouteur de préférence est retiré à l'arrêt de la session, sans fuite attach/detach", async ({
  page,
}) => {
  await countListeners(page);
  const problems = await open(page, ALLOWED_FAILURE);
  const counts = (): Promise<{ add: number; remove: number } | undefined> =>
    page.evaluate(() => window.__rmListeners);
  expect(await counts()).toEqual({ add: 1, remove: 0 });
  await page.evaluate(() => {
    for (let i = 0; i < 5; i += 1) {
      window.__huygens?.detachLevel();
      window.__huygens?.attachLevel();
    }
    window.__huygens?.detachLevel();
  });
  // Le détachement ne touche pas à l'écouteur : il appartient à la session.
  expect(await counts()).toEqual({ add: 1, remove: 0 });
  await page.evaluate(() => {
    window.__huygens?.crashNextFrame();
  });
  await expect(page.locator('#fallback')).toHaveCount(1);
  expect(await counts()).toEqual({ add: 1, remove: 1 });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
