/**
 * Options de rendu lues dans l'environnement (spec T-001 §2, §8). Fonctions pures, sans three ni
 * DOM : testables sous Node.
 */

/**
 * Choix du renderer demandé par l'URL :
 * - `auto` : WebGPU, puis repli WebGL2 automatique de three ;
 * - `webgl` : WebGL2 imposé (`forceWebGL`) ;
 * - `none` : simule l'absence de GPU (page de repli, tests e2e).
 */
export type RendererChoice = 'auto' | 'webgl' | 'none';

/** Plafond du rapport de pixels : au-delà, le coût de remplissage croît sans gain visible. */
export const MAX_PIXEL_RATIO = 2;

/**
 * Lit le paramètre `?renderer=` (premier paramètre de ce nom). La casse et les espaces autour sont
 * ignorés (`?renderer=WebGL` → `webgl`) ; une valeur absente, vide ou inconnue donne `auto`.
 * @param search chaîne de requête, avec ou sans `?` initial (p. ex. `location.search`).
 */
export function parseRendererChoice(search: string): RendererChoice {
  const raw = new URLSearchParams(search).get('renderer');
  const value = raw === null ? '' : raw.trim().toLowerCase();
  if (value === 'webgl' || value === 'none') {
    return value;
  }
  return 'auto';
}

/**
 * Rapport de pixels effectif : `devicePixelRatio` plafonné à {@link MAX_PIXEL_RATIO}. Une valeur
 * non finie ou ≤ 0 donne 1.
 * @param devicePixelRatio valeur brute de `window.devicePixelRatio`.
 */
export function capPixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
}
