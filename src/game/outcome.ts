import {
  BEAM_HEIGHT,
  LEVEL1_SETPOINT,
  LEVEL2_ARRIVAL_TOLERANCE,
  NO_LIFT_KP_THRESHOLD,
  SETTLE_SPEED_TOLERANCE,
  STEP_TOLERANCE,
  TRIP_MAX_STEPS,
  WIN_HOLD_STEPS,
} from './constants';

/**
 * Issue d'un trajet (spec T-001 §6, point 5) :
 * - `win` : victoire ;
 * - `bonk` : choc contre la poutre ;
 * - `noLift` : la cabine ne décolle pas (Kp ≤ m·g/r) ;
 * - `step` : la cabine s'arrête trop bas, la marche est infranchissable ;
 * - `slow` (niveau 2 seulement) : à la fin du temps, la cabine est à moins de la tolérance du
 *   plateau d'arrivée mais n'a pas fini de se stabiliser.
 */
export type TripOutcome = 'win' | 'noLift' | 'step' | 'bonk' | 'slow';

/** Arbitre des issues : à appeler une fois par pas de simulation, sur l'état APRÈS le pas. */
export interface OutcomeJudge {
  /** Nombre de pas consécutifs déjà passés « au quai et arrêtée » (sans unité). */
  readonly holdSteps: number;
  /** Remet le compteur de pas consécutifs à zéro (nouveau trajet). */
  reset(): void;
  /**
   * Évalue les règles après un pas, dans cet ordre : choc, victoire, fin de temps.
   * @param n nombre de pas exécutés depuis le lancement, ce pas compris (l'état est x(n·dt)).
   * @param y hauteur du plancher de la cabine après le pas (m).
   * @param v vitesse verticale de la cabine après le pas (m/s).
   * @param kp gain du trajet (N/m), pour distinguer `noLift` de `step`.
   * @returns l'issue si le trajet est terminé à ce pas, sinon `null`.
   */
  evaluate(n: number, y: number, v: number, kp: number): TripOutcome | null;
}

/**
 * Issue d'un trajet arrivé au bout de {@link TRIP_MAX_STEPS} pas sans victoire ni choc.
 * @param kp gain du trajet (N/m).
 * @returns `noLift` si Kp ≤ {@link NO_LIFT_KP_THRESHOLD} (m·g/r), sinon `step`.
 */
export function classifyTimeout(kp: number): 'noLift' | 'step' {
  return kp <= NO_LIFT_KP_THRESHOLD ? 'noLift' : 'step';
}

/**
 * Arbitre générique : choc, victoire (tolérance donnée), puis fin de temps classée par `timeout`.
 * @param setpoint consigne r (m).
 * @param tolerance tolérance d'arrivée (m).
 * @param timeout issue de fin de temps, d'après l'état au dernier pas.
 */
function makeJudge(
  setpoint: number,
  tolerance: number,
  timeout: (y: number, kp: number) => TripOutcome,
): OutcomeJudge {
  let hold = 0;
  return {
    get holdSteps(): number {
      return hold;
    },
    reset(): void {
      hold = 0;
    },
    evaluate(n: number, y: number, v: number, kp: number): TripOutcome | null {
      if (y > BEAM_HEIGHT) return 'bonk';
      if (Math.abs(setpoint - y) <= tolerance && Math.abs(v) <= SETTLE_SPEED_TOLERANCE) {
        hold += 1;
        if (hold >= WIN_HOLD_STEPS) return 'win';
      } else {
        hold = 0;
      }
      if (n >= TRIP_MAX_STEPS) return timeout(y, kp);
      return null;
    },
  };
}

/**
 * Crée l'arbitre des issues du niveau 1 (spec T-001 §6, point 5), évaluées sur l'état après
 * chaque pas (convention du validateur T-005) :
 * - choc dès que y > {@link BEAM_HEIGHT} ;
 * - victoire au {@link WIN_HOLD_STEPS}e pas consécutif où |r − y| ≤ {@link STEP_TOLERANCE} et
 *   |ẏ| ≤ {@link SETTLE_SPEED_TOLERANCE} ; le compteur repart de zéro dès qu'une condition
 *   tombe ;
 * - sinon, quand n atteint {@link TRIP_MAX_STEPS} : {@link classifyTimeout}.
 * Une victoire acquise exactement au pas {@link TRIP_MAX_STEPS} l'emporte sur la fin de temps.
 * Une valeur NaN rend les comparaisons fausses : pas de victoire, pas de choc. Sans allocation.
 * @param setpoint consigne r (m) ; défaut {@link LEVEL1_SETPOINT}.
 */
export function createOutcomeJudge(setpoint: number = LEVEL1_SETPOINT): OutcomeJudge {
  return makeJudge(setpoint, STEP_TOLERANCE, (_y, kp) => classifyTimeout(kp));
}

/**
 * Issue d'un trajet du niveau 2 arrivé au bout du temps sans victoire ni choc.
 * @param y hauteur de la cabine au dernier pas (m).
 * @param setpoint consigne r (m).
 * @param tolerance tolérance d'arrivée (m).
 * @returns `step` si |r − y| > tolérance (trop court), sinon `slow` (trop lent à se stabiliser).
 */
export function classifyTimeout2(
  y: number,
  setpoint: number = LEVEL1_SETPOINT,
  tolerance: number = LEVEL2_ARRIVAL_TOLERANCE,
): 'step' | 'slow' {
  return Math.abs(setpoint - y) > tolerance ? 'step' : 'slow';
}

/**
 * Crée l'arbitre des issues du niveau 2 : mêmes règles que le niveau 1 avec la tolérance
 * {@link LEVEL2_ARRIVAL_TOLERANCE}, et une fin de temps classée par {@link classifyTimeout2}
 * (`step` ou `slow`, jamais `noLift`).
 * @param setpoint consigne r (m) ; défaut {@link LEVEL1_SETPOINT}.
 * @param tolerance tolérance d'arrivée (m) ; défaut {@link LEVEL2_ARRIVAL_TOLERANCE}.
 */
export function createOutcomeJudge2(
  setpoint: number = LEVEL1_SETPOINT,
  tolerance: number = LEVEL2_ARRIVAL_TOLERANCE,
): OutcomeJudge {
  return makeJudge(setpoint, tolerance, (y) => classifyTimeout2(y, setpoint, tolerance));
}
