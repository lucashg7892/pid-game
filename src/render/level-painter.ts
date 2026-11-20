/**
 * Peintre du niveau 1 au crayon (T-009) : remplit, à chaque image, les lots de traits préalloués
 * d'après l'instantané du niveau et l'enregistreur de signaux. Fichier pur (ni three ni DOM),
 * testable sous Node ; `level-view.ts` envoie ensuite les lots au GPU.
 *
 * Quatre lots, un par matériau et fréquence de mise à jour (et donc un appel de dessin chacun) :
 * - `decor` : quais, cage, poutre, poulies, moteur, pupitre, axe des temps, cadre de la jauge du
 *   terme intégral (niveau 2) ; la force du moteur n'est plus dessinée dans la scène (D36) : elle
 *   est lue sur le pupitre de contrôle ;
 *   redessiné seulement quand la graine du « boiling » ou la taille d'un pixel change ;
 * - `error` : hachures de l'erreur e entre la courbe et la consigne ;
 * - `curve` : courbe y(t) et graduations de seconde ;
 * - `actors` : cabine, câbles, levier, consigne pointillée, bonhomme, cote, jauge I (graphite).
 *
 * Aucune allocation dans {@link LevelPainter.paint} : tableaux de travail créés au constructeur,
 * rappel de l'enregistreur créé une fois ({@link CurveTrace.add}), aucune référence gardée vers
 * l'instantané ni l'enregistreur.
 */
import {
  ARRIVAL_LEDGE_HEIGHT,
  ARRIVAL_LEDGE_MAX_X,
  ARRIVAL_LEDGE_MIN_X,
  BEAM_HEIGHT,
  CABIN_CENTER_X,
  CABIN_WIDTH,
  CONSOLE_X,
  KP_MAX,
  START_LEDGE_HEIGHT,
  START_LEDGE_MAX_X,
  START_LEDGE_MIN_X,
  VOID_MAX_X,
  VOID_MIN_X,
  type LevelSnapshot,
} from '../game';
import { SIM_DT, type SignalRecorder } from '../sim';
import { CURVE_ORIGIN_X, CURVE_SPAN, CurveTrace, curveX } from './curve';
import {
  GAUGE_TICK_COUNT,
  GAUGE_WEIGHT_Y,
  forceToGaugeY,
  gaugeTickY,
  isMajorGaugeTick,
} from './gauge';
import { computeDisplay, createDisplay, type LevelDisplay } from './level-display';
import { boilSeed } from './noise';
import { SEGMENT_STRIDE, dashLine, hatchPolygon } from './patterns';
import {
  BEAM_STUB_LENGTH,
  BEAM_THICKNESS,
  BOIL_RATE_HZ,
  BOIL_SEED_COUNT,
  CABIN_HATCH_SPACING,
  CABIN_PLATE_THICKNESS,
  CAGE_TOP_Y,
  CONSOLE_DESK_HIGH,
  CONSOLE_DESK_LOW,
  CONSOLE_HALF_WIDTH,
  CONSOLE_LEVER_LENGTH,
  CONSOLE_LEVER_SWING,
  CONSOLE_PIVOT_HEIGHT,
  CONSOLE_POST_HEIGHT,
  CURVE_AXIS_Y,
  CURVE_TICK_HALF,
  CURVE_TICK_HALF_MAJOR,
  DANGER_HATCH_SPACING,
  DIMENSION_ARROW,
  DIMENSION_EXT_MAX_X,
  DIMENSION_EXT_MIN_X,
  DIMENSION_X,
  EASEL_CENTER_X,
  EASEL_CROSSBAR_Y,
  EASEL_FRAME_BOTTOM,
  EASEL_FRAME_HALF_WIDTH,
  EASEL_HEIGHT,
  EASEL_LEG_FOOT_HALF,
  EASEL_LEG_TOP_HALF,
  EASEL_SCRIBBLE_POINTS,
  EASEL_SHELF_BOTTOM,
  EASEL_SHELF_HALF_WIDTH,
  ERROR_HATCH_ANGLE,
  ERROR_HATCH_SPACING,
  GAUGE_HATCH_ANGLE,
  GAUGE_HATCH_SPACING,
  GAUGE_I_MAX_X,
  GAUGE_I_MIN_X,
  GAUGE_MAJOR_TICK,
  GAUGE_MAX_Y,
  GAUGE_MIN_Y,
  GAUGE_MINOR_TICK,
  GAUGE_WEIGHT_SIZE,
  HAT_BRIM_HALF,
  HAT_DOME_RADIUS,
  HATCH_ANGLE,
  HATCH_INSET,
  HATCH_SPACING,
  HEAD_RADIUS,
  LEDGE_MASS_BOTTOM,
  MOTOR_RADIUS,
  MOTOR_X,
  MOTOR_Y,
  NECK_TO_HEAD,
  PIT_FLOOR_Y,
  PULLEY_LEFT_X,
  PULLEY_RADIUS,
  PULLEY_RIGHT_X,
  PULLEY_Y,
  RAIL_HEIGHT,
  RAIL_LEFT_X,
  RAIL_RIGHT_X,
  RAIL_TOP_LENGTH,
  SETPOINT_DASH,
  SETPOINT_GAP,
  STYLE_CURVE,
  STYLE_DANGER_OUTLINE,
  STYLE_DIMENSION,
  STYLE_ERROR_HATCH,
  STYLE_FLOOR,
  STYLE_GAUGE_FILL,
  STYLE_GROUND,
  STYLE_HATCH,
  STYLE_HATCH_DANGER,
  STYLE_OUTLINE,
  STYLE_SETPOINT,
  STYLE_THIN,
  STYLE_WALKER,
  type StrokeStyle,
} from './pencil-style';
import { StrokeBatch } from './stroke-batch';
import { HAT_ANGLE_INDEX, JOINT, createPoseBuffer, poseWalker } from './walker-pose';

