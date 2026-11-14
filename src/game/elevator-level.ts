import {
  ELEVATOR_POSITION,
  ELEVATOR_VELOCITY,
  createFixedStepClock,
  createSignalRecorder,
  type SignalRecorder,
  type SteppableClosedLoop,
} from '../sim';
import {
  CABIN_CENTER_X,
  CABIN_WEIGHT,
  CONSOLE_X,
  LEVEL1_SETPOINT,
  TRIP_MAX_STEPS,
} from './constants';
import { createEventQueue, type GameEvent } from './events';
import { quantizeGain } from './kp';
import type { OutcomeJudge, TripOutcome } from './outcome';
import { createWalker, type Facing } from './walker';

/**
 * Phase du niveau (machine à états, spec T-001 §6) :
 * - `approach` : le bonhomme marche vers la console ;
 * - `tuning` : panneau de réglage ouvert à la console ;
 * - `trip` : simulation active, réglage verrouillé ;
 * - `outcome` : trajet terminé, issue connue, réglage verrouillé jusqu'à `restart` ;
 * - `paused` : tout est figé ; la phase à reprendre est dans `resumePhase`.
 */
export type LevelPhase = 'approach' | 'tuning' | 'trip' | 'outcome' | 'paused';

/**
 * Résultat d'une commande :
 * - `accepted` : la commande a pris effet ;
 * - `ignored` : sans objet dans la phase courante (rien n'a changé) ;
 * - `locked` : réglage verrouillé (trajet en cours, issue affichée ou pause) ;
 * - `invalid` : valeur non finie refusée.
 */
export type CommandResult = 'accepted' | 'ignored' | 'locked' | 'invalid';

/** Identifiant d'un niveau jouable. */
export type LevelId = 'level1' | 'level2';

/** Grandeur réglée par le joueur : Kp au niveau 1, Ki au niveau 2. */
export type TunedParam = 'kp' | 'ki';

/** Description du réglage d'un niveau (grandeur, bornes et pas), pour l'interface. */
export interface TuningSpec {
  /** Grandeur réglée. */
  readonly param: TunedParam;
  /** Valeur minimale. */
  readonly min: number;
  /** Valeur maximale. */
  readonly max: number;
  /** Pas de la grille. */
  readonly step: number;
}

/**
 * Instantané du niveau, pour le rendu et l'UI. Objet unique réécrit après chaque `update` et
 * chaque commande acceptée : à lire, jamais à modifier, à copier pour le conserver.
 * Les grandeurs de la cabine décrivent l'état x(k·dt) APRÈS le dernier pas exécuté.
 */
