import type { Controller } from '../types';

/** Contrôleur proportionnel : gain exposé en lecture. */
export interface ProportionalController extends Controller {
  /** Gain proportionnel Kp (N/m), fini et ≥ 0. */
  readonly kp: number;
}

/**
 * Crée un contrôleur proportionnel u = Kp·(r − y) (spec T-001 §5, loi de commande).
 * Sans état interne : `reset` ne fait rien et `update` ne dépend ni du pas `dt` ni du passé.
 * Sans allocation dans `update`.
 * @param kp gain proportionnel Kp (N/m), fini et ≥ 0.
 * @throws RangeError si `kp` est NaN, infini ou négatif.
 */
export function createProportionalController(kp: number): ProportionalController {
  if (!Number.isFinite(kp) || kp < 0) {
    throw new RangeError(`kp doit être fini et ≥ 0 (reçu ${String(kp)})`);
  }
  return {
    kp,
    reset(): void {
      // Contrôleur sans mémoire : rien à remettre à zéro.
    },
    /**
     * @param r consigne (m).
     * @param y mesure (m).
     * @returns commande demandée uCmd = Kp·(r − y) (N), avant saturation.
     */
    update(r: number, y: number): number {
      return kp * (r - y);
    },
  };
}