/**
 * Capacités en sommets de chaque lot (préallouées). Mesuré sous Node (tests, 1280×720, T-022,
 * trajets de 10 s : niveau 1 à Kp = 800 et 100, niveau 2 à Ki = 0 et 100) : décor 6 798 sommets ;
 * courbe 7 266 au plus (1 201 points) ; erreur 4 518 au plus (Kp = 100) ; éléments mobiles 1 620 au plus (1 338 à 1 620 selon le scénario) ;
 * Total préalloué 36 000 sommets = 12 000 triangles au plus, sous le budget de 30 000 triangles
 * même lots pleins.
 */
export const BATCH_CAPACITY = Object.freeze({
  decor: 12_000,
  error: 8_000,
  curve: 12_000,
  actors: 4_000,
});
/** Nombre maximal de sommets du polygone d'erreur (la courbe y est sous-échantillonnée). */
export const ERROR_POLYGON_MAX = 450;
/** Segments de hachure au plus par appel de {@link hatchPolygon}. */
const SEGMENT_CAPACITY = 1024;
/** Intersections retenues au plus par droite de hachure. */
const INTERSECTION_CAPACITY = 64;

/** Bord gauche et droit du plancher de la cabine (m). */
const CABIN_MIN_X = CABIN_CENTER_X - CABIN_WIDTH / 2;
const CABIN_MAX_X = CABIN_CENTER_X + CABIN_WIDTH / 2;

/** Trait d'écriture du tableau : ordonnée, bornes (depuis le centre du chevalet) et phase (rad). */
interface EaselScribble {
  readonly y: number;
  readonly from: number;
  readonly to: number;
  readonly phase: number;
}
/** Demi-largeur utile du tableau pour l'écriture (m). */
const EASEL_INNER = EASEL_FRAME_HALF_WIDTH - 0.1;
/** Traits ondulés évoquant une écriture : longueurs et phases différentes, aucun texte lisible. */
const EASEL_SCRIBBLES: readonly EaselScribble[] = Object.freeze([
  { y: 1.47, from: -EASEL_INNER, to: 0.1, phase: 0.4 },
  { y: 1.33, from: -EASEL_INNER, to: EASEL_INNER - 0.08, phase: 1.7 },
  { y: 1.19, from: -EASEL_INNER, to: 0.02, phase: 2.9 },
  { y: 1.05, from: -EASEL_INNER, to: EASEL_INNER, phase: 4.1 },
  { y: 0.91, from: -EASEL_INNER, to: -0.08, phase: 5.3 },
]);

/** Traits d'un cadre de jauge : rectangle, graduations, repère du poids pointillé et petit poids. */
export const GAUGE_FRAME_STROKES = 22;
/**
 * Traits que la jauge de force dessinait dans le décor, entre le moteur et la console : le cadre
 * d'une jauge ({@link GAUGE_FRAME_STROKES}) plus le fil vers le moteur.
 */
export const FORCE_GAUGE_STROKES = GAUGE_FRAME_STROKES + 1;

/** Lots de traits du niveau et leur remplissage. */
export class LevelPainter {
  /** Décor fixe. */
  readonly decor = new StrokeBatch(BATCH_CAPACITY.decor);
  /** Hachures de l'erreur. */
  readonly error = new StrokeBatch(BATCH_CAPACITY.error);
  /** Courbe y(t) et graduations. */
  readonly curve = new StrokeBatch(BATCH_CAPACITY.curve);
  /** Éléments mobiles au graphite. */
  readonly actors = new StrokeBatch(BATCH_CAPACITY.actors);
  /** Les quatre lots, dans l'ordre de dessin. */
  readonly batches: readonly StrokeBatch[];
  /** Points de la courbe de la dernière image. */
  readonly trace = new CurveTrace();
  /** État affiché de la dernière image. */
  readonly display: LevelDisplay = createDisplay();
  /** Nombre de fois où le décor a été redessiné (diagnostic). */
  decorBuilds = 0;