export interface LevelSnapshot {
  /** Identifiant du niveau (`level1` : contrôleur P ; `level2` : contrôleur PI, Kp fixé). */
  levelId: LevelId;
  /** Phase courante. */
  phase: LevelPhase;
  /** Phase qui reprendra à `resume` ; `null` hors pause. */
  resumePhase: LevelPhase | null;
  /** Abscisse du bonhomme (m). */
  walkerX: number;
  /** Abscisse du bonhomme au pas précédent (m) : afficher lerp(walkerPrevX, walkerX, alpha). */
  walkerPrevX: number;
  /** Orientation du bonhomme (−1 gauche, +1 droite). */
  walkerFacing: Facing;
  /** Vrai si le bonhomme a une intention de marche (animation de marche). */
  walkerMoving: boolean;
  /** Vrai si le bonhomme est à bord de la cabine (trajet ou issue). */
  walkerInCabin: boolean;
  /** Vrai si le bonhomme est dans la zone d'interaction de la console. */
  atConsole: boolean;
  /** Hauteur du plancher de la cabine y (m), après le dernier pas. */
  cabinY: number;
  /** Hauteur de la cabine au pas précédent (m) : afficher lerp(cabinPrevY, cabinY, alpha). */
  cabinPrevY: number;
  /** Vitesse verticale de la cabine ẏ (m/s), après le dernier pas. */
  cabinVelocity: number;
  /** Fraction de pas en attente dans l'horloge, dans [0, 1), pour interpoler l'affichage. */
  alpha: number;
  /** Gain proportionnel courant (N/m) : réglé au niveau 1, fixé au niveau 2. */
  kp: number;
  /** Gain intégral courant (N/(m·s)) : 0 au niveau 1, réglé au niveau 2. */
  ki: number;
  /**
   * Terme intégral I accumulé (N), lu sur le contrôleur après le dernier pas ; 0 au niveau 1 et
   * hors trajet. Prévu pour de futurs affichages (non affiché pour l'instant).
   */
  iTerm: number;
  /** Consigne (m) : 0 avant le lancement, {@link LEVEL1_SETPOINT} pendant le trajet et l'issue. */
  r: number;
  /** Erreur e = r − cabinY (m). */
  e: number;
  /** Force appliquée au dernier pas, après saturation (N) ; 0 hors trajet. */
  uSat: number;
  /** Vrai si la force du dernier pas a été écrêtée par la saturation. */
  saturated: boolean;
  /** Nombre de pas exécutés depuis le lancement (sans unité) ; 0 hors trajet. */
  k: number;
  /** Temps de simulation du trajet t = k·dt (s). */
  t: number;
  /** Issue du trajet, ou `null` tant qu'il n'est pas terminé. */
  outcome: TripOutcome | null;
  /** Pas k auquel l'issue a été décidée, ou `null`. */
  outcomeK: number | null;
  /** Erreur finale mesurée r − y au pas de l'issue (m), ou `null`. */
  finalError: number | null;
  /** Erreur statique théorique m·g/Kp (m) ; `Infinity` si Kp = 0. */
  theoreticalError: number;
  /** Vrai si au moins un pas saturé a eu lieu pendant ce trajet (annonce unique). */
  saturationSeen: boolean;
  /** Nombre de pas saturés pendant ce trajet. */
  saturatedSteps: number;
  /** Numéro de l'essai (≥ 1), incrémenté par `restart`. */
  attempt: number;
}

/**
 * Boucle d'un trajet : boucle à pas fixe du noyau, avec en option un contrôleur qui expose son
 * terme intégral (`createElevatorPiLoop`).
 */
export type TripLoop = SteppableClosedLoop & {
  readonly controller?: { readonly integral: number };
};

/** Configuration de la machine commune aux niveaux de l'ascenseur. */
export interface ElevatorLevelConfig {
  /** Identifiant du niveau. */
  readonly id: LevelId;
  /** Description du réglage. */
  readonly tuning: TuningSpec;
  /** Valeur initiale du réglage (déjà validée, pas forcément sur la grille). */
  readonly initial: number;
  /** Kp (N/m) du trajet, d'après la valeur réglée. */
  readonly kpOf: (value: number) => number;
  /** Ki (N/(m·s)) du trajet, d'après la valeur réglée. */
  readonly kiOf: (value: number) => number;
  /**
   * Boucle fermée pour une valeur réglée ; appelée à la construction puis à chaque lancement
   * dont la valeur diffère de la précédente.
   */
  readonly createLoop: (value: number) => TripLoop;
  /** Arbitre des issues (un par niveau, remis à zéro à chaque trajet). */
  readonly createJudge: () => OutcomeJudge;
}

