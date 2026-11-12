import type { Saturation } from './types';

/**
 * Crée des bornes d'actionneur validées.
 * @param min borne basse (N).
 * @param max borne haute (N), avec min ≤ max ; ±Infinity accepté (pas de borne).
 * @throws RangeError si une borne est NaN ou si min > max.
 */
export function createSaturation(min: number, max: number): Saturation {
  assertValidBounds(min, max);
  return { min, max };
}

/**
 * Borne la commande : uSat = min(max(u, s.min), s.max) (spec T-001 §4, étape 3).
 * - ±Infinity est ramené à la borne correspondante.
 * - NaN est propagé tel quel (renvoie NaN) : une commande invalide n'est jamais masquée.
 * - Bornes invalides (NaN, ou min > max, possible avec un littéral non validé) : RangeError,
 *   plutôt qu'un résultat arbitraire.
 * Sans allocation hors du cas d'erreur.
 * @param u commande demandée (N).
 * @param s bornes (N).
 * @returns commande appliquée (N).
 */
export function saturate(u: number, s: Saturation): number {
  assertValidBounds(s.min, s.max);
  return Math.min(Math.max(u, s.min), s.max);
}

/**
 * Drapeau « saturé » : vrai si la saturation a modifié la commande (uSat ≠ uCmd).
 * Écart assumé à la formule littérale `uSat !== uCmd` : si uCmd est NaN, renvoie faux
 * (NaN n'est pas un écrêtage ; il est signalé par la valeur NaN elle-même).
 * @param uCmd commande demandée (N).
 * @param uSat commande appliquée (N), issue de {@link saturate}.
 */
export function isSaturated(uCmd: number, uSat: number): boolean {
  return !Number.isNaN(uCmd) && uSat !== uCmd;
}

function assertValidBounds(min: number, max: number): void {
  // !(min <= max) attrape aussi NaN sur l'une ou l'autre borne.
  if (!(min <= max)) {
    throw new RangeError(`bornes de saturation invalides : min=${String(min)}, max=${String(max)}`);
  }
}
