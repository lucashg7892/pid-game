import { createElevatorPiLoop } from '../sim';
import { KI_DEFAULT, KI_MAX, KI_MIN, KI_STEP, LEVEL2_KP } from './constants';
import {
  createElevatorLevel,
  type CommandResult,
  type Level,
  type TripLoop,
} from './elevator-level';
import { createOutcomeJudge2 } from './outcome';

/** Options de construction du niveau 2 (injection pour les tests). */
export interface Level2Options {
  /**
   * Fabrique de la boucle fermée pour un Ki donné (N/(m·s)) ; défaut :
   * `createElevatorPiLoop({ kp: LEVEL2_KP, ki })` du noyau, sans anti-windup. Appelée à la
   * construction puis à chaque lancement dont le Ki diffère du précédent.
   */
  readonly createLoop?: (ki: number) => TripLoop;
  /**
   * Ki initial (N/(m·s)), fini et dans [{@link KI_MIN} ; {@link KI_MAX}] ; défaut
   * {@link KI_DEFAULT}. Pas arrondi au pas de la grille ; tout réglage ultérieur par
   * `setKi`/`adjustKi` y repasse.
   */
  readonly initialKi?: number;
}

/** Niveau 2 « La mémoire » : le niveau commun, Kp fixé à {@link LEVEL2_KP}, Ki réglable. */
export interface Level2 extends Level {
  /** Fixe Ki (N/(m·s)) ; mêmes règles que {@link Level.setTuning}. */
  setKi(value: number): CommandResult;
  /** Ajoute `delta` (N/(m·s)) à Ki ; mêmes règles que {@link Level.adjustTuning}. */
  adjustKi(delta: number): CommandResult;
}

/** Fabrique par défaut : boucle PI de l'ascenseur du noyau, Kp fixé, sans anti-windup. */
function defaultLoop(ki: number): TripLoop {
  return createElevatorPiLoop({ kp: LEVEL2_KP, ki });
}

/**
 * Crée le niveau 2 en phase `approach` : mêmes décor, cabine, consigne, poutre et durée que le
 * niveau 1, contrôleur PI avec Kp = {@link LEVEL2_KP} et Ki réglable (défaut {@link KI_DEFAULT}),
 * essai n° 1.
 * @param options voir {@link Level2Options}.
 * @throws RangeError si `options.initialKi` n'est pas fini ou sort de [0 ; 8000].
 */
export function createLevel2(options: Level2Options = {}): Level2 {
  const initialKi = options.initialKi ?? KI_DEFAULT;
  if (!Number.isFinite(initialKi) || initialKi < KI_MIN || initialKi > KI_MAX) {
    throw new RangeError(
      `initialKi doit être fini et dans [${String(KI_MIN)} ; ${String(KI_MAX)}] (reçu ${String(initialKi)})`,
    );
  }
  const level = createElevatorLevel({
    id: 'level2',
    tuning: { param: 'ki', min: KI_MIN, max: KI_MAX, step: KI_STEP },
    initial: initialKi,
    kpOf: () => LEVEL2_KP,
    kiOf: (value) => value,
    createLoop: options.createLoop ?? defaultLoop,
    createJudge: () => createOutcomeJudge2(),
  });
  return {
    ...level,
    setKi: (value: number) => level.setTuning(value),
    adjustKi: (delta: number) => level.adjustTuning(delta),
  };
}
