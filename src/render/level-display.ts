/**
 * Ce que le rendu montre de l'instantané du niveau (T-009) : phase effective, hauteur de cabine
 * et position du bonhomme interpolées, attitude du bonhomme, et ancres en pixels écran pour les
 * textes DOM de l'interface (contrat T-010). Fonctions pures, sans three ni allocation.
 *
 * Interpolation (contrat T-007) : cabine à lerp(cabinPrevY, cabinY, alpha) pendant le trajet,
 * bonhomme à lerp(walkerPrevX, walkerX, alpha) partout, pieds à lerp(walkerPrevY, walkerY, alpha)
 * pendant le trajet et le pas de sortie. À l'issue, la cabine est figée à l'état du pas de
 * l'issue (`cabinY`).
 */
import {
  ARRIVAL_LEDGE_HEIGHT,
  CABIN_CENTER_X,
  CONSOLE_X,
  START_LEDGE_HEIGHT,
  type Facing,
  type LevelPhase,
  type LevelSnapshot,
} from '../game';
import { worldXToPixel, worldYToPixel, type Frame } from './camera';
import { GAUGE_WEIGHT_Y } from './gauge';
import {
  CONSOLE_POST_HEIGHT,
  DIMENSION_X,
  EASEL_CENTER_X,
  EASEL_HEIGHT,
  EASEL_WIDTH,
  GAUGE_I_MAX_X,
  GAUGE_I_MIN_X,
  GAUGE_MAX_X,
  GAUGE_MAX_Y,
  GAUGE_MIN_X,
  HAT_DOME_RADIUS,
  HEAD_RADIUS,
  HIP_HEIGHT,
  NECK_TO_HEAD,
  TORSO_LENGTH,
} from './pencil-style';
import type { WalkerPoseKind } from './walker-pose';

/** Hauteur du haut de la tête (chapeau compris) au-dessus des pieds, debout (m). */
export const WALKER_HEAD_TOP =
  HIP_HEIGHT + TORSO_LENGTH + NECK_TO_HEAD + HEAD_RADIUS + HAT_DOME_RADIUS;
/** Hauteur de l'ancre de la console : dessus du pupitre (m). */
export const CONSOLE_ANCHOR_Y = CONSOLE_POST_HEIGHT + 0.3;

/**
 * Abscisse (m) du bord gauche des étiquettes de l'échelle de la jauge (« max », « poids ») : à
 * droite de la jauge et du petit poids dessiné au repère de m·g.
 */
export const GAUGE_LABEL_X = GAUGE_MAX_X + 0.2;
/**
 * Idem au niveau 2 : les deux jauges partagent l'échelle, dont les étiquettes passent à droite
 * de la jauge du terme intégral.
 */
export const GAUGE_I_LABEL_X = GAUGE_I_MAX_X + 0.2;

/** État affiché, réécrit en place par {@link computeDisplay}. */
export interface LevelDisplay {
  /** Phase effective : en pause, la phase qui reprendra. */
  phase: LevelPhase;
  /** Hauteur affichée du plancher de la cabine (m). */
  cabinY: number;
  /** Abscisse affichée des pieds du bonhomme (m). */
  walkerX: number;
  /** Hauteur du sol sous les pieds du bonhomme (m). */
  walkerGround: number;
  /** Orientation affichée. */
  facing: Facing;
  /** Attitude. */
  pose: WalkerPoseKind;
  /** Vrai si la courbe et l'erreur sont à dessiner (trajet, sortie ou issue). */
  tripVisible: boolean;
}

/** Crée un état affiché (à allouer une fois). */
export function createDisplay(): LevelDisplay {
  return {
    phase: 'approach',
    cabinY: 0,
    walkerX: 0,
    walkerGround: 0,
    facing: 1,
    pose: 'stand',
    tripVisible: false,
  };
}

/**
 * Phase effective : en pause, celle qui reprendra.
 * @param s instantané.
 */
export function effectivePhase(s: Readonly<LevelSnapshot>): LevelPhase {
  return s.phase === 'paused' && s.resumePhase !== null ? s.resumePhase : s.phase;
}

