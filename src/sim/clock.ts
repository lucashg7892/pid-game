import type { FixedStepClock } from './types';

/** Pas de simulation fixe, en secondes (spec T-001 §4). */
export const SIM_DT = 1 / 120;

/**
 * Pas de simulation maximal accepté par {@link createClosedLoop} (s) : 1/30 s, soit 4·SIM_DT.
 * Au-delà, `createClosedLoop` (donc `createElevatorLoop`) lève `RangeError` (défaut D-2 de
 * T-005 : à dt = 1 s, RK4 divergeait sans erreur ni NaN).
 *
 * Justification, pour l'ascenseur (m = 50 kg, c = 400 N·s/m, saturation ±5000 N) sur toute la
 * plage du curseur Kp ≤ 8000 N/m, chiffres calculés en T-004b (bloqueur d'ordre zéro exact
 * Φ, Γ en forme fermée, comparé à RK4) et cohérents avec T-005 (97 079 N/m à 1/120 s,
 * 49 091 N/m à 1/60 s) :
 * - stabilité de la boucle échantillonnée : Kp critique 25 115 N/m (exact) et 25 125 N/m
 *   (RK4) à dt = 1/30 s, soit une marge de gain ≥ 3,1 à Kp = 8000 (rayon spectral 0,917) ;
 *   la marge tombe à 2,1 à 1/20 s, 1,2 à 1/10 s, et la boucle est instable à 1/8 s ;
 * - stabilité de RK4 seul : |λ|·dt = (c/m)·dt = 0,27, loin de la limite ≈ 2,79 de RK4 sur
 *   l'axe réel ;
 * - précision : écart RK4/exact sur 10 s ≤ 6,1e-5 m sur y et 8,3e-4 m/s sur ẏ (Kp = 8000),
 *   contre 1,4e-7 m et 2,3e-6 m/s à SIM_DT : imperceptible à l'écran (≤ 0,1 mm).
 * Cette borne est un plafond du moteur, pas une garantie pour tout modèle : un nouveau
 * modèle plus rapide doit refaire cette vérification.
 */
export const MAX_SIM_DT = 1 / 30;

/** Nombre maximal de pas exécutés pour une image ; le surplus est jeté (spec T-001 §4). */
export const MAX_STEPS_PER_FRAME = 8;

/** Durée d'image maximale prise en compte, en secondes (spec T-001 §4). */
export const MAX_FRAME_SECONDS = 0.25;

/**
 * Tolérance (en pas) sur le passage d'un pas entier. Absorbe l'erreur d'arrondi de la somme
 * des fractions frameSeconds/dt (≈ 1e-16 par image) : sans elle, 6 images de 1/144 s
 * pourraient donner 4 pas au lieu de 5. Décalage temporel induit ≤ 1e-9·dt, sans cumul.
 */
const STEP_EPSILON = 1e-9;

/** Horloge à pas fixe réinitialisable. */
export interface ResettableFixedStepClock extends FixedStepClock {
  /** Vide l'accumulateur (alpha = 0). */
  reset(): void;
}

/**
 * Crée une horloge à accumulateur. Elle ne lit jamais l'heure : la durée de chaque image lui
 * est fournie. L'accumulateur est tenu en pas (sans unité), pas en secondes.
 *
 * `advance(frameSeconds)` :
 * - une durée négative, nulle ou NaN compte pour 0 s ; une durée > {@link MAX_FRAME_SECONDS}
 *   est ramenée à cette valeur (protection en plus du `min` fait par l'appelant) ;
 * - renvoie au plus `maxStepsPerFrame` pas ; les pas entiers en surplus sont jetés, la
 *   fraction de pas restante est conservée (donc `alpha` reste dans [0, 1)).
 *
 * @param dt pas de simulation (s), fini et > 0 ; défaut {@link SIM_DT}.
 * @param maxStepsPerFrame plafond de pas par image, entier ≥ 1 ; défaut {@link MAX_STEPS_PER_FRAME}.
 * @throws RangeError si un paramètre est invalide.
 */
export function createFixedStepClock(
  dt: number = SIM_DT,
  maxStepsPerFrame: number = MAX_STEPS_PER_FRAME,
): ResettableFixedStepClock {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError(`dt doit être fini et > 0 (reçu ${String(dt)})`);
  }
  if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
    throw new RangeError(
      `maxStepsPerFrame doit être un entier ≥ 1 (reçu ${String(maxStepsPerFrame)})`,
    );
  }
  /** Fraction de pas en attente, dans [0, 1) entre deux appels. */
  let accumulator = 0;

  return {
    dt,
    get alpha(): number {
      return accumulator;
    },
    advance(frameSeconds: number): number {
      let seconds = frameSeconds > 0 ? frameSeconds : 0; // NaN > 0 est faux
      if (seconds > MAX_FRAME_SECONDS) seconds = MAX_FRAME_SECONDS;
      accumulator += seconds / dt;
      let steps = Math.floor(accumulator + STEP_EPSILON);
      accumulator -= steps;
      if (accumulator < 0) accumulator = 0;
      if (steps > maxStepsPerFrame) steps = maxStepsPerFrame;
      return steps;
    },
    reset(): void {
      accumulator = 0;
    },
  };
}
