import {
  ELEVATOR_POSITION,
  ELEVATOR_VELOCITY,
  createFixedStepClock,
  createSignalRecorder,
  elevatorAcceleration,
  type SignalRecorder,
  type SteppableClosedLoop,
} from '../sim';
import {
  CABIN_CENTER_X,
  CABIN_WEIGHT,
  CONSOLE_POST_X,
  EXIT_END_X,
  EXIT_STEP_MAX_X,
  EXIT_STEP_MIN_X,
  LEVEL1_SETPOINT,
  TRIP_MAX_STEPS,
} from './constants';
import { createEventQueue, type GameEvent } from './events';
import { quantizeGain } from './kp';
import type { OutcomeJudge, TripOutcome } from './outcome';
import { createTripLog, type TripLog } from './trip-log';
import { createWalker, isAtConsole, type Facing } from './walker';

/**
 * Phase du niveau (machine à états, spec T-001 §6, décisions D31 et D32) :
 * - `approach` : le bonhomme marche librement sur le quai de départ ;
 * - `tuning` : panneau de réglage ouvert ; le bonhomme rejoint le poste du pupitre en marchant,
 *   ou y est déjà ;
 * - `boarding` : embarquement, après le lancement : le bonhomme marche jusqu'au centre de la
 *   cabine ; réglage verrouillé, physique arrêtée, consigne encore à 0, k = 0 ;
 * - `trip` : simulation active, réglage verrouillé ;
 * - `exit` : sortie, après une victoire : l'issue est jugée (figée au pas de victoire) mais pas
 *   encore affichée ; la cabine est figée, le bonhomme sort sur le plateau d'arrivée ;
 * - `outcome` : trajet terminé, issue affichée, réglage verrouillé jusqu'à `restart` ;
 * - `paused` : tout est figé ; la phase à reprendre est dans `resumePhase`.
 */
export type LevelPhase =
  'approach' | 'tuning' | 'boarding' | 'trip' | 'exit' | 'outcome' | 'paused';

/**
 * Ce que fait le bonhomme (pour le choix de sa pose au rendu) :
 * - `free` : libre sur le quai de départ (phase `approach`) ; `walkerMoving` dit s'il marche ;
 * - `toPost` : marche vers le poste du pupitre, panneau de réglage ouvert ;
 * - `atPost` : au poste, tourné vers le pupitre, main sur le levier ;
 * - `boarding` : marche du quai jusqu'au centre de la cabine (embarquement) ;
 * - `inCabin` : à bord, au centre de la cabine (trajet, issue d'échec, victoire sans animations) ;
 * - `exiting` : marche de sortie, sur le plancher de la cabine avant le pas ou sur le plateau
 *   après (`exitStepProgress` à 0 ou à 1) ;
 * - `stepping` : franchit le pas entre la cabine et le plateau (`exitStepProgress` dans ]0 ; 1[) ;
 * - `arrived` : arrivé sur le plateau, sortie terminée (issue de victoire affichée).
 */
export type WalkerAction =
  'free' | 'toPost' | 'atPost' | 'boarding' | 'inCabin' | 'exiting' | 'stepping' | 'arrived';

/**
 * Vrai pour les phases où le jeu avance sans le joueur (embarquement, trajet, sortie) : l'interface
 * les met en pause quand la fenêtre perd le focus ou que l'aide s'ouvre.
 * @param phase phase du niveau.
 */
export function isRunningPhase(phase: LevelPhase): boolean {
  return phase === 'boarding' || phase === 'trip' || phase === 'exit';
}

/**
 * Vrai pour les phases d'animation que la touche « passer » abrège (embarquement, sortie). La
 * marche vers le poste se passe aussi par {@link Level.skipAnimation}, mais en phase `tuning` la
 * même touche lance le trajet.
 * @param phase phase du niveau.
 */
export function isSkippablePhase(phase: LevelPhase): boolean {
  return phase === 'boarding' || phase === 'exit';
}

/**
 * Résultat d'une commande :
 * - `accepted` : la commande a pris effet ;
 * - `ignored` : sans objet dans la phase courante (rien n'a changé) ;
 * - `locked` : réglage verrouillé (embarquement, trajet, sortie, issue affichée ou pause) ;
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
 * Les grandeurs de la cabine décrivent l'état x(k·dt) APRÈS le dernier pas exécuté, sauf les
 * signaux du dernier pas (`stepY` … `iTermUsed`, `uSat`, `saturated`), pris à l'instant où sa
 * commande a été calculée, (k − 1)·dt.
 */
