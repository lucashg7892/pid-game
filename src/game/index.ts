/**
 * Logique des niveaux 1 « Le vide » (spec T-001 §6) et 2 « La mémoire » (T-018). Pure et déterministe : n'importe que
 * `src/sim`, ni DOM, ni rendu, ni horloge murale, ni aléa ; données brutes en SI, le
 * formatage et les textes (i18n) sont l'affaire de l'UI.
 */
export * from './constants';
/**
 * Force maximale du moteur (N), paramètres physiques de la cabine (m, g, c) :
 * pour la graduation « max » de la jauge et le tableau d'école (affichage seulement).
 */
export { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS } from '../sim';
export { quantizeGain, quantizeKp } from './kp';
export {
  classifyTimeout,
  classifyTimeout2,
  createOutcomeJudge,
  createOutcomeJudge2,
  type OutcomeJudge,
  type TripOutcome,
} from './outcome';
export {
  ARRIVAL_EPSILON,
  createWalker,
  isAtConsole,
  type Facing,
  type WalkIntent,
  type Walker,
} from './walker';
export {
  EVENT_QUEUE_CAPACITY,
  createEventQueue,
  type EventQueue,
  type GameEvent,
  type GameEventType,
} from './events';
export {
  createElevatorLevel,
  isRunningPhase,
  isSkippablePhase,
  type CommandResult,
  type ElevatorLevelConfig,
  type Level,
  type LevelId,
  type LevelPhase,
  type LevelSnapshot,
  type TripLoop,
  type TunedParam,
  type TuningSpec,
  type WalkerAction,
} from './elevator-level';
export type { TripLog, TripLogColumn } from './trip-log';
export { createLevel1, type Level1, type Level1Options } from './level';
export { createLevel2, type Level2, type Level2Options } from './level2';