/** Niveau de l'ascenseur : machine à états pure, déterministe, pilotée par le temps d'image. */
export interface Level {
  /** Description du réglage (grandeur, bornes, pas). */
  readonly tuning: Readonly<TuningSpec>;
  /** Instantané courant (objet réutilisé, en lecture seule). */
  readonly snapshot: Readonly<LevelSnapshot>;
  /**
   * Signaux r, y, e, uSat du trajet courant, un échantillon par pas (instant k·dt avant le
   * pas, convention du noyau) ; vidé au lancement et à `restart`.
   */
  readonly signals: SignalRecorder;
  /**
   * Avance le niveau d'une durée d'image (s) : horloge à pas fixe du noyau (durée bornée à
   * 0,25 s, 8 pas au plus), puis, pour chaque pas, marche du bonhomme (`approach`) ou pas de
   * simulation et arbitrage de l'issue (`trip`). En pause : aucun pas, horloge figée.
   * @returns l'instantané mis à jour (même objet à chaque appel).
   */
  update(frameSeconds: number): Readonly<LevelSnapshot>;
  /** Intention : marcher vers la gauche (phase `approach` seulement). */
  moveLeft(): CommandResult;
  /** Intention : marcher vers la droite (phase `approach` seulement). */
  moveRight(): CommandResult;
  /** Intention : s'arrêter (phase `approach` seulement). */
  stop(): CommandResult;
  /**
   * Interagir : à la console en `approach`, ouvre le réglage (bonhomme placé devant la
   * console) ; en `tuning`, referme le panneau. Sinon sans effet.
   */
  interact(): CommandResult;
  /**
   * Fixe la grandeur réglée (Kp au niveau 1, Ki au niveau 2), arrondie au pas de la grille et
   * bornée à [min ; max]. Accepté en `approach` et `tuning` ; `locked` en `trip`, `outcome` et
   * `paused` ; `invalid` si la valeur n'est pas finie. Une valeur hors bornes est ramenée à la
   * borne (acceptée).
   */
  setTuning(value: number): CommandResult;
  /** Ajoute `delta` à la grandeur réglée, mêmes règles que {@link Level.setTuning}. */
  adjustTuning(delta: number): CommandResult;
  /** Lance le trajet (phase `tuning` seulement) : consigne 0 → r à k = 0, boucle active. */
  launch(): CommandResult;
  /**
   * Recommencer (phases `trip` et `outcome`) : cabine au sol, boucle, enregistreur et
   * horloge réinitialisés, réglage conservé, essai suivant, retour au réglage (spec §6, point 6).
   */
  restart(): CommandResult;
  /** Met en pause (toute phase sauf `paused`). */
  pause(): CommandResult;
  /** Reprend la phase d'avant la pause, sans saut de temps. */
  resume(): CommandResult;
  /**
   * Consomme les événements en attente (chacun n'est rendu qu'une fois), du plus ancien au
   * plus récent. L'objet passé est réutilisé : le copier pour le garder.
   * @returns le nombre d'événements consommés.
   */
  drainEvents(visitor: (event: Readonly<GameEvent>) => void): number;
}

/**
 * Crée la machine du niveau en phase `approach` : bonhomme à l'entrée, cabine au sol, réglage
 * initial, essai n° 1. Aucune allocation dans `update` (hors création de boucle au lancement,
 * quand le réglage a changé) ; aucune référence conservée vers l'échantillon du noyau ni son
 * état : les nombres sont copiés.
 * @param config voir {@link ElevatorLevelConfig}.
 */
