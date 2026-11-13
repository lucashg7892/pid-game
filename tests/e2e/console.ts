/**
 * Surveillance de la console pour les tests e2e du niveau (T-009) : mêmes règles que
 * `render.spec.ts` (T-008b), dont la justification détaillée est dans ce fichier.
 */
import type { Page } from '@playwright/test';

/** Avertissement de pilote « GPU stall due to ReadPixels » (SwiftShader, Chrome headless). */
export const SWIFTSHADER_READPIXELS_STALL = /GL Driver Message .* GPU stall due to ReadPixels/;

/** Messages tolérés en WebGL2 imposé. */
export const ALLOWED_WEBGL: readonly RegExp[] = [SWIFTSHADER_READPIXELS_STALL];

/** Message d'échec de l'assertion console. */
export const CONSOLE_FAILURE = 'messages console inattendus (liste complète ci-dessous)';

/**
 * Collecte erreurs et avertissements console non tolérés, et exceptions non gérées.
 * @param page page Playwright.
 * @param allowed motifs tolérés.
 */
export function watchConsole(page: Page, allowed: readonly RegExp[]): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') {
      return;
    }
    const text = message.text();
    if (!allowed.some((pattern) => pattern.test(text))) {
      problems.push(`${type}: ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`exception: ${error.message}`);
  });
  return problems;
}