/**
 * Remplit `out` d'après l'instantané (ne garde aucune référence à `s`).
 * @param s instantané du niveau.
 * @param out état affiché à réécrire.
 */
export function computeDisplay(s: Readonly<LevelSnapshot>, out: LevelDisplay): void {
  const phase = effectivePhase(s);
  out.phase = phase;
  out.tripVisible = phase === 'trip' || phase === 'exit' || phase === 'outcome';
  out.cabinY = phase === 'trip' ? s.cabinPrevY + (s.cabinY - s.cabinPrevY) * s.alpha : s.cabinY;
  // Le bonhomme est dessiné où le dit l'instantané, dans toutes les phases (T-038). La hauteur
  // n'est interpolée que là où la cabine l'est aussi (trajet) ou quand elle bouge avec l'abscisse
  // (pas de sortie) ; ailleurs elle est constante ou suit `cabinY` figé.
  out.walkerX = s.walkerPrevX + (s.walkerX - s.walkerPrevX) * s.alpha;
  out.walkerGround =
    phase === 'trip' || s.walkerAction === 'stepping'
      ? s.walkerPrevY + (s.walkerY - s.walkerPrevY) * s.alpha
      : s.walkerY;
  out.facing = s.walkerFacing;
  out.pose = choosePose(phase, s);
}

/**
 * Attitude du bonhomme pour une phase effective.
 * @param phase phase effective.
 * @param s instantané.
 */
export function choosePose(phase: LevelPhase, s: Readonly<LevelSnapshot>): WalkerPoseKind {
  if (phase === 'outcome') {
    switch (s.outcome) {
      case 'win':
        return 'cheer';
      case 'bonk':
        return 'bonk';
      case 'step':
        return 'akimbo';
      case 'noLift':
        return 'shrug';
      case null:
        return 'stand';
    }
  }
  switch (s.walkerAction) {
    case 'free':
      return s.walkerMoving ? 'walk' : 'stand';
    case 'atPost':
      return 'reach';
    case 'toPost':
    case 'boarding':
    case 'exiting':
    case 'stepping':
      return 'walk';
    case 'inCabin':
    case 'arrived':
      return 'stand';
  }
}

/** Point en pixels CSS, depuis le coin haut gauche de la surface de dessin. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Ancres écran pour les textes DOM de l'interface (réécrites en place). */
export interface LevelAnchors {
  /** Dessus du pupitre de la console. */
  readonly console: ScreenPoint;
  /** Centre du plancher de la cabine (hauteur affichée). */
  readonly cabin: ScreenPoint;
  /** Milieu de la cote d'erreur statique (dessinée seulement à la victoire). */
  readonly errorDimension: ScreenPoint;
  /** Haut de la tête du bonhomme (chapeau compris). */
  readonly walkerHead: ScreenPoint;
  /** Milieu du bord haut de l'ancien emplacement de la jauge de force : référence de mise en page. */
  readonly forceGauge: ScreenPoint;
  /** Bord gauche, au niveau du haut de l'échelle des jauges (« 5000 N max » ; niveau 2 : à droite de la jauge I). */
  readonly gaugeMax: ScreenPoint;
  /** Bord gauche, au niveau du repère du poids m·g (étiquette « poids »). */
  readonly gaugeWeight: ScreenPoint;
  /** Milieu du bord haut de la jauge du terme intégral (niveau 2). */
  readonly iGauge: ScreenPoint;
  /** Coin haut gauche du chevalet du tableau d'école (cadre et pieds : zone cliquable). */
  readonly boardTopLeft: ScreenPoint;
  /** Coin bas droit du chevalet, au sol. */
  readonly boardBottomRight: ScreenPoint;
  /** Vrai si la cote d'erreur est dessinée. */
  errorDimensionVisible: boolean;
  /** Vrai au niveau 2 : la jauge du terme intégral est dessinée. */
  iGaugeVisible: boolean;
}

