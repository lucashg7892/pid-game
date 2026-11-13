/** Rendu (spec T-001 §7) : seul module autorisé à importer three. */

export {
  bootRenderer,
  createFrameLoop,
  detectBackend,
  disposeRenderer,
  hasGraphicsApi,
  observeCanvasSize,
  prefersReducedMotion,
  type Backend,
  type BootFailureReason,
  type BootResult,
  type FrameLoop,
} from './bootstrap';
export {
  PLAY_ZONE,
  PLAY_ZONE_ABOVE_BEAM,
  PLAY_ZONE_BELOW_GROUND,
  PLAY_ZONE_MARGIN_X,
  applyFrame,
  computeFrame,
  worldXToPixel,
  worldYToPixel,
  type Frame,
  type WorldRect,
} from './camera';
export {
  MAX_PIXEL_RATIO,
  capPixelRatio,
  parseRendererChoice,
  type RendererChoice,
} from './options';
export * from './paper';
export { startRendering, type RenderSession, type RenderStats, type StartResult } from './session';
export { CAMERA_FAR, CAMERA_NEAR, CAMERA_Z, createPaperStage, type PaperStage } from './stage';