export function createElevatorLevel(config: ElevatorLevelConfig): Level {
  const { tuning, kpOf, kiOf } = config;
  const clock = createFixedStepClock();
  const dt = clock.dt;
  const recorder = createSignalRecorder(TRIP_MAX_STEPS);
  const judge = config.createJudge();
  const events = createEventQueue();
  const walker = createWalker();

  let tuned = config.initial;
  let loop = config.createLoop(tuned);
  let loopTuned = tuned;

  let phase: LevelPhase = 'approach';
  let resumePhase: LevelPhase | null = null;
  let tripActive = false;
  let cabinY = 0;
  let cabinPrevY = 0;
  let cabinVelocity = 0;
  let uSat = 0;
  let saturated = false;
  let k = 0;
  let outcome: TripOutcome | null = null;
  let outcomeK: number | null = null;
  let finalError: number | null = null;
  let saturationSeen = false;
  let saturatedSteps = 0;
  let iTerm = 0;
  let attempt = 1;

  /** Erreur statique théorique m·g/Kp (m) du Kp courant ; `Infinity` si Kp = 0. */
  const theoretical = (): number => {
    const kp = kpOf(tuned);
    return kp > 0 ? CABIN_WEIGHT / kp : Infinity;
  };

  const snapshot: LevelSnapshot = {
    levelId: config.id,
    phase,
    resumePhase,
    walkerX: walker.x,
    walkerPrevX: walker.prevX,
    walkerFacing: walker.facing,
    walkerMoving: false,
    walkerInCabin: false,
    atConsole: walker.atConsole,
    cabinY,
    cabinPrevY,
    cabinVelocity,
    alpha: 0,
    kp: kpOf(tuned),
    ki: kiOf(tuned),
    iTerm,
    r: 0,
    e: 0,
    uSat,
    saturated,
    k,
    t: 0,
    outcome,
    outcomeK,
    finalError,
    theoreticalError: theoretical(),
    saturationSeen,
    saturatedSteps,
    attempt,
  };

  /** Recopie l'état interne dans l'instantané (nombres uniquement, aucune allocation). */
  function writeSnapshot(): void {
    const r = tripActive ? LEVEL1_SETPOINT : 0;
    snapshot.phase = phase;
    snapshot.resumePhase = resumePhase;
    snapshot.walkerX = tripActive ? CABIN_CENTER_X : walker.x;
    snapshot.walkerPrevX = tripActive ? CABIN_CENTER_X : walker.prevX;
    snapshot.walkerFacing = walker.facing;
    snapshot.walkerMoving = walker.intent !== 'none';
    snapshot.walkerInCabin = tripActive;
    snapshot.atConsole = !tripActive && walker.atConsole;
    snapshot.cabinY = cabinY;
    snapshot.cabinPrevY = cabinPrevY;
    snapshot.cabinVelocity = cabinVelocity;
    snapshot.alpha = clock.alpha;
    snapshot.kp = kpOf(tuned);
    snapshot.ki = kiOf(tuned);
    snapshot.iTerm = iTerm;
    snapshot.r = r;
    snapshot.e = r - cabinY;
    snapshot.uSat = uSat;
    snapshot.saturated = saturated;
    snapshot.k = k;
    snapshot.t = k * dt;
    snapshot.outcome = outcome;
    snapshot.outcomeK = outcomeK;
    snapshot.finalError = finalError;
    snapshot.theoreticalError = theoretical();
    snapshot.saturationSeen = saturationSeen;
    snapshot.saturatedSteps = saturatedSteps;
    snapshot.attempt = attempt;
  }

  /** Remet à zéro tout ce qui concerne un trajet (cabine au sol, compteurs, enregistreur). */
  function clearTrip(): void {
    loop.reset();
    judge.reset();
    recorder.clear();
    clock.reset();
    cabinY = 0;
    cabinPrevY = 0;
    cabinVelocity = 0;
    uSat = 0;
    saturated = false;
    k = 0;
    outcome = null;
    outcomeK = null;
    finalError = null;
    saturationSeen = false;
    saturatedSteps = 0;
    iTerm = 0;
  }

  /** Un pas de simulation du trajet ; les nombres sont copiés depuis l'échantillon. */
  function stepTrip(): void {
    cabinPrevY = cabinY;
    const sample = loop.step();
    recorder.push(sample);
    uSat = sample.uSat;
    saturated = sample.saturated;
    k = sample.k + 1;
    const x = loop.x;
    cabinY = x[ELEVATOR_POSITION] as number;
    cabinVelocity = x[ELEVATOR_VELOCITY] as number;
    iTerm = loop.controller?.integral ?? 0;
    if (saturated) {
      saturatedSteps += 1;
      if (!saturationSeen) {
        saturationSeen = true;
        events.push('firstSaturation', k, null, attempt);
      }
    }
    const verdict = judge.evaluate(k, cabinY, cabinVelocity, kpOf(tuned));
    if (verdict !== null) {
      phase = 'outcome';
      outcome = verdict;
      outcomeK = k;
      finalError = LEVEL1_SETPOINT - cabinY;
      events.push('outcome', k, verdict, attempt);
    }
  }

  /** Un pas fixe de jeu, selon la phase. */
  function stepOnce(): void {
    if (phase === 'approach') {
      walker.step(dt);
      return;
    }
    walker.hold();
    if (phase === 'trip') stepTrip();
    else cabinPrevY = cabinY;
  }

  /** Accepte une intention de marche en phase `approach`. */
  function walk(intent: 'left' | 'right' | 'none'): CommandResult {
    if (phase !== 'approach') return 'ignored';
    walker.setIntent(intent);
    writeSnapshot();
    return 'accepted';
  }

  /** Applique une nouvelle valeur du réglage si la phase le permet. */
  function applyTuning(value: number): CommandResult {
    if (phase !== 'approach' && phase !== 'tuning') return 'locked';
    const next = quantizeGain(value, tuning.min, tuning.max, tuning.step);
    if (next === null) return 'invalid';
    tuned = next;
    writeSnapshot();
    return 'accepted';
  }

  /** `adjustTuning` avec un écart non fini : verrouillage prioritaire, sinon refus. */
  function applyTuningInvalid(): CommandResult {
    return phase !== 'approach' && phase !== 'tuning' ? 'locked' : 'invalid';
  }

  return {
    tuning,
    snapshot,
    signals: recorder,
    update(frameSeconds: number): Readonly<LevelSnapshot> {
      if (phase !== 'paused') {
        const steps = clock.advance(frameSeconds);
        for (let i = 0; i < steps; i++) stepOnce();
      }
      writeSnapshot();
      return snapshot;
    },
    moveLeft: () => walk('left'),
    moveRight: () => walk('right'),
    stop: () => walk('none'),
    interact(): CommandResult {
      if (phase === 'approach' && walker.atConsole) {
        phase = 'tuning';
        walker.place(CONSOLE_X, 1);
        clock.reset();
        events.push('tuningOpened', 0, null, attempt);
      } else if (phase === 'tuning') {
        phase = 'approach';
        events.push('tuningClosed', 0, null, attempt);
      } else {
        return 'ignored';
      }
      writeSnapshot();
      return 'accepted';
    },
    setTuning: (value: number) => applyTuning(value),
    adjustTuning: (delta: number) =>
      Number.isFinite(delta) ? applyTuning(tuned + delta) : applyTuningInvalid(),
    launch(): CommandResult {
      if (phase !== 'tuning') return 'ignored';
      if (tuned !== loopTuned) {
        loop = config.createLoop(tuned);
        loopTuned = tuned;
      }
      clearTrip();
      tripActive = true;
      phase = 'trip';
      events.push('launch', 0, null, attempt);
      writeSnapshot();
      return 'accepted';
    },
    restart(): CommandResult {
      if (phase !== 'trip' && phase !== 'outcome') return 'ignored';
      clearTrip();
      tripActive = false;
      attempt += 1;
      phase = 'tuning';
      walker.place(CONSOLE_X, 1);
      events.push('reset', 0, null, attempt);
      writeSnapshot();
      return 'accepted';
    },
    pause(): CommandResult {
      if (phase === 'paused') return 'ignored';
      resumePhase = phase;
      phase = 'paused';
      events.push('pause', k, null, attempt);
      writeSnapshot();
      return 'accepted';
    },
    resume(): CommandResult {
      if (resumePhase === null) return 'ignored';
      phase = resumePhase;
      resumePhase = null;
      events.push('resume', k, null, attempt);
      writeSnapshot();
      return 'accepted';
    },
    drainEvents: (visitor: (event: Readonly<GameEvent>) => void) => events.drain(visitor),
  };
}
