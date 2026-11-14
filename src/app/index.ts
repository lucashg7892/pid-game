/** État d'application (spec T-017) : machine d'écrans pure et catalogue des niveaux. */
export { LEVELS, type LevelEntry } from './levels';
export {
  createAppMachine,
  type AppListener,
  type AppMachine,
  type AppResult,
  type AppState,
  type ScreenId,
} from './screens';
