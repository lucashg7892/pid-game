/**
 * Échecs du rendu en cours de route (T-014, défauts K16 et K17), WebGL2 imposé : perte du contexte
 * GPU (`WEBGL_lose_context`) et exception après le démarrage. Dans les deux cas, la page de repli
 * traduite remplace le jeu, sans interface morte. Le chemin WebGPU (`device.lost`) n'est pas
 * exercé ici : Chromium headless n'a pas d'adaptateur WebGPU.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ALLOWED_WEBGL, CONSOLE_FAILURE, watchConsole } from './console';

/** Notre journal d'échec (console.error de main.ts) et l'avertissement de Chrome sur le contexte perdu. */
const ALLOWED_FAILURE: readonly RegExp[] = [
  ...ALLOWED_WEBGL,
  /^Huygens’s world : (context-lost|error) : /,
  /CONTEXT_LOST_WEBGL/,
];

/** Textes lus dans les locales (voir render.spec.ts pour la raison). */
function texts(lang: 'fr' | 'en', kind: 'lost' | 'error'): { title: string; explanation: string } {
  const catalog = JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string | undefined>;
  return {
    title: catalog[`fallback.${kind}.title`] ?? '',
    explanation: catalog[`fallback.${kind}.explanation`] ?? '',
  };
}

async function waitFirstFrame(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
}

/** Vérifie la page de repli : texte traduit, canvas et interface retirés. */
async function expectFailurePage(
  page: Page,
  lang: 'fr' | 'en',
  kind: 'lost' | 'error',
): Promise<void> {
  const expected = texts(lang, kind);
  expect(expected.title).not.toBe('');
  expect(expected.explanation).not.toBe('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.title);
  await expect(page.getByText(expected.explanation)).toBeVisible();
  await expect(page.locator('#fallback')).toHaveAttribute(
    'data-kind',
    kind === 'lost' ? 'context-lost' : 'error',
  );
  await expect(page.locator('body')).toHaveAttribute('data-backend', 'none');
  await expect(page.locator('#scene')).toBeHidden();
  await expect(page.locator('#ui')).toHaveCount(0);
  await expect(page.locator('button')).toHaveCount(0);
}

for (const lang of ['fr', 'en'] as const) {
  test(`perte du contexte WebGL : page de repli traduite (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const problems = watchConsole(page, ALLOWED_FAILURE);
    await page.goto(`?renderer=webgl&e2e=1&lang=${lang}`);
    await waitFirstFrame(page);
    await expect(page.locator('#ui')).toHaveCount(1);
    const lost = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (extension === null || extension === undefined) {
        return false;
      }
      extension.loseContext();
      return true;
    });
    expect(lost).toBe(true);
    await expectFailurePage(page, lang, 'lost');
    if (lang === 'fr') {
      await page.screenshot({
        path: test.info().outputPath('repli-contexte-perdu-fr.png'),
      });
    }
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });

  test(`exception après le démarrage : page de repli traduite (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const problems = watchConsole(page, ALLOWED_FAILURE);
    await page.goto(`?renderer=webgl&e2e=1&lang=${lang}`);
    await waitFirstFrame(page);
    await page.evaluate(() => {
      window.__huygens?.crashNextFrame();
    });
    await expectFailurePage(page, lang, 'error');
    if (lang === 'fr') {
      await page.screenshot({
        path: test.info().outputPath('repli-erreur-fr.png'),
      });
    }
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}
