/**
 * Interface (spec T-001 §6, §8 ; T-010) : textes DOM superposés au canvas, commandes clavier,
 * tactiles et souris, accessibilité. N'importe que `src/game` et `src/i18n` (règle `ui-deps`) :
 * les ancres écran du rendu lui sont passées par le point de composition sous forme de données.
 */
export { ERROR_DIGITS, announcementFor, formatError, formatKp } from './announce';
export {
  KEY_SEPARATOR,
  KEY_SYMBOLS,
  chooseHint,
  hintLine,
  hintText,
  type HintId,
  type HintItem,
  type HintLine,
  type HintSegment,
} from './hints';
export { bindKeyboard, focusTargetOf } from './input';
export {
  KP_BIG_STEP,
  KP_SMALL_STEP,
  keyToIntent,
  kpDeltaOf,
  walkSideOf,
  type FocusTarget,
  type KeyInput,
  type KeyIntent,
} from './keys';
export {
  BANNER_RESERVE,
  CONSOLE_BOX_ABOVE,
  CONSOLE_HALF_BOX,
  CONSOLE_HIT_ABOVE,
  CONSOLE_HIT_BELOW,
  CONSOLE_HIT_HALF_WIDTH,
  MARGIN,
  MAX_WIDTH,
  MIN_BANNER_BAND,
  MIN_PANEL_BESIDE,
  MIN_SIDE,
  ROTATE_BAR,
  TOP_BAR,
  WALKER_HALF_WIDTH,
  boxExtent,
  computeLayout,
  consoleRect,
  createLayout,
  intersects,
  isConsoleHit,
  walkerOnLedge,
  walkerRect,
  type PanelBox,
  type ScreenRect,
  type ScreenXY,
  type UiGeometry,
  type UiLayout,
} from './layout';
export { createUi, type Ui, type UiOptions } from './overlay';
export {
  createViewModelBuilder,
  effectivePhase,
  staticTexts,
  type StaticTexts,
  type UiState,
  type ViewModel,
  type ViewModelBuilder,
} from './view-model';