export interface LevelSnapshot {
  /** Identifiant du niveau (`level1` : contrôleur P ; `level2` : contrôleur PI, Kp fixé). */
  levelId: LevelId;
  /** Phase courante. */
  phase: LevelPhase;
  /** Phase qui reprendra à `resume` ; `null` hors pause. */
  resumePhase: LevelPhase | null;
  /** Abscisse des pieds du bonhomme (m). */
  walkerX: number;
  /** Abscisse du bonhomme au pas précédent (m) : afficher lerp(walkerPrevX, walkerX, alpha). */
  walkerPrevX: number;
  /**
   * Hauteur des pieds du bonhomme (m) : 0 sur le quai de départ et pendant l'embarquement
   * (cabine au sol) ; `cabinY` à bord ; pendant le pas de sortie, de la hauteur finale de la
   * cabine à r ; r sur le plateau d'arrivée.
   */
  walkerY: number;
  /** Hauteur des pieds au pas précédent (m) : afficher lerp(walkerPrevY, walkerY, alpha). */
  walkerPrevY: number;
  /** Orientation du bonhomme (−1 gauche, +1 droite) ; +1 au poste, à bord et en sortie. */
  walkerFacing: Facing;
  /**
   * Vrai si le bonhomme marche : intention du joueur en approche, ou marche automatique vers le
   * poste, la cabine ou le plateau.
   */
  walkerMoving: boolean;
  /** Ce que fait le bonhomme, voir {@link WalkerAction}. */
  walkerAction: WalkerAction;
  /**
   * Progression du pas de sortie, dans [0 ; 1] : 0 avant le bord du plancher de la cabine
   * ({@link EXIT_STEP_MIN_X}), 1 sur le plateau ({@link EXIT_STEP_MAX_X} et au-delà), linéaire en
   * x entre les deux ; 0 hors sortie. walkerY = (1 − p)·yFinal + p·r.
   */
  exitStepProgress: number;
  /**
   * Pas fixes écoulés depuis le début de l'animation en cours (marche vers le poste,
   * embarquement, sortie) ; 0 hors animation (remis à 0 au pas qui la termine).
   */
  animationStep: number;
  /** Vrai si les animations sont actives (option de fabrique, `setAnimations`). */
  animations: boolean;
  /**
   * Vrai si le bonhomme est à bord, porté par le plancher de la cabine : de la fin de
   * l'embarquement jusqu'au début du pas de sortie (trajet, issue d'échec, début de la sortie).
   */
  walkerInCabin: boolean;
  /**
   * Vrai si le bonhomme est sur le quai de départ (phases `approach` et `tuning`) et dans la zone
   * de la console (|x − CONSOLE_X| ≤ CONSOLE_REACH) : l'interface y montre l'invite de la
   * console. Le réglage s'ouvre de n'importe où sur le quai (D31).
   */
  atConsole: boolean;
  /** Vrai si le bonhomme est au poste du pupitre ({@link CONSOLE_POST_X}), panneau ouvert. */
  atPost: boolean;
  /**
   * Hauteur du plancher de la cabine y (m), état APRÈS le dernier pas. Son homologue « avant le
   * pas » est {@link LevelSnapshot.stepY} (la mesure du contrôleur).
   */
  cabinY: number;
  /** Hauteur de la cabine au pas précédent (m) : afficher lerp(cabinPrevY, cabinY, alpha). */
  cabinPrevY: number;
  /**
   * Vitesse verticale de la cabine ẏ (m/s), état APRÈS le dernier pas. Son homologue « avant le
   * pas » est {@link LevelSnapshot.stepVelocity}.
   */
  cabinVelocity: number;
  /** Fraction de pas en attente dans l'horloge, dans [0, 1), pour interpoler l'affichage. */
  alpha: number;
  /** Gain proportionnel courant (N/m) : réglé au niveau 1, fixé au niveau 2. */
  kp: number;
  /** Gain intégral courant (N/(m·s)) : 0 au niveau 1, réglé au niveau 2. */
  ki: number;
  /**
   * Terme intégral I accumulé (N), lu sur le contrôleur APRÈS le dernier pas (son homologue « avant
   * le pas », celui qui a servi à calculer `uCmd`, est {@link LevelSnapshot.iTermUsed}) ; 0 au niveau 1 et
   * avant le premier lancement. Il garde sa valeur à l'issue (affiché par la jauge de I du niveau 2
   * et par la ligne « Terme I » du panneau de mesures) et retombe à 0 au recommencement.
   */
  iTerm: number;
  /**
   * Consigne (m) : 0 avant le départ du trajet (embarquement compris), {@link LEVEL1_SETPOINT}
   * pendant le trajet, la sortie et l'issue.
   */
  r: number;
  /**
   * Erreur e = r − cabinY (m), état APRÈS le dernier pas. Son homologue « avant le pas » est
   * {@link LevelSnapshot.stepError}.
   */
  e: number;
  /**
   * Signaux du dernier pas simulé (`stepY` … `iTermUsed`, `uSat`, `saturated`) : ils
   * décrivent tous le même instant, celui où la commande du dernier pas a été calculée,
   * t = (k − 1)·dt (convention `LoopSample` du noyau : état AVANT le pas), et sont cohérents :
   * uCmd = pTerm + iTermUsed, uSat = uCmd borné à ±Umax, stepError = r − stepY,
   * stepAcceleration = (uSat − m·g − c·stepVelocity)/m (contact au sol compris). Tous à 0 (et
   * `saturated` faux) avant le premier lancement, pendant l'embarquement et après `restart` :
   * cabine posée, moteur coupé. À l'issue (et pendant la sortie), ils gardent les valeurs du
   * dernier pas pour que l'issue puisse les afficher. Ceux de tous les pas du trajet sont
   * conservés dans {@link Level.tripLog}.
   *
   * Hauteur de la cabine y (m) à cet instant (la mesure du contrôleur).
   */
  stepY: number;
  /** Vitesse verticale de la cabine ẏ (m/s) à l'instant du dernier pas (avant le pas). */
  stepVelocity: number;
  /**
   * Accélération verticale de la cabine ÿ (m/s²) à l'instant du dernier pas, donnée par le modèle
   * (somme des forces / masse, `elevatorAcceleration` du noyau, avec les paramètres physiques du
   * noyau) sous la force appliquée `uSat` : jamais une différence entre deux pas ni deux images.
   * Cabine posée au sol et force nette vers le bas : 0.
   */
  stepAcceleration: number;
  /** Erreur vue par le contrôleur au dernier pas, e = r − stepY (m). */
  stepError: number;
  /**
   * Force demandée par le contrôleur au dernier pas, avant saturation (N) ; elle décrit le pas
   * k−1 → k, état AVANT intégration, comme les champs `step*` ; uCmd = pTerm + iTermUsed.
   */
  uCmd: number;
  /**
   * Terme proportionnel Kp·e du dernier pas (N), e = {@link LevelSnapshot.stepError} : pas k−1 → k,
   * état AVANT intégration, comme les champs `step*`.
   */
  pTerm: number;
  /**
   * Terme intégral utilisé pour calculer `uCmd` au dernier pas (N), pas k−1 → k, état AVANT
   * intégration comme les champs `step*` : l'intégrale AVANT sa mise à
   * jour par ce pas (le contrôleur PI calcule u = Kp·e + I puis I ← I + Ki·dt·e). 0 au niveau 1.
   * À distinguer de {@link LevelSnapshot.iTerm}, l'intégrale après le pas.
   */
  iTermUsed: number;
  /** Force appliquée au dernier pas, après saturation (N) ; 0 hors trajet. */
  uSat: number;
  /** Vrai si la force du dernier pas a été écrêtée par la saturation (uSat ≠ uCmd). */
  saturated: boolean;
  /** Nombre de pas exécutés depuis le départ du trajet (sans unité) ; 0 hors trajet. */
  k: number;
  /** Temps de simulation du trajet t = k·dt (s). */
  t: number;
  /**
   * Issue du trajet, ou `null` tant qu'il n'est pas terminé. Renseignée dès le pas de l'issue,
   * donc dès le début de la sortie (`exit`) pour une victoire animée : l'afficher en `outcome`.
   */
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
 * terme intégral et son terme proportionnel (`createElevatorPiLoop`). Sans contrôleur exposé
 * (boucle P du niveau 1), la commande demandée est le terme proportionnel et le terme intégral
 * vaut 0.
 */
export type TripLoop = SteppableClosedLoop & {
  readonly controller?: { readonly integral: number; readonly proportionalTerm: number };
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
  /**
   * Arbitre des issues (un par niveau, remis à zéro à chaque trajet). Il doit rendre une issue au
   * plus tard au pas `TRIP_MAX_STEPS` : le journal du trajet a cette capacité.
   */
  readonly createJudge: () => OutcomeJudge;
  /**
   * Animations de la marche vers le poste, de l'embarquement et de la sortie (défaut `true`).
   * Sans animations : bonhomme placé au poste aussitôt, trajet parti dès le lancement, issue de
   * victoire affichée au pas de victoire, bonhomme resté dans la cabine. La logique ne lit pas
   * `prefers-reduced-motion` : c'est à l'appelant de passer cette option.
   */
  readonly animations?: boolean;
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
   * Journal des signaux de chaque pas du trajet courant (y, v, a, e, uCmd, uSat, p, i,
   * saturated), pour les courbes du pupitre et le curseur de l'issue : vues en lecture seule sur
   * des tableaux préalloués, enregistrement j égal bit à bit aux champs `step*` de l'instantané
   * après le pas j (état AVANT le pas, t = j·dt). Vidé au lancement et à `restart`, conservé
   * pendant la sortie et à l'issue. Objet unique pour toute la vie du niveau ; détails, unités et
   * reconstitution de la cabine dans {@link TripLog}.
   */
  readonly tripLog: TripLog;
  /**
   * Avance le niveau d'une durée d'image (s) : horloge à pas fixe du noyau (durée bornée à
   * 0,25 s, 8 pas au plus), puis, pour chaque pas : marche du bonhomme (`approach`), marche vers
   * le poste (`tuning`), embarquement (`boarding`), pas de simulation et arbitrage de l'issue
   * (`trip`) ou sortie (`exit`). En pause : aucun pas, horloge figée.
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
   * Interagir : en `approach`, de n'importe où sur le quai, ouvre le réglage tout de suite ; le
   * bonhomme rejoint le poste du pupitre en marchant (placé au poste sans animations). En
   * `tuning`, referme le panneau : le bonhomme s'arrête où il est et redevient libre. Sinon sans
   * effet.
   */
  interact(): CommandResult;
  /**
   * Fixe la grandeur réglée (Kp au niveau 1, Ki au niveau 2), arrondie au pas de la grille et
   * bornée à [min ; max]. Accepté en `approach` et `tuning` (aussi pendant la marche vers le
   * poste) ; `locked` en `boarding`, `trip`, `exit`, `outcome` et `paused` ; `invalid` si la
   * valeur n'est pas finie. Une valeur hors bornes est ramenée à la borne (acceptée).
   */
  setTuning(value: number): CommandResult;
  /** Ajoute `delta` à la grandeur réglée, mêmes règles que {@link Level.setTuning}. */
  adjustTuning(delta: number): CommandResult;
  /**
   * Lance (phase `tuning` seulement) : embarquement, puis, le bonhomme au centre de la cabine,
   * départ du trajet : consigne 0 → r à k = 0, boucle active. Sans animations, le trajet part
   * aussitôt.
   */
  launch(): CommandResult;
  /**
   * Recommencer (phases `boarding`, `trip`, `exit` et `outcome`) : cabine au sol, boucle,
   * enregistreur, journal du trajet et horloge réinitialisés, réglage conservé, essai suivant,
   * retour au réglage, bonhomme au poste (spec §6, point 6).
   */
  restart(): CommandResult;
  /**
   * Passe l'animation en cours : marche vers le poste (bonhomme placé au poste), embarquement
   * (bonhomme placé dans la cabine, le trajet part), sortie (bonhomme placé sur le plateau, issue
   * affichée). `ignored` ailleurs, et en pause.
   */
  skipAnimation(): CommandResult;
  /**
   * Active ou désactive les animations, à tout moment. Les désactiver termine aussitôt
   * l'animation en cours, comme {@link Level.skipAnimation} (aussi en pause : la phase à reprendre
   * suit).
   * @param enabled vrai pour animer.
   */
  setAnimations(enabled: boolean): void;
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
 * état : les nombres sont copiés. Les animations avancent par pas fixes de l'horloge de
 * simulation, jamais sur le temps réel.
 * @param config voir {@link ElevatorLevelConfig}.
 */
export function createElevatorLevel(config: ElevatorLevelConfig): Level {
  const { tuning, kpOf, kiOf } = config;
  const clock = createFixedStepClock();
  const dt = clock.dt;
  const recorder = createSignalRecorder(TRIP_MAX_STEPS);
  const tripLog = createTripLog(TRIP_MAX_STEPS, dt);
  const judge = config.createJudge();
  const events = createEventQueue();
  const walker = createWalker();

  let tuned = config.initial;
  let loop = config.createLoop(tuned);
  let loopTuned = tuned;
  let animations = config.animations ?? true;

  let phase: LevelPhase = 'approach';
  let resumePhase: LevelPhase | null = null;
  let tripActive = false;
  let cabinY = 0;
  let cabinPrevY = 0;
  let cabinVelocity = 0;
  let stepY = 0;
  let stepVelocity = 0;
  let stepAcceleration = 0;
  let stepError = 0;
  let uCmd = 0;
  let pTerm = 0;
  let iTermUsed = 0;
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
  let action: WalkerAction = 'free';
  let walkerY = 0;
  let walkerPrevY = 0;
  let exitFromY = 0;
  let stepProgress = 0;
  let animationStep = 0;

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
    walkerY,
    walkerPrevY,
    walkerFacing: walker.facing,
    walkerMoving: false,
    walkerAction: action,
    exitStepProgress: stepProgress,
    animationStep,
    animations,
    walkerInCabin: false,
    atConsole: walker.atConsole,
    atPost: false,
    cabinY,
    cabinPrevY,
    cabinVelocity,
    alpha: 0,
    kp: kpOf(tuned),
    ki: kiOf(tuned),
    iTerm,
    r: 0,
    e: 0,
    stepY,
    stepVelocity,
    stepAcceleration,
    stepError,
    uCmd,
    pTerm,
    iTermUsed,
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

  /** Vrai si le bonhomme marche, d'après son action. */
  function isMoving(): boolean {
    switch (action) {
      case 'free':
        return walker.intent !== 'none';
      case 'toPost':
      case 'boarding':
      case 'exiting':
      case 'stepping':
        return true;
      case 'atPost':
      case 'inCabin':
      case 'arrived':
        return false;
    }
  }

  /** Recopie l'état interne dans l'instantané (nombres uniquement, aucune allocation). */
  function writeSnapshot(): void {
    const r = tripActive ? LEVEL1_SETPOINT : 0;
    const onLedge = action === 'free' || action === 'toPost' || action === 'atPost';
    snapshot.phase = phase;
    snapshot.resumePhase = resumePhase;
    snapshot.walkerX = walker.x;
    snapshot.walkerPrevX = walker.prevX;
    snapshot.walkerY = walkerY;
    snapshot.walkerPrevY = walkerPrevY;
    snapshot.walkerFacing = walker.facing;
    snapshot.walkerMoving = isMoving();
    snapshot.walkerAction = action;
    snapshot.exitStepProgress = stepProgress;
    snapshot.animationStep = animationStep;
    snapshot.animations = animations;
    snapshot.walkerInCabin = action === 'inCabin' || (action === 'exiting' && stepProgress === 0);
    snapshot.atConsole = onLedge && isAtConsole(walker.x);
    snapshot.atPost = action === 'atPost';
    snapshot.cabinY = cabinY;
    snapshot.cabinPrevY = cabinPrevY;
    snapshot.cabinVelocity = cabinVelocity;
    snapshot.alpha = clock.alpha;
    snapshot.kp = kpOf(tuned);
    snapshot.ki = kiOf(tuned);
    snapshot.iTerm = iTerm;
    snapshot.r = r;
    snapshot.e = r - cabinY;
    snapshot.stepY = stepY;
    snapshot.stepVelocity = stepVelocity;
    snapshot.stepAcceleration = stepAcceleration;
    snapshot.stepError = stepError;
    snapshot.uCmd = uCmd;
    snapshot.pTerm = pTerm;
    snapshot.iTermUsed = iTermUsed;
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
    tripLog.clear();
    clock.reset();
    cabinY = 0;
    cabinPrevY = 0;
    cabinVelocity = 0;
    stepY = 0;
    stepVelocity = 0;
    stepAcceleration = 0;
    stepError = 0;
    uCmd = 0;
    pTerm = 0;
    iTermUsed = 0;
    uSat = 0;
    saturated = false;
    k = 0;
    outcome = null;
    outcomeK = null;
    finalError = null;
    saturationSeen = false;
    saturatedSteps = 0;
    iTerm = 0;
    stepProgress = 0;
    animationStep = 0;
  }

  /** Change la phase courante, ou la phase à reprendre si le niveau est en pause. */
  function enterPhase(next: LevelPhase): void {
    if (phase === 'paused') resumePhase = next;
    else phase = next;
  }

  /** Phase effective : en pause, celle qui reprendra. */
  function effectivePhase(): LevelPhase {
    return phase === 'paused' && resumePhase !== null ? resumePhase : phase;
  }

  /** Pose les pieds du bonhomme à la hauteur `y` (m), sans interpolation. */
  function placeY(y: number): void {
    walkerY = y;
    walkerPrevY = y;
  }

  /** Bonhomme placé au poste, sans marche. */
  function placeAtPost(): void {
    walker.place(CONSOLE_POST_X, 1);
    placeY(0);
    action = 'atPost';
    animationStep = 0;
  }

  /** Départ du trajet (k = 0) : bonhomme au centre de la cabine, consigne r, boucle active. */
  function startTrip(): void {
    tripActive = true;
    action = 'inCabin';
    animationStep = 0;
    enterPhase('trip');
  }

  /** Fin de la sortie : bonhomme sur le plateau, issue de victoire affichée et annoncée. */
  function finishExit(): void {
    stepProgress = 1;
    walkerY = LEVEL1_SETPOINT;
    action = 'arrived';
    animationStep = 0;
    enterPhase('outcome');
    // k est figé au pas de l'issue pendant la sortie.
    events.push('outcome', k, outcome, attempt);
  }

  /**
   * Hauteur des pieds pendant la sortie, d'après l'abscisse : yFinal avant le pas, r après,
   * (1 − p)·yFinal + p·r pendant (p = 0 donne yFinal et p = 1 donne r exactement).
   */
  function updateExitHeight(): void {
    const x = walker.x;
    const p =
      x <= EXIT_STEP_MIN_X
        ? 0
        : x >= EXIT_STEP_MAX_X
          ? 1
          : (x - EXIT_STEP_MIN_X) / (EXIT_STEP_MAX_X - EXIT_STEP_MIN_X);
    stepProgress = p;
    walkerY = (1 - p) * exitFromY + p * LEVEL1_SETPOINT;
    action = p > 0 && p < 1 ? 'stepping' : 'exiting';
  }

  /** Termine aussitôt l'animation de la phase effective ; vrai s'il y en avait une. */
  function finishAnimation(): boolean {
    const current = effectivePhase();
    if (current === 'tuning' && action === 'toPost') {
      placeAtPost();
    } else if (current === 'boarding') {
      walker.place(CABIN_CENTER_X, 1);
      placeY(cabinY);
      startTrip();
    } else if (current === 'exit') {
      walker.place(EXIT_END_X, 1);
      finishExit();
      walkerPrevY = walkerY;
    } else {
      return false;
    }
    return true;
  }

  /** Un pas de simulation du trajet ; les nombres sont copiés depuis l'échantillon. */
  function stepTrip(): void {
    cabinPrevY = cabinY;
    const controller = loop.controller;
    // Lus AVANT le pas : la vitesse de l'état où la commande est calculée, et l'intégrale que le
    // contrôleur PI ajoute à Kp·e à ce pas (il ne la met à jour qu'après avoir calculé u).
    const vBefore = loop.x[ELEVATOR_VELOCITY] as number;
    const iBefore = controller === undefined ? 0 : controller.integral;
    const sample = loop.step();
    recorder.push(sample);
    uSat = sample.uSat;
    saturated = sample.saturated;
    stepY = sample.y;
    stepVelocity = vBefore;
    stepAcceleration = elevatorAcceleration(sample.y, vBefore, sample.uSat);
    stepError = sample.e;
    uCmd = sample.uCmd;
    pTerm = controller === undefined ? sample.uCmd : controller.proportionalTerm;
    iTermUsed = iBefore;
    tripLog.record(
      stepY,
      stepVelocity,
      stepAcceleration,
      stepError,
      uCmd,
      uSat,
      pTerm,
      iTermUsed,
      saturated,
    );
    k = sample.k + 1;
    const x = loop.x;
    cabinY = x[ELEVATOR_POSITION] as number;
    cabinVelocity = x[ELEVATOR_VELOCITY] as number;
    iTerm = loop.controller?.integral ?? 0;
    walkerPrevY = cabinPrevY;
    walkerY = cabinY;
    if (saturated) {
      saturatedSteps += 1;
      if (!saturationSeen) {
        saturationSeen = true;
        events.push('firstSaturation', k, null, attempt);
      }
    }
    const verdict = judge.evaluate(k, cabinY, cabinVelocity, kpOf(tuned));
    if (verdict !== null) {
      outcome = verdict;
      outcomeK = k;
      finalError = LEVEL1_SETPOINT - cabinY;
      if (verdict === 'win' && animations) {
        // L'issue est jugée à ce pas ; elle ne s'affiche qu'à la fin de la sortie.
        phase = 'exit';
        action = 'exiting';
        exitFromY = cabinY;
        stepProgress = 0;
        animationStep = 0;
      } else {
        phase = 'outcome';
        events.push('outcome', k, verdict, attempt);
      }
    }
  }

  /** Un pas fixe de jeu, selon la phase. */
  function stepOnce(): void {
    walkerPrevY = walkerY;
    switch (phase) {
      case 'approach':
        walker.step(dt);
        return;
      case 'tuning':
        cabinPrevY = cabinY;
        if (action === 'toPost') {
          animationStep += 1;
          if (walker.stepToward(CONSOLE_POST_X, dt)) {
            // Arrivé au poste : tourné vers le pupitre (prevX gardé pour l'interpolation).
            walker.face(1);
            action = 'atPost';
            animationStep = 0;
          }
        } else {
          walker.hold();
        }
        return;
      case 'boarding':
        animationStep += 1;
        if (walker.stepToward(CABIN_CENTER_X, dt)) startTrip();
        return;
      case 'trip':
        walker.hold();
        stepTrip();
        return;
      case 'exit':
        cabinPrevY = cabinY;
        animationStep += 1;
        if (walker.stepToward(EXIT_END_X, dt)) finishExit();
        else updateExitHeight();
        return;
      default:
        // `outcome` (la pause ne fait aucun pas) : tout reste figé.
        walker.hold();
        cabinPrevY = cabinY;
        return;
    }
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
    tripLog: tripLog.log,
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
      if (phase === 'approach') {
        phase = 'tuning';
        clock.reset();
        if (animations && walker.x !== CONSOLE_POST_X) {
          walker.setIntent('none');
          action = 'toPost';
          animationStep = 0;
        } else {
          placeAtPost();
        }
        events.push('tuningOpened', 0, null, attempt);
      } else if (phase === 'tuning') {
        phase = 'approach';
        action = 'free';
        animationStep = 0;
        walker.hold();
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
      events.push('launch', 0, null, attempt);
      if (animations) {
        phase = 'boarding';
        action = 'boarding';
        walker.hold();
        placeY(0);
      } else {
        walker.place(CABIN_CENTER_X, 1);
        placeY(cabinY);
        startTrip();
      }
      writeSnapshot();
      return 'accepted';
    },
    restart(): CommandResult {
      if (phase !== 'boarding' && phase !== 'trip' && phase !== 'exit' && phase !== 'outcome') {
        return 'ignored';
      }
      clearTrip();
      tripActive = false;
      attempt += 1;
      phase = 'tuning';
      placeAtPost();
      events.push('reset', 0, null, attempt);
      writeSnapshot();
      return 'accepted';
    },
    skipAnimation(): CommandResult {
      if (phase === 'paused' || !finishAnimation()) return 'ignored';
      writeSnapshot();
      return 'accepted';
    },
    setAnimations(enabled: boolean): void {
      animations = enabled;
      if (!enabled) finishAnimation();
      writeSnapshot();
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