  private pixelSize = 0;
  private decorSeed = -1;
  private decorPixelSize = -1;
  /** Vrai au niveau 2 : la jauge du terme intégral est dessinée. */
  private integralGauge = false;
  private decorIntegral = false;
  private readonly pose = createPoseBuffer();
  private readonly segments = new Float64Array(SEGMENT_CAPACITY * SEGMENT_STRIDE);
  private readonly scratch = new Float64Array(INTERSECTION_CAPACITY);
  private readonly polygon = new Float64Array((ERROR_POLYGON_MAX + 4) * 2);
  private readonly rectangle = new Float64Array(8);
  private readonly cabinHatch: Float64Array;
  private readonly cabinHatchCount: number;

  constructor() {
    this.batches = Object.freeze([this.decor, this.error, this.curve, this.actors]);
    // Hachures du plateau de la cabine, en coordonnées locales (plancher à y = 0) : calculées
    // une fois, translatées à chaque image.
    this.cabinHatch = new Float64Array(128 * SEGMENT_STRIDE);
    this.setRectangle(CABIN_MIN_X, -CABIN_PLATE_THICKNESS, CABIN_MAX_X, 0);
    this.cabinHatchCount = hatchPolygon(
      this.rectangle,
      4,
      -HATCH_ANGLE,
      CABIN_HATCH_SPACING,
      0,
      this.cabinHatch,
      this.scratch,
    );
  }

  /**
   * Fixe la taille d'un pixel CSS en mètres monde (épaisseur minimale et anti-crénelage).
   * @param metersPerPixel 1 / pixels par mètre ; 0 si inconnue.
   */
  setPixelSize(metersPerPixel: number): void {
    this.pixelSize = Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : 0;
  }

