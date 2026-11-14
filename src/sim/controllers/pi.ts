import type { Controller } from '../types';

/** Contrôleur proportionnel-intégral : gains et état intégral exposés en lecture. */
export interface ProportionalIntegralController extends Controller {
  /** Gain proportionnel Kp (N/m), fini et ≥ 0. */
  readonly kp: number;
  /** Gain intégral Ki (N/(m·s)), fini et ≥ 0. */
  readonly ki: number;
  /**
   * État intégral I (N), stocké en newtons : I = Ki·dt·Σ e_j sur les appels passés à `update`.
   * Vaut 0 à la création et après `reset`.
   */
  readonly integral: number;
  /** Terme proportionnel Kp·e (N) du dernier appel à `update` ; 0 à la création et après `reset`. */
  readonly proportionalTerm: number;
}

/**
 * Crée un contrôleur PI discret u = Kp·e + I (spec T-018 §3.1), intégrale « rectangle à
 * gauche » stockée en newtons. Ordre normatif dans `update` :
 * 1. e = r − y ;
 * 2. u = Kp·e + I, avec I la valeur AVANT mise à jour ;
 * 3. I ← I + Ki·dt·e ;
 * 4. retourne u.
 *
 * L'intégrale est mise à jour à partir de e, jamais de la commande saturée : le contrôleur ne
 * voit pas la saturation et accumule pendant qu'elle agit (windup, aucun anti-windup).
 * Tant que I vaut exactement 0 (en particulier pour Ki = 0), u = Kp·e est calculé sans
 * l'addition, ce qui rend le PI identique bit à bit au contrôleur P, zéro signé compris
 * (−0 + 0 donnerait +0 à Kp = 0 et e < 0). Sans allocation dans `update`.
 * @param kp gain proportionnel Kp (N/m), fini et ≥ 0.
 * @param ki gain intégral Ki (N/(m·s)), fini et ≥ 0.
 * @throws RangeError si `kp` ou `ki` est NaN, infini ou négatif.
 */
export function createProportionalIntegralController(
  kp: number,
  ki: number,
): ProportionalIntegralController {
  if (!Number.isFinite(kp) || kp < 0) {
    throw new RangeError(`kp doit être fini et ≥ 0 (reçu ${String(kp)})`);
  }
  if (!Number.isFinite(ki) || ki < 0) {
    throw new RangeError(`ki doit être fini et ≥ 0 (reçu ${String(ki)})`);
  }
  let integral = 0;
  let proportionalTerm = 0;
  return {
    kp,
    ki,
    get integral(): number {
      return integral;
    },
    get proportionalTerm(): number {
      return proportionalTerm;
    },
    reset(): void {
      integral = 0;
      proportionalTerm = 0;
    },
    /**
     * @param r consigne (m).
     * @param y mesure (m).
     * @param dt pas de simulation (s).
     * @returns commande demandée uCmd = Kp·e + I (N), avant saturation.
     */
    update(r: number, y: number, dt: number): number {
      const e = r - y;
      proportionalTerm = kp * e;
      const u = integral === 0 ? proportionalTerm : proportionalTerm + integral;
      integral += ki * dt * e;
      return u;
    },
  };
}
