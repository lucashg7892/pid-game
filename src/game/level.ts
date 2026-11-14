import { createElevatorLoop, type SteppableClosedLoop } from '../sim';
import { KP_DEFAULT, KP_MAX, KP_MIN, KP_STEP } from './constants';
import { createElevatorLevel, type CommandResult, type Level } from './elevator-level';
import { createOutcomeJudge } from './outcome';

/** Options de construction du niveau (injection pour les tests). */
export interface Level1Options {
  /**
   * Fabrique de la boucle fermée pour un Kp donné (N/m) ; défaut : `createElevatorLoop({ kp })`
   * du noyau. Appelée à la construction puis à chaque lancement dont le Kp diffère du
   * précédent.
   */
  readonly createLoop?: (kp: number) => SteppableClosedLoop;
  /**
   * Kp initial (N/m), fini et dans [{@link KP_MIN} ; {@link KP_MAX}] ; défaut
   * {@link KP_DEFAULT}. Il n'est PAS arrondi au pas de 100 : seule porte d'entrée d'un Kp hors
   * grille (Kp = 150 N/m de la spec §5 T5 et §11, bac à sable futur). Tout réglage ultérieur
   * par `setKp`/`adjustKp` repasse sur la grille.
   */
  readonly initialKp?: number;
}

/** Niveau 1 « Le vide » : le niveau commun, avec le réglage de Kp sous ses noms historiques. */
export interface Level1 extends Level {
  /**
   * Fixe Kp (N/m), arrondi au pas de 100 et borné à [0 ; 8000]. Accepté en `approach` et
   * `tuning` ; `locked` en `trip`, `outcome` et `paused` ; `invalid` si la valeur n'est pas
   * finie. Une valeur hors bornes est ramenée à la borne (acceptée).
   */
  setKp(value: number): CommandResult;
  /** Ajoute `delta` (N/m) à Kp, mêmes règles que {@link Level1.setKp}. */
  adjustKp(delta: number): CommandResult;
}

/** Fabrique par défaut : boucle de l'ascenseur du noyau (spec §5). */
function defaultLoop(kp: number): SteppableClosedLoop {
  return createElevatorLoop({ kp });
}

/**
 * Crée le niveau 1 en phase `approach` : bonhomme à l'entrée, cabine au sol, Kp initial (défaut
 * 500 N/m), essai n° 1. Mince enveloppe de la machine commune ({@link createElevatorLevel}).
 * @param options voir {@link Level1Options}.
 * @throws RangeError si `options.initialKp` n'est pas fini ou sort de [0 ; 8000].
 */
export function createLevel1(options: Level1Options = {}): Level1 {
  const initialKp = options.initialKp ?? KP_DEFAULT;
  if (!Number.isFinite(initialKp) || initialKp < KP_MIN || initialKp > KP_MAX) {
    throw new RangeError(
      `initialKp doit être fini et dans [${String(KP_MIN)} ; ${String(KP_MAX)}] (reçu ${String(initialKp)})`,
    );
  }
  const level = createElevatorLevel({
    id: 'level1',
    tuning: { param: 'kp', min: KP_MIN, max: KP_MAX, step: KP_STEP },
    initial: initialKp,
    kpOf: (value) => value,
    kiOf: () => 0,
    createLoop: options.createLoop ?? defaultLoop,
    createJudge: () => createOutcomeJudge(),
  });
  return {
    ...level,
    setKp: (value: number) => level.setTuning(value),
    adjustKp: (delta: number) => level.adjustTuning(delta),
  };
}