/** Crée des ancres (à allouer une fois). */
export function createAnchors(): LevelAnchors {
  return {
    console: { x: 0, y: 0 },
    cabin: { x: 0, y: 0 },
    errorDimension: { x: 0, y: 0 },
    walkerHead: { x: 0, y: 0 },
    forceGauge: { x: 0, y: 0 },
    gaugeMax: { x: 0, y: 0 },
    gaugeWeight: { x: 0, y: 0 },
    iGauge: { x: 0, y: 0 },
    boardTopLeft: { x: 0, y: 0 },
    boardBottomRight: { x: 0, y: 0 },
    errorDimensionVisible: false,
    iGaugeVisible: false,
  };
}

/** Remet les ancres à zéro (aucun niveau affiché : plus rien de périmé à lire). */
export function resetAnchors(out: LevelAnchors): void {
  for (const point of [
    out.console,
    out.cabin,
    out.errorDimension,
    out.walkerHead,
    out.forceGauge,
    out.gaugeMax,
    out.gaugeWeight,
    out.iGauge,
    out.boardTopLeft,
    out.boardBottomRight,
  ]) {
    point.x = 0;
    point.y = 0;
  }
  out.errorDimensionVisible = false;
  out.iGaugeVisible = false;
}

function place(
  point: ScreenPoint,
  frame: Frame,
  widthPx: number,
  heightPx: number,
  x: number,
  y: number,
): void {
  point.x = worldXToPixel(frame, widthPx, x);
  point.y = worldYToPixel(frame, heightPx, y);
}

/**
 * Calcule les ancres écran (pixels CSS) des éléments que l'interface annote.
 * @param frame cadrage courant.
 * @param widthPx largeur de la surface (pixels CSS).
 * @param heightPx hauteur de la surface (pixels CSS).
 * @param display état affiché ({@link computeDisplay}).
 * @param s instantané (pour l'issue).
 * @param out ancres à réécrire.
 */
export function computeAnchors(
  frame: Frame,
  widthPx: number,
  heightPx: number,
  display: Readonly<LevelDisplay>,
  s: Readonly<LevelSnapshot>,
  out: LevelAnchors,
): void {
  place(out.console, frame, widthPx, heightPx, CONSOLE_X, CONSOLE_ANCHOR_Y);
  place(out.cabin, frame, widthPx, heightPx, CABIN_CENTER_X, display.cabinY);
  place(
    out.errorDimension,
    frame,
    widthPx,
    heightPx,
    DIMENSION_X,
    (display.cabinY + ARRIVAL_LEDGE_HEIGHT) / 2,
  );
  place(
    out.walkerHead,
    frame,
    widthPx,
    heightPx,
    display.walkerX,
    display.walkerGround + WALKER_HEAD_TOP,
  );
  place(out.forceGauge, frame, widthPx, heightPx, (GAUGE_MIN_X + GAUGE_MAX_X) / 2, GAUGE_MAX_Y);
  const withIntegral = s.levelId === 'level2';
  const labelX = withIntegral ? GAUGE_I_LABEL_X : GAUGE_LABEL_X;
  place(out.gaugeMax, frame, widthPx, heightPx, labelX, GAUGE_MAX_Y);
  place(out.gaugeWeight, frame, widthPx, heightPx, labelX, GAUGE_WEIGHT_Y);
  place(out.iGauge, frame, widthPx, heightPx, (GAUGE_I_MIN_X + GAUGE_I_MAX_X) / 2, GAUGE_MAX_Y);
  place(
    out.boardTopLeft,
    frame,
    widthPx,
    heightPx,
    EASEL_CENTER_X - EASEL_WIDTH / 2,
    START_LEDGE_HEIGHT + EASEL_HEIGHT,
  );
  place(
    out.boardBottomRight,
    frame,
    widthPx,
    heightPx,
    EASEL_CENTER_X + EASEL_WIDTH / 2,
    START_LEDGE_HEIGHT,
  );
  out.iGaugeVisible = withIntegral;
  out.errorDimensionVisible = display.phase === 'outcome' && s.outcome === 'win';
}
