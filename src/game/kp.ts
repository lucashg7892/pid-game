import { KP_MAX, KP_MIN, KP_STEP } from './constants';

/**
 * Ramène une valeur de réglage sur la grille [min ; max] de pas `step` : arrondi au multiple de
 * `step` le plus proche (les demis vers +∞, règle de `Math.round`), puis borné.
 * @param value valeur demandée.
 * @param min borne basse.
 * @param max borne haute.
 * @param step pas de la grille.
 * @returns la valeur retenue, ou `null` si `value` n'est pas un nombre fini.
 */
export function quantizeGain(value: number, min: number, max: number, step: number): number | null {
  if (!Number.isFinite(value)) return null;
  const snapped = Math.round(value / step) * step;
  // `+ 0` normalise −0 en +0 (Math.round(−0,4) vaut −0).
  return Math.min(Math.max(snapped, min), max) + 0;
}

/**
 * Ramène une valeur de Kp (N/m) sur la grille du réglage : arrondi au multiple de
 * {@link KP_STEP} le plus proche (les demis vers +∞, règle de `Math.round`), puis borné à
 * [{@link KP_MIN} ; {@link KP_MAX}].
 * @param value valeur demandée (N/m).
 * @returns la valeur retenue (N/m), ou `null` si `value` n'est pas un nombre fini.
 */
export function quantizeKp(value: number): number | null {
  return quantizeGain(value, KP_MIN, KP_MAX, KP_STEP);
}
