/**
 * Logique du niveau 1 « Le vide » (spec T-001 §6). Pure et déterministe : n'importe que
 * `src/sim`, ni DOM, ni rendu, ni horloge murale, ni aléa ; données brutes en SI, le
 * formatage et les textes (i18n) sont l'affaire de l'UI.
 */
export * from './constants';
/** Force maximale du moteur (N), pour la graduation « max » de la jauge (affichage seulement). */
export { ELEVATOR_MAX_FORCE } from '../sim';
export { quantizeKp } from './kp';
export {
  classifyTimeout,
  createOutcomeJudge,
  type OutcomeJudge,
  type TripOutcome,
} from './outcome';
export { createWalker, isAtConsole, type Facing, type WalkIntent, type Walker } from './walker';
export {
  EVENT_QUEUE_CAPACITY,
  createEventQueue,
  type EventQueue,
  type GameEvent,
  type GameEventType,
} from './events';
export {
  createLevel1,
  type CommandResult,
  type Level1,
  type Level1Options,
  type LevelPhase,
  type LevelSnapshot,
} from './level';
