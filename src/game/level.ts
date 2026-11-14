import {
  ELEVATOR_POSITION,
  ELEVATOR_VELOCITY,
  createElevatorLoop,
  createFixedStepClock,
  createSignalRecorder,
  type SignalRecorder,
  type SteppableClosedLoop,
} from '../sim';
import {
  CABIN_CENTER_X,
  CABIN_WEIGHT,
  CONSOLE_X,
  KP_DEFAULT,
  KP_MAX,
  KP_MIN,
  LEVEL1_SETPOINT,
  TRIP_MAX_STEPS,
} from './constants';
import { createEventQueue, type GameEvent } from './events';
import { quantizeKp } from './kp';
import { createOutcomeJudge, type TripOutcome } from './outcome';
import { createWalker, type Facing } from './walker';

/**
 * Phase du niveau (machine à états, spec T-001 §6) :
 * - `approach` : le bonhomme marche vers la console ;
 * - `tuning` : panneau Kp ouvert à la console ;
 * - `trip` : simulation active, Kp verrouillé ;
 * - `outcome` : trajet terminé, issue connue, Kp verrouillé jusqu'à `restart` ;
 * - `paused` : tout est figé ; la phase à reprendre est dans `resumePhase`.
 */
export type LevelPhase = 'approach' | 'tuning' | 'trip' | 'outcome' | 'paused';

/**
 * Résultat d'une commande :
 * - `accepted` : la commande a pris effet ;
 * - `ignored` : sans objet dans la phase courante (rien n'a changé) ;
 * - `locked` : Kp verrouillé (trajet en cours, issue affichée ou pause) ;
 * - `invalid` : valeur non finie refusée.
 */
export type CommandResult = 'accepted' | 'ignored' | 'locked' | 'invalid';

/**
 * Instantané du niveau, pour le rendu et l'UI. Objet unique réécrit après chaque `update` et
 * chaque commande acceptée : à lire, jamais à modifier, à copier pour le conserver.
 * Les grandeurs de la cabine décrivent l'état x(k·dt) APRÈS le dernier pas exécuté.
 */
export interface LevelSnapshot {
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
  /** Gain proportionnel courant (N/m). */
  kp: number;
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

/** Niveau 1 « Le vide » : machine à états pure, déterministe, pilotée par le temps d'image. */
export interface Level1 {
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
   * Fixe Kp (N/m), arrondi au pas de 100 et borné à [0 ; 8000]. Accepté en `approach` et
   * `tuning` ; `locked` en `trip`, `outcome` et `paused` ; `invalid` si la valeur n'est pas
   * finie. Une valeur hors bornes est ramenée à la borne (acceptée).
   */
  setKp(value: number): CommandResult;
  /** Ajoute `delta` (N/m) à Kp, mêmes règles que {@link Level1.setKp}. */
  adjustKp(delta: number): CommandResult;
  /** Lance le trajet (phase `tuning` seulement) : consigne 0 → r à k = 0, boucle active. */
  launch(): CommandResult;
  /**
   * Recommencer (phases `trip` et `outcome`) : cabine au sol, boucle, enregistreur et
   * horloge réinitialisés, Kp conservé, essai suivant, retour au réglage (spec §6, point 6).
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

/** Fabrique par défaut : boucle de l'ascenseur du noyau (spec §5). */
function defaultLoop(kp: number): SteppableClosedLoop {
  return createElevatorLoop({ kp });
}

/**
 * Crée le niveau 1 en phase `approach` : bonhomme à l'entrée, cabine au sol, Kp initial (défaut 500 N/m),
 * essai n° 1. Aucune allocation dans `update` (hors création de boucle au lancement, quand Kp
 * a changé) ; aucune référence conservée vers l'échantillon du noyau ni son état : les
 * nombres sont copiés.
 * @param options voir {@link Level1Options}.
 * @throws RangeError si `options.initialKp` n'est pas fini ou sort de [0 ; 8000].
 */
export function createLevel1(options: Level1Options = {}): Level1 {
  const makeLoop = options.createLoop ?? defaultLoop;
  const initialKp = options.initialKp ?? KP_DEFAULT;
  if (!Number.isFinite(initialKp) || initialKp < KP_MIN || initialKp > KP_MAX) {
    throw new RangeError(
      `initialKp doit être fini et dans [${String(KP_MIN)} ; ${String(KP_MAX)}] (reçu ${String(initialKp)})`,
    );
  }
  const clock = createFixedStepClock();
  const dt = clock.dt;
  const recorder = createSignalRecorder(TRIP_MAX_STEPS);
  const judge = createOutcomeJudge();
  const events = createEventQueue();
  const walker = createWalker();

  let kp = initialKp;
  let loop = makeLoop(kp);
  let loopKp = kp;

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
  let attempt = 1;

  const snapshot: LevelSnapshot = {
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
    kp,
    r: 0,
    e: 0,
    uSat,
    saturated,
    k,
    t: 0,
    outcome,
    outcomeK,
    finalError,
    theoreticalError: kp > 0 ? CABIN_WEIGHT / kp : Infinity,
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
    snapshot.kp = kp;
    snapshot.r = r;
    snapshot.e = r - cabinY;
    snapshot.uSat = uSat;
    snapshot.saturated = saturated;
    snapshot.k = k;
    snapshot.t = k * dt;
    snapshot.outcome = outcome;
    snapshot.outcomeK = outcomeK;
    snapshot.finalError = finalError;
    snapshot.theoreticalError = kp > 0 ? CABIN_WEIGHT / kp : Infinity;
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
    if (saturated) {
      saturatedSteps += 1;
      if (!saturationSeen) {
        saturationSeen = true;
        events.push('firstSaturation', k, null, attempt);
      }
    }
    const verdict = judge.evaluate(k, cabinY, cabinVelocity, kp);
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

  /** Applique une nouvelle valeur de Kp si la phase le permet. */
  function applyKp(value: number): CommandResult {
    if (phase !== 'approach' && phase !== 'tuning') return 'locked';
    const next = quantizeKp(value);
    if (next === null) return 'invalid';
    kp = next;
    writeSnapshot();
    return 'accepted';
  }

  return {
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
    setKp: (value: number) => applyKp(value),
    adjustKp: (delta: number) => (Number.isFinite(delta) ? applyKp(kp + delta) : applyKpInvalid()),
    launch(): CommandResult {
      if (phase !== 'tuning') return 'ignored';
      if (kp !== loopKp) {
        loop = makeLoop(kp);
        loopKp = kp;
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

  /** `adjustKp` avec un écart non fini : verrouillage prioritaire, sinon refus. */
  function applyKpInvalid(): CommandResult {
    return phase !== 'approach' && phase !== 'tuning' ? 'locked' : 'invalid';
  }
}
