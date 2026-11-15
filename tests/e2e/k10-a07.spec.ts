/**
 * K10 (interface placée avec les ancres de l'image précédente) et A-07 (bulle placée une image
 * avec les ancres du niveau précédent à l'entrée dans un niveau), en navigateur réel, WebGL2 imposé.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { computeFrame, worldXToPixel } from '../../src/render/camera';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

const FR = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'),
) as Record<string, string | undefined>;

function text(key: string): string {
  const value = FR[key];
  if (value === undefined) throw new Error(`clé absente : ${key}`);
  return value;
}

const WIDTH = 1280;
const HEIGHT = 720;

test('K10 : en marchant, la bulle suit la tête du bonhomme de l’image affichée', async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&e2e=1&screen=level1&lang=fr');
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  const frame = computeFrame(WIDTH, HEIGHT);
  for (const seconds of [1.2, 0.5, 0.4]) {
    const state = await page.evaluate((s) => {
      const hook = window.__huygens;
      if (hook === undefined) throw new Error('window.__huygens absent');
      hook.commands.moveRight();
      hook.advance(s);
      const snap = hook.snapshot();
      const box = document.querySelector('#ui .ui-bubble')?.getBoundingClientRect();
      if (box === undefined) throw new Error('bulle absente');
      return {
        shown: snap.walkerPrevX + (snap.walkerX - snap.walkerPrevX) * snap.alpha,
        inCabin: snap.walkerInCabin,
        center: box.left + box.width / 2,
      };
    }, seconds);
    expect(state.inCabin).toBe(false);
    expect(Math.abs(state.center - worldXToPixel(frame, WIDTH, state.shown))).toBeLessThanOrEqual(
      1,
    );
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

/** Ouvre un niveau du menu et relève la position de la bulle à chacune des 5 premières images. */
async function sampleBubble(page: Page, levelTitle: string): Promise<Array<[number, number]>> {
  return page.evaluate(
    (title) =>
      new Promise<Array<[number, number]>>((resolve) => {
        const button = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === title,
        );
        if (button === undefined) throw new Error(`bouton absent : ${title}`);
        const samples: Array<[number, number]> = [];
        const tick = (): void => {
          const box = document.querySelector('#ui .ui-bubble')?.getBoundingClientRect();
          if (box !== undefined && box.width > 0) {
            samples.push([box.left, box.bottom]);
          }
          if (samples.length >= 5) {
            resolve(samples);
          } else {
            requestAnimationFrame(tick);
          }
        };
        button.click();
        requestAnimationFrame(tick);
      }),
    levelTitle,
  );
}

test('A-07 : à l’entrée de chaque niveau, la bulle ne passe pas par la position du précédent', async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&lang=fr');
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
  await page.getByRole('button', { name: text('title.play'), exact: true }).click();
  const order = ['level1.title', 'level2.title', 'level1.title'];
  for (const [index, key] of order.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: text('controls.pause'), exact: true }).click();
      await page.locator('#ui .ui-tools .ui-menu').click();
    }
    const samples = await sampleBubble(page, text(key));
    const first = samples[0];
    if (first === undefined) throw new Error('aucun échantillon');
    for (const sample of samples) {
      expect(Math.abs(sample[0] - first[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(sample[1] - first[1])).toBeLessThanOrEqual(1);
    }
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
