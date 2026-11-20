/**
 * Échelle des jauges (T-009b ; la jauge de force a quitté la scène, D36, seule reste la jauge du
 * terme intégral au niveau 2) : échelle de 0 N (en bas) à la force maximale du moteur
 * (5000 N, en haut), graduations tous les 500 N (principales tous les 1000 N), repère du poids
 * m·g = 490,5 N. La jauge montre |uSat| : la force signée peut être négative (freinage du
 * dépassement), la jauge en montre l'intensité. Fonctions pures, sans three.
 */
import { CABIN_WEIGHT } from '../game';
import { ELEVATOR_MAX_FORCE } from '../sim';
import { GAUGE_MAJOR_STEP, GAUGE_MAX_Y, GAUGE_MIN_Y, GAUGE_MINOR_STEP } from './pencil-style';

/** Pleine échelle de la jauge : la force maximale du moteur (N). */
export const GAUGE_FULL_SCALE = ELEVATOR_MAX_FORCE;
/** Nombre de graduations, 0 et pleine échelle comprises. */
export const GAUGE_TICK_COUNT = Math.round(GAUGE_FULL_SCALE / GAUGE_MINOR_STEP) + 1;

/**
 * Fraction de la pleine échelle remplie pour une force (N) : |force| / 5000, bornée à [0, 1] ;
 * 0 pour une valeur non finie.
 * @param force force appliquée (N), signée.
 */
export function gaugeFraction(force: number): number {
  if (!Number.isFinite(force)) {
    return 0;
  }
  return Math.min(1, Math.abs(force) / GAUGE_FULL_SCALE);
}

/**
 * Ordonnée monde (m) du niveau de remplissage pour une force.
 * @param force force (N), signée.
 */
export function forceToGaugeY(force: number): number {
  return GAUGE_MIN_Y + gaugeFraction(force) * (GAUGE_MAX_Y - GAUGE_MIN_Y);
}

/**
 * Ordonnée monde (m) de la graduation `index` (0 = 0 N en bas).
 * @param index indice dans [0, {@link GAUGE_TICK_COUNT}).
 */
export function gaugeTickY(index: number): number {
  return forceToGaugeY(index * GAUGE_MINOR_STEP);
}

/**
 * Vrai si la graduation `index` est principale (multiple de 1000 N).
 * @param index indice de graduation.
 */
export function isMajorGaugeTick(index: number): boolean {
  return (index * GAUGE_MINOR_STEP) % GAUGE_MAJOR_STEP === 0;
}

/** Ordonnée du repère du poids m·g (m). */
export const GAUGE_WEIGHT_Y = forceToGaugeY(CABIN_WEIGHT);