  /**
   * Remplit les lots pour une image.
   * @param s instantané du niveau (lu, jamais conservé).
   * @param signals enregistreur de signaux du niveau (lu, jamais conservé).
   * @param visualSeconds temps visuel écoulé (s), pour le « boiling ».
   * @param reducedMotion préférence `prefers-reduced-motion` : graine figée.
   */
  paint(
    s: Readonly<LevelSnapshot>,
    signals: SignalRecorder,
    visualSeconds: number,
    reducedMotion: boolean,
  ): void {
    const seed = boilSeed(visualSeconds, BOIL_RATE_HZ, BOIL_SEED_COUNT, reducedMotion);
    const batches = this.batches;
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i] as StrokeBatch;
      batch.seed = seed;
      batch.pixelSize = this.pixelSize;
    }
    this.integralGauge = s.levelId === 'level2';
    if (
      seed !== this.decorSeed ||
      this.pixelSize !== this.decorPixelSize ||
      this.integralGauge !== this.decorIntegral
    ) {
      this.decorSeed = seed;
      this.decorPixelSize = this.pixelSize;
      this.decorIntegral = this.integralGauge;
      this.paintDecor();
    }
    computeDisplay(s, this.display);
    this.paintCurve(s, signals);
    this.paintError(s);
    this.paintActors(s);
  }

  /** Sommets écrits dans tous les lots. */
  get vertexCount(): number {
    let total = 0;
    for (let i = 0; i < this.batches.length; i += 1) {
      total += (this.batches[i] as StrokeBatch).vertexCount;
    }
    return total;
  }

  /** Sommets refusés faute de place dans tous les lots (0 attendu). */
  get dropped(): number {
    let total = 0;
    for (let i = 0; i < this.batches.length; i += 1) {
      total += (this.batches[i] as StrokeBatch).dropped;
    }
    return total;
  }

  // -------------------------------------------------------------------------------------------
  // Décor
  // -------------------------------------------------------------------------------------------

  private paintDecor(): void {
    const b = this.decor;
    b.reset();
    this.decorBuilds += 1;
    // Quai de départ.
    b.line(
      START_LEDGE_MIN_X,
      START_LEDGE_HEIGHT,
      START_LEDGE_MAX_X,
      START_LEDGE_HEIGHT,
      STYLE_GROUND,
    );
    this.hatchRect(
      b,
      START_LEDGE_MIN_X,
      LEDGE_MASS_BOTTOM,
      START_LEDGE_MAX_X,
      START_LEDGE_HEIGHT,
      HATCH_ANGLE,
      HATCH_SPACING,
      STYLE_HATCH,
    );
    // Puits de la cage.
    b.line(VOID_MIN_X, PIT_FLOOR_Y, VOID_MAX_X, PIT_FLOOR_Y, STYLE_OUTLINE);
    this.hatchRect(
      b,
      VOID_MIN_X,
      LEDGE_MASS_BOTTOM,
      VOID_MAX_X,
      PIT_FLOOR_Y,
      HATCH_ANGLE,
      HATCH_SPACING,
      STYLE_HATCH,
    );
    // Quai d'arrivée.
    b.line(
      ARRIVAL_LEDGE_MIN_X,
      ARRIVAL_LEDGE_HEIGHT,
      ARRIVAL_LEDGE_MAX_X,
      ARRIVAL_LEDGE_HEIGHT,
      STYLE_GROUND,
    );
    this.hatchRect(
      b,
      ARRIVAL_LEDGE_MIN_X,
      LEDGE_MASS_BOTTOM,
      ARRIVAL_LEDGE_MAX_X,
      ARRIVAL_LEDGE_HEIGHT,
      HATCH_ANGLE,
      HATCH_SPACING,
      STYLE_HATCH,
    );
    // Cage : montants et traverse.
    b.line(VOID_MIN_X, PIT_FLOOR_Y, VOID_MIN_X, CAGE_TOP_Y, STYLE_OUTLINE);
    b.line(VOID_MAX_X, LEDGE_MASS_BOTTOM, VOID_MAX_X, CAGE_TOP_Y, STYLE_OUTLINE);
    b.line(VOID_MIN_X, CAGE_TOP_Y, VOID_MAX_X, CAGE_TOP_Y, STYLE_OUTLINE);
    // Poutre : deux corbeaux hachurés en croix à BEAM_HEIGHT, sur lesquels bute le plancher.
    this.beamStub(VOID_MIN_X, VOID_MIN_X + BEAM_STUB_LENGTH);
    this.beamStub(VOID_MAX_X - BEAM_STUB_LENGTH, VOID_MAX_X);
    // Poulies et câble de tête vers le moteur.
    for (let k = 0; k < 2; k += 1) {
      const x = k === 0 ? PULLEY_LEFT_X : PULLEY_RIGHT_X;
      b.arc(x, PULLEY_Y, PULLEY_RADIUS, STYLE_OUTLINE);
      b.arc(x, PULLEY_Y, PULLEY_RADIUS * 0.22, STYLE_THIN);
      b.line(x, CAGE_TOP_Y, x, PULLEY_Y, STYLE_THIN);
    }
    b.line(PULLEY_LEFT_X, PULLEY_Y + PULLEY_RADIUS, MOTOR_X, MOTOR_Y + MOTOR_RADIUS, STYLE_THIN);
    // Moteur : tambour à rayons, fixé au montant droit.
    b.arc(MOTOR_X, MOTOR_Y, MOTOR_RADIUS, STYLE_OUTLINE);
    for (let k = 0; k < 3; k += 1) {
      const a = (k * Math.PI) / 3;
      const c = Math.cos(a) * MOTOR_RADIUS * 0.85;
      const s = Math.sin(a) * MOTOR_RADIUS * 0.85;
      b.line(MOTOR_X - c, MOTOR_Y - s, MOTOR_X + c, MOTOR_Y + s, STYLE_THIN);
    }
    b.line(VOID_MAX_X, MOTOR_Y - MOTOR_RADIUS * 1.6, MOTOR_X, MOTOR_Y, STYLE_OUTLINE);
    // Jauge de force quittée de la scène (D36) : ses traits (cadre, graduations, repère du poids,
    // fil du moteur) sont sautés, pour que la console, l'axe des temps et le chevalet gardent la
    // graine de tremblé qu'ils avaient.
    b.skipStrokes(FORCE_GAUGE_STROKES);
    // Console : pied, pupitre incliné hachuré, bouton.
    const top = CONSOLE_POST_HEIGHT;
    b.line(CONSOLE_X, START_LEDGE_HEIGHT, CONSOLE_X, top, STYLE_OUTLINE);
    b.line(
      CONSOLE_X - 0.18,
      START_LEDGE_HEIGHT,
      CONSOLE_X + 0.18,
      START_LEDGE_HEIGHT,
      STYLE_OUTLINE,
    );
    const desk = this.polygon;
    desk[0] = CONSOLE_X - CONSOLE_HALF_WIDTH;
    desk[1] = top;
    desk[2] = CONSOLE_X + CONSOLE_HALF_WIDTH;
    desk[3] = top;
    desk[4] = CONSOLE_X + CONSOLE_HALF_WIDTH - 0.05;
    desk[5] = top + CONSOLE_DESK_HIGH;
    desk[6] = CONSOLE_X - CONSOLE_HALF_WIDTH;
    desk[7] = top + CONSOLE_DESK_LOW;
    desk[8] = desk[0];
    desk[9] = desk[1];
    b.polyline(desk, 5, STYLE_OUTLINE);
    this.hatch(b, desk, 4, HATCH_ANGLE, HATCH_SPACING * 0.6, STYLE_HATCH);
    b.arc(CONSOLE_X - 0.15, top + CONSOLE_DESK_LOW + 0.05, 0.035, STYLE_THIN);
    // Axe des temps de la courbe, avec sa flèche.
    const axisEnd = CURVE_ORIGIN_X + CURVE_SPAN;
    b.line(CURVE_ORIGIN_X, CURVE_AXIS_Y, axisEnd, CURVE_AXIS_Y, STYLE_THIN);
    b.line(axisEnd - 0.08, CURVE_AXIS_Y + 0.04, axisEnd, CURVE_AXIS_Y, STYLE_THIN);
    b.line(axisEnd - 0.08, CURVE_AXIS_Y - 0.04, axisEnd, CURVE_AXIS_Y, STYLE_THIN);
    // Jauge du terme intégral (niveau 2), en dernier : le décor du niveau 1 reste inchangé.
    // Graduations tous les 500 N (0 en bas, 5000 N en haut), repère du poids m·g.
    if (this.integralGauge) {
      this.gaugeFrame(GAUGE_I_MIN_X, GAUGE_I_MAX_X);
    }
    // Chevalet du tableau d'école (T-042), tout à la fin : les traits précédents gardent leur
    // graine de tremblé.
    this.paintEasel();
  }

  /**
   * Chevalet et tableau d'école sur le quai de départ : cadre, tablette à craie, pieds, traverse
   * et quelques traits ondulés évoquant une écriture (aucun texte lisible).
   */
  private paintEasel(): void {
    const b = this.decor;
    const cx = EASEL_CENTER_X;
    const half = EASEL_FRAME_HALF_WIDTH;
    const ground = START_LEDGE_HEIGHT;
    // Pieds, sous la tablette ; traverse à mi-hauteur, au point où chaque pied la rencontre.
    const legSpan = EASEL_SHELF_BOTTOM - ground;
    for (let k = 0; k < 2; k += 1) {
      const side = k === 0 ? -1 : 1;
      b.line(
        cx + side * EASEL_LEG_TOP_HALF,
        EASEL_SHELF_BOTTOM,
        cx + side * EASEL_LEG_FOOT_HALF,
        ground,
        STYLE_OUTLINE,
      );
    }
    const barT = (EASEL_SHELF_BOTTOM - (ground + EASEL_CROSSBAR_Y)) / legSpan;
    const barHalf = EASEL_LEG_TOP_HALF + (EASEL_LEG_FOOT_HALF - EASEL_LEG_TOP_HALF) * barT;
    b.line(
      cx - barHalf,
      ground + EASEL_CROSSBAR_Y,
      cx + barHalf,
      ground + EASEL_CROSSBAR_Y,
      STYLE_THIN,
    );
    // Tablette à craie, avec un bâton de craie et un chiffon.
    b.rect(
      cx - EASEL_SHELF_HALF_WIDTH,
      EASEL_SHELF_BOTTOM,
      cx + EASEL_SHELF_HALF_WIDTH,
      EASEL_FRAME_BOTTOM,
      STYLE_THIN,
    );
    const shelfMid = (EASEL_SHELF_BOTTOM + EASEL_FRAME_BOTTOM) / 2;
    b.line(cx - 0.22, shelfMid, cx - 0.12, shelfMid, STYLE_OUTLINE);
    b.rect(cx + 0.2, EASEL_SHELF_BOTTOM + 0.012, cx + 0.32, EASEL_FRAME_BOTTOM - 0.012, STYLE_THIN);
    // Cadre du tableau.
    b.rect(cx - half, EASEL_FRAME_BOTTOM, cx + half, EASEL_HEIGHT, STYLE_OUTLINE);
    // Écriture : traits ondulés (sans texte lisible).
    const points = this.polygon;
    const count = EASEL_SCRIBBLE_POINTS;
    for (let r = 0; r < EASEL_SCRIBBLES.length; r += 1) {
      const row = EASEL_SCRIBBLES[r] as EaselScribble;
      for (let i = 0; i < count; i += 1) {
        const t = i / (count - 1);
        points[2 * i] = cx + row.from + (row.to - row.from) * t;
        points[2 * i + 1] = row.y + 0.022 * Math.sin(row.phase + i * 1.9);
      }
      b.polyline(points, count, STYLE_HATCH);
    }
  }

  /** Cadre d'une jauge de 0 à 5000 N : graduations à gauche, repère m·g (pointillés, poids). */
  private gaugeFrame(minX: number, maxX: number): void {
    const b = this.decor;
    b.rect(minX, GAUGE_MIN_Y, maxX, GAUGE_MAX_Y, STYLE_OUTLINE);
    for (let i = 0; i < GAUGE_TICK_COUNT; i += 1) {
      const y = gaugeTickY(i);
      const length = isMajorGaugeTick(i) ? GAUGE_MAJOR_TICK : GAUGE_MINOR_TICK;
      b.line(minX - length, y, minX, y, STYLE_THIN);
    }
    const dashes = dashLine(
      minX,
      GAUGE_WEIGHT_Y,
      maxX + 0.04,
      GAUGE_WEIGHT_Y,
      0.04,
      0.025,
      this.segments,
    );
    this.segmentsAt(b, this.segments, dashes, 0, 0, STYLE_THIN);
    this.weightIcon(maxX + 0.07, GAUGE_WEIGHT_Y);
  }

  private beamStub(x0: number, x1: number): void {
    const b = this.decor;
    const y0 = BEAM_HEIGHT;
    const y1 = BEAM_HEIGHT + BEAM_THICKNESS;
    this.hatchRect(b, x0, y0, x1, y1, HATCH_ANGLE, DANGER_HATCH_SPACING, STYLE_HATCH_DANGER);
    this.hatchRect(b, x0, y0, x1, y1, -HATCH_ANGLE, DANGER_HATCH_SPACING, STYLE_HATCH_DANGER);
    b.rect(x0, y0, x1, y1, STYLE_DANGER_OUTLINE);
  }

  // -------------------------------------------------------------------------------------------
  // Courbe et erreur
  // -------------------------------------------------------------------------------------------

  private paintCurve(s: Readonly<LevelSnapshot>, signals: SignalRecorder): void {
    const b = this.curve;
    b.reset();
    const trace = this.trace;
    trace.begin(0);
    if (!this.display.tripVisible || s.k === 0) {
      return;
    }
    // Pointe : même instant et même hauteur que le plancher affiché.
    const tip = this.display.phase === 'trip' ? (s.k - 1 + s.alpha) * SIM_DT : s.t;
    trace.begin(tip);
    signals.forEach('y', trace.add);
    trace.add(tip, this.display.cabinY);
    b.polyline(trace.points, trace.count, STYLE_CURVE);
    const seconds = Math.floor(tip + 1e-9);
    for (let second = 0; second <= seconds; second += 1) {
      const x = curveX(second, trace.scale);
      const half = second % 5 === 0 ? CURVE_TICK_HALF_MAJOR : CURVE_TICK_HALF;
      b.line(x, CURVE_AXIS_Y - half, x, CURVE_AXIS_Y + half, STYLE_THIN);
    }
  }

  private paintError(s: Readonly<LevelSnapshot>): void {
    const b = this.error;
    b.reset();
    const trace = this.trace;
    const count = trace.count;
    if (count < 2 || !(s.r > 0)) {
      return;
    }
    const points = trace.points;
    const poly = this.polygon;
    const stride = Math.ceil(count / ERROR_POLYGON_MAX);
    poly[0] = points[0] as number;
    poly[1] = s.r;
    let n = 1;
    for (let i = 0; i < count; i += stride) {
      poly[2 * n] = points[2 * i] as number;
      poly[2 * n + 1] = points[2 * i + 1] as number;
      n += 1;
    }
    if ((count - 1) % stride !== 0) {
      poly[2 * n] = points[2 * count - 2] as number;
      poly[2 * n + 1] = points[2 * count - 1] as number;
      n += 1;
    }
    poly[2 * n] = poly[2 * n - 2] as number;
    poly[2 * n + 1] = s.r;
    n += 1;
    this.hatch(b, poly, n, ERROR_HATCH_ANGLE, ERROR_HATCH_SPACING, STYLE_ERROR_HATCH);
  }

  // -------------------------------------------------------------------------------------------
  // Éléments mobiles
  // -------------------------------------------------------------------------------------------

  private paintActors(s: Readonly<LevelSnapshot>): void {
    const b = this.actors;
    b.reset();
    const d = this.display;
    const y = d.cabinY;
    // Cabine : plancher (le trait le plus appuyé), plateau hachuré, rambarde, câbles.
    b.line(CABIN_MIN_X, y, CABIN_MAX_X, y, STYLE_FLOOR);
    b.line(
      CABIN_MIN_X,
      y - CABIN_PLATE_THICKNESS,
      CABIN_MAX_X,
      y - CABIN_PLATE_THICKNESS,
      STYLE_THIN,
    );
    b.line(CABIN_MIN_X, y, CABIN_MIN_X, y - CABIN_PLATE_THICKNESS, STYLE_THIN);
    b.line(CABIN_MAX_X, y, CABIN_MAX_X, y - CABIN_PLATE_THICKNESS, STYLE_THIN);
    this.segmentsAt(b, this.cabinHatch, this.cabinHatchCount, 0, y, STYLE_HATCH);
    const railTop = y + RAIL_HEIGHT;
    b.line(RAIL_LEFT_X, y, RAIL_LEFT_X, railTop, STYLE_THIN);
    b.line(RAIL_LEFT_X, railTop, RAIL_LEFT_X + RAIL_TOP_LENGTH, railTop, STYLE_THIN);
    b.line(RAIL_RIGHT_X, y, RAIL_RIGHT_X, railTop, STYLE_THIN);
    b.line(RAIL_RIGHT_X, railTop, RAIL_RIGHT_X - RAIL_TOP_LENGTH, railTop, STYLE_THIN);
    b.line(RAIL_LEFT_X, railTop, RAIL_LEFT_X, PULLEY_Y, STYLE_THIN);
    b.line(RAIL_RIGHT_X, railTop, RAIL_RIGHT_X, PULLEY_Y, STYLE_THIN);
    // Levier de la console : son angle suit Kp.
    const kpRatio = Math.min(1, Math.max(0, s.kp / KP_MAX));
    const lever = (kpRatio - 0.5) * 2 * CONSOLE_LEVER_SWING;
    const pivotX = CONSOLE_X + 0.05;
    const pivotY = CONSOLE_POST_HEIGHT + CONSOLE_PIVOT_HEIGHT;
    const knobX = pivotX + CONSOLE_LEVER_LENGTH * Math.sin(lever);
    const knobY = pivotY + CONSOLE_LEVER_LENGTH * Math.cos(lever);
    b.line(pivotX, pivotY, knobX, knobY, STYLE_OUTLINE);
    b.arc(knobX, knobY, 0.04, STYLE_OUTLINE);
    // Consigne r : pointillés qui prolongent le quai d'arrivée à travers la cage.
    if (s.r > 0) {
      const dashes = dashLine(
        VOID_MAX_X,
        s.r,
        VOID_MIN_X,
        s.r,
        SETPOINT_DASH,
        SETPOINT_GAP,
        this.segments,
      );
      this.segmentsAt(b, this.segments, dashes, 0, 0, STYLE_SETPOINT);
    }
    this.paintWalker();
    if (d.phase === 'outcome' && s.outcome === 'win') {
      this.paintDimension(y);
    }
    // En dernier : nombre de traits variable (graines des traits précédents stables).
    if (d.tripVisible) {
      if (this.integralGauge) {
        // Choix : |I| (la jauge montre l'intensité) ; jamais en rouge.
        this.fillGauge(b, GAUGE_I_MIN_X, GAUGE_I_MAX_X, forceToGaugeY(s.iTerm));
      }
    }
  }

  private paintWalker(): void {
    const b = this.actors;
    const d = this.display;
    const p = this.pose;
    poseWalker(p, d.pose, d.walkerX, d.walkerGround, d.facing, d.walkerX);
    const style = STYLE_WALKER;
    // Jambes, buste, bras.
    this.limb(JOINT.hip, JOINT.kneeBack, JOINT.footBack);
    this.limb(JOINT.hip, JOINT.kneeFront, JOINT.footFront);
    b.line(px(p, JOINT.hip), py(p, JOINT.hip), px(p, JOINT.neck), py(p, JOINT.neck), style);
    this.limb(JOINT.shoulder, JOINT.elbowBack, JOINT.handBack);
    this.limb(JOINT.shoulder, JOINT.elbowFront, JOINT.handFront);
    // Cou et tête ronde, avec un œil.
    const hx = px(p, JOINT.head);
    const hy = py(p, JOINT.head);
    const nx = px(p, JOINT.neck);
    const ny = py(p, JOINT.neck);
    const gap = (NECK_TO_HEAD - HEAD_RADIUS) / NECK_TO_HEAD;
    b.line(nx, ny, nx + (hx - nx) * gap, ny + (hy - ny) * gap, style);
    b.arc(hx, hy, HEAD_RADIUS, style);
    b.arc(hx + 0.055 * d.facing, hy + 0.02, 0.012, STYLE_THIN);
    // Chapeau melon : bord et calotte.
    const cx = px(p, JOINT.hat);
    const cy = py(p, JOINT.hat);
    const angle = p[HAT_ANGLE_INDEX] as number;
    const ux = Math.cos(angle) * HAT_BRIM_HALF;
    const uy = Math.sin(angle) * HAT_BRIM_HALF;
    b.line(cx - ux, cy - uy, cx + ux, cy + uy, style);
    b.arc(cx, cy, HAT_DOME_RADIUS, style, angle, Math.PI, 9);
    if (d.pose === 'bonk') {
      // Étoiles autour de la tête.
      for (let k = 0; k < 3; k += 1) {
        const a = Math.PI * (0.25 + 0.25 * k);
        this.star(hx + Math.cos(a) * 0.28, hy + Math.sin(a) * 0.24 + 0.05, 0.05);
      }
    } else if (d.pose === 'akimbo') {
      // Point d'interrogation au-dessus de la tête.
      const qx = hx + 0.05 * d.facing;
      const qy = hy + 0.42;
      b.arc(qx, qy, 0.07, STYLE_THIN, Math.PI * 0.9, -Math.PI * 1.35, 10);
      b.line(qx, qy - 0.07, qx, qy - 0.13, STYLE_THIN);
      b.arc(qx, qy - 0.19, 0.012, STYLE_THIN);
    }
  }

  private limb(a: number, b: number, c: number): void {
    const p = this.pose;
    const batch = this.actors;
    batch.beginPath(STYLE_WALKER.subdivide);
    batch.pathTo(px(p, a), py(p, a));
    batch.pathTo(px(p, b), py(p, b));
    batch.pathTo(px(p, c), py(p, c));
    batch.stroke(STYLE_WALKER);
  }

  private star(x: number, y: number, size: number): void {
    const b = this.actors;
    for (let k = 0; k < 3; k += 1) {
      const a = (k * Math.PI) / 3 + 0.3;
      const c = Math.cos(a) * size;
      const s = Math.sin(a) * size;
      b.line(x - c, y - s, x + c, y + s, STYLE_THIN);
    }
  }

  private paintDimension(floorY: number): void {
    const b = this.actors;
    const top = ARRIVAL_LEDGE_HEIGHT;
    b.line(DIMENSION_EXT_MIN_X, floorY, DIMENSION_EXT_MAX_X, floorY, STYLE_DIMENSION);
    b.line(DIMENSION_EXT_MIN_X, top, DIMENSION_EXT_MAX_X, top, STYLE_DIMENSION);
    const low = Math.min(floorY, top);
    const high = Math.max(floorY, top);
    const a = DIMENSION_ARROW;
    const w = a * 0.55;
    if (high - low >= 2.5 * a) {
      // Pointes à l'intérieur, tournées vers les traits de rappel.
      b.line(DIMENSION_X, low, DIMENSION_X, high, STYLE_DIMENSION);
      b.line(DIMENSION_X - w, high - a, DIMENSION_X, high, STYLE_DIMENSION);
      b.line(DIMENSION_X + w, high - a, DIMENSION_X, high, STYLE_DIMENSION);
      b.line(DIMENSION_X - w, low + a, DIMENSION_X, low, STYLE_DIMENSION);
      b.line(DIMENSION_X + w, low + a, DIMENSION_X, low, STYLE_DIMENSION);
    } else {
      // Cote trop courte : pointes à l'extérieur.
      b.line(DIMENSION_X, low - 2 * a, DIMENSION_X, high + 2 * a, STYLE_DIMENSION);
      b.line(DIMENSION_X - w, high + a, DIMENSION_X, high, STYLE_DIMENSION);
      b.line(DIMENSION_X + w, high + a, DIMENSION_X, high, STYLE_DIMENSION);
      b.line(DIMENSION_X - w, low - a, DIMENSION_X, low, STYLE_DIMENSION);
      b.line(DIMENSION_X + w, low - a, DIMENSION_X, low, STYLE_DIMENSION);
    }
  }

  /** Remplissage hachuré d'une jauge jusqu'à `level` (m), et trait de niveau. */
  private fillGauge(b: StrokeBatch, minX: number, maxX: number, level: number): void {
    if (level - GAUGE_MIN_Y > 2 * HATCH_INSET) {
      this.hatchRect(
        b,
        minX,
        GAUGE_MIN_Y,
        maxX,
        level,
        GAUGE_HATCH_ANGLE,
        GAUGE_HATCH_SPACING,
        STYLE_GAUGE_FILL,
      );
      this.hatchRect(
        b,
        minX,
        GAUGE_MIN_Y,
        maxX,
        level,
        -GAUGE_HATCH_ANGLE,
        GAUGE_HATCH_SPACING * 2,
        STYLE_GAUGE_FILL,
      );
    }
    b.line(minX - 0.03, level, maxX + 0.03, level, STYLE_OUTLINE);
  }

  /** Petit poids (trapèze à anse) : repère de m·g à droite de la jauge. */
  private weightIcon(x: number, y: number): void {
    const b = this.decor;
    const h = GAUGE_WEIGHT_SIZE;
    b.beginPath(0);
    b.pathTo(x, y - h / 2);
    b.pathTo(x + h, y - h / 2);
    b.pathTo(x + h * 0.8, y + h / 2);
    b.pathTo(x + h * 0.2, y + h / 2);
    b.pathTo(x, y - h / 2);
    b.stroke(STYLE_THIN);
    b.arc(x + h / 2, y + h / 2, h * 0.22, STYLE_THIN, 0, Math.PI, 6);
  }

  // -------------------------------------------------------------------------------------------
  // Outils
  // -------------------------------------------------------------------------------------------

  private setRectangle(x0: number, y0: number, x1: number, y1: number): void {
    const r = this.rectangle;
    r[0] = x0;
    r[1] = y0;
    r[2] = x1;
    r[3] = y0;
    r[4] = x1;
    r[5] = y1;
    r[6] = x0;
    r[7] = y1;
  }

  private hatchRect(
    b: StrokeBatch,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    angle: number,
    spacing: number,
    style: StrokeStyle,
  ): void {
    this.setRectangle(x0, y0, x1, y1);
    this.hatch(b, this.rectangle, 4, angle, spacing, style);
  }

  private hatch(
    b: StrokeBatch,
    poly: Float64Array,
    vertexCount: number,
    angle: number,
    spacing: number,
    style: StrokeStyle,
  ): void {
    const count = hatchPolygon(poly, vertexCount, angle, spacing, 0, this.segments, this.scratch);
    this.segmentsAt(b, this.segments, count, 0, 0, style, HATCH_INSET);
  }

  /** Trace des segments translatés de (dx, dy), raccourcis de `inset` à chaque bout. */
  private segmentsAt(
    b: StrokeBatch,
    segments: Float64Array,
    count: number,
    dx: number,
    dy: number,
    style: StrokeStyle,
    inset = 0,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const base = i * SEGMENT_STRIDE;
      let x0 = (segments[base] as number) + dx;
      let y0 = (segments[base + 1] as number) + dy;
      let x1 = (segments[base + 2] as number) + dx;
      let y1 = (segments[base + 3] as number) + dy;
      if (inset > 0) {
        const length = Math.hypot(x1 - x0, y1 - y0);
        if (length <= 2 * inset) {
          continue;
        }
        const ux = ((x1 - x0) / length) * inset;
        const uy = ((y1 - y0) / length) * inset;
        x0 += ux;
        y0 += uy;
        x1 -= ux;
        y1 -= uy;
      }
      b.line(x0, y0, x1, y1, style);
    }
  }
}

function px(pose: Float64Array, joint: number): number {
  return pose[2 * joint] as number;
}

function py(pose: Float64Array, joint: number): number {
  return pose[2 * joint + 1] as number;
}
