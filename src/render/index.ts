/** Rendu (spec T-001 §7) : seul module autorisé à importer three. */

export {
  bootRenderer,
  createFrameLoop,
  detectBackend,
  disposeRenderer,
  hasGraphicsApi,
  observeCanvasSize,
  createReducedMotionWatcher,
  watchReducedMotion,
  type Backend,
  type BootFailureReason,
  type BootResult,
  type FrameLoop,
  type MediaQueryLike,
  type ReducedMotionWatcher,
} from './bootstrap';
export {
  PLAY_ZONE,
  PLAY_ZONE_BELOW_GROUND,
  PLAY_ZONE_MARGIN_X,
  PLAY_ZONE_TOP,
  applyFrame,
  computeFrame,
  worldXToPixel,
  worldYToPixel,
  type Frame,
  type WorldRect,
} from './camera';
export {
  createFailureGuard,
  type FailureGuard,
  type RenderFailure,
  type RenderFailureKind,
} from './failure';
export {
  MAX_PIXEL_RATIO,
  capPixelRatio,
  parseRendererChoice,
  type RendererChoice,
} from './options';
export * from './paper';
export {
  CONSOLE_ANCHOR_Y,
  WALKER_HEAD_TOP,
  choosePose,
  computeAnchors,
  computeDisplay,
  createAnchors,
  createDisplay,
  effectivePhase,
  type LevelAnchors,
  type LevelDisplay,
  type ScreenPoint,
} from './level-display';
export {
  CURVE_CAPACITY,
  CURVE_FULL_SPEED_SECONDS,
  CURVE_MAX_SPEED,
  CURVE_ORIGIN_X,
  CURVE_SPAN,
  curveTimeScale,
  curveX,
} from './curve';
export {
  startRendering,
  type LevelSource,
  type RenderSession,
  type RenderStats,
  type StartOptions,
  type StartResult,
} from './session';
export { CAMERA_FAR, CAMERA_NEAR, CAMERA_Z, createPaperStage, type PaperStage } from './stage';
