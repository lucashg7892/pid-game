import { KP_MAX, KP_MIN, KP_STEP } from './constants';

/**
 * Ramène une valeur de Kp (N/m) sur la grille du réglage : arrondi au multiple de
 * {@link KP_STEP} le plus proche (les demis vers +∞, règle de `Math.round`), puis borné à
 * [{@link KP_MIN} ; {@link KP_MAX}].
 * @param value valeur demandée (N/m).
 * @returns la valeur retenue (N/m), ou `null` si `value` n'est pas un nombre fini.
 */
export function quantizeKp(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const snapped = Math.round(value / KP_STEP) * KP_STEP;
  // `+ 0` normalise −0 en +0 (Math.round(−0,4) vaut −0).
  return Math.min(Math.max(snapped, KP_MIN), KP_MAX) + 0;
}
