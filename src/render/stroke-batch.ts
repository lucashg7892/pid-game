/**
 * Lot de traits de crayon (T-009) : transforme des polylignes en rubans (triangles) dans des
 * tableaux PRÉALLOUÉS, réécrits en place à chaque mise à jour. Fichier pur (ni three ni DOM) : le
 * fichier `level-view.ts` enveloppe ces tableaux dans des `BufferAttribute` sans les copier.
 *
 * Format des sommets (triangles indépendants, 6 sommets par segment de polyligne) :
 * - `positions` : x, y, z (m) ;
 * - `strokes` : coordonnée transversale (−1 bord gauche, +1 bord droit, pour l'anti-crénelage du
 *   shader) et encre (multiplicateur d'opacité).
 *
 * Jointures en onglet (limité à {@link MITER_LIMIT} demi-largeurs) ; segments de longueur nulle
 * ignorés ; épingle (demi-tour) traitée sans NaN. Tremblé de position et d'épaisseur à graine
 * ({@link valueNoise}), variation de pression (encre) le long du trait, extrémités effilées. Aucune allocation après le constructeur.
 */
import { mixSeed, valueNoise } from './noise';
import {
  CIRCLE_SEGMENTS,
  MIN_STROKE_PX,
  MITER_LIMIT,
  PRESSURE_WAVELENGTH,
  STROKE_FRINGE_PX,
  TAPER_MIN,
  WIDTH_WAVELENGTH,
  WOBBLE_WAVELENGTH,
  type StrokeStyle,
} from './pencil-style';

/** Composantes de position par sommet. */
export const POSITION_ITEM_SIZE = 3;
/** Composantes de l'attribut `stroke` par sommet (transversale, encre). */
export const STROKE_ITEM_SIZE = 2;
/** Sommets émis par segment de polyligne (deux triangles). */
export const VERTICES_PER_SEGMENT = 6;
/** Capacité par défaut d'un chemin (points). */
export const DEFAULT_PATH_CAPACITY = 4096;

/** Longueur sous laquelle un segment est considéré comme nul (m). */
const EPSILON = 1e-9;
/** Norme sous laquelle la somme des normales signale une épingle. */
const HAIRPIN = 1e-6;

/** Lot de rubans préalloué. */
export class StrokeBatch {
  /** Capacité en sommets. */
  readonly capacity: number;
  /** Positions x, y, z (m), `capacity × 3` valeurs ; jamais réalloué. */
  readonly positions: Float32Array;
  /** Transversale et encre, `capacity × 2` valeurs ; jamais réalloué. */
  readonly strokes: Float32Array;
  /** Sommets écrits depuis le dernier {@link reset}. */
  vertexCount = 0;
  /** Sommets refusés faute de place depuis le dernier {@link reset}. */
  dropped = 0;
  /**
   * Taille d'un pixel CSS en mètres monde (0 = inconnue) : sert à l'épaisseur minimale
   * ({@link MIN_STROKE_PX}) et à la frange d'anti-crénelage ({@link STROKE_FRINGE_PX}).
   */
  pixelSize = 0;
  /** Graine du tremblé (le « boiling » la change). */
  seed = 0;
  /** Profondeur des sommets écrits (m). */
  z = 0;

  private strokeIndex = 0;
  private pathCount = 0;
  private subdivide = 0;
  private readonly pathCapacity: number;
  private readonly path: Float64Array;
  private readonly arcLength: Float64Array;
  private readonly dirX: Float64Array;
  private readonly dirY: Float64Array;
  private readonly valid: Uint8Array;

  /**
   * @param capacity capacité en sommets (entier ≥ 6).
   * @param pathCapacity nombre maximal de points d'un chemin (entier ≥ 2).
   * @throws RangeError si une capacité est invalide.
   */
  constructor(capacity: number, pathCapacity: number = DEFAULT_PATH_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < VERTICES_PER_SEGMENT) {
      throw new RangeError(`capacité de sommets invalide : ${String(capacity)}`);
    }
    if (!Number.isInteger(pathCapacity) || pathCapacity < 2) {
      throw new RangeError(`capacité de chemin invalide : ${String(pathCapacity)}`);
    }
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * POSITION_ITEM_SIZE);
    this.strokes = new Float32Array(capacity * STROKE_ITEM_SIZE);
    this.pathCapacity = pathCapacity;
    this.path = new Float64Array(pathCapacity * 2);
    this.arcLength = new Float64Array(pathCapacity);
    this.dirX = new Float64Array(pathCapacity);
    this.dirY = new Float64Array(pathCapacity);
    this.valid = new Uint8Array(pathCapacity);
  }

  /** Triangles écrits. */
  get triangleCount(): number {
    return this.vertexCount / 3;
  }

  /** Points du chemin en cours. */
  get pathLength(): number {
    return this.pathCount;
  }

  /** Nombre de traits commencés depuis le dernier {@link reset} (la numérotation des graines). */
  get strokeCount(): number {
    return this.strokeIndex;
  }

  /**
   * Saute `count` numéros de trait sans rien dessiner : les traits suivants gardent la graine de
   * tremblé qu'ils avaient quand les traits sautés existaient encore.
   * @param count nombre de traits à sauter (entier positif).
   */
  skipStrokes(count: number): void {
    this.strokeIndex += count;
  }

  /** Vide le lot (sans réallouer) ; la numérotation des traits repart de zéro. */
  reset(): void {
    this.vertexCount = 0;
    this.dropped = 0;
    this.strokeIndex = 0;
    this.pathCount = 0;
  }

  /**
   * Commence un chemin.
   * @param subdivide longueur maximale d'un segment (m) ; 0 = pas de subdivision.
   */
  beginPath(subdivide = 0): void {
    this.pathCount = 0;
    this.subdivide = subdivide > 0 ? subdivide : 0;
  }

  /**
   * Ajoute un point au chemin, en subdivisant le segment depuis le point précédent si besoin.
   * Les points au-delà de la capacité du chemin sont ignorés.
   * @param x abscisse (m).
   * @param y ordonnée (m).
   */
  pathTo(x: number, y: number): void {
    const count = this.pathCount;
    if (count > 0 && this.subdivide > 0) {
      const x0 = this.path[2 * count - 2] as number;
      const y0 = this.path[2 * count - 1] as number;
      const length = Math.hypot(x - x0, y - y0);
      const pieces = Math.ceil(length / this.subdivide);
      for (let k = 1; k < pieces; k += 1) {
        const f = k / pieces;
        this.push(x0 + (x - x0) * f, y0 + (y - y0) * f);
      }
    }
    this.push(x, y);
  }

  /**
   * Trace le chemin en cours avec `style`, puis le vide.
   * @param style style du trait.
   */
  stroke(style: StrokeStyle): void {
    const n = this.pathCount;
    this.pathCount = 0;
    const strokeSeed = mixSeed(this.seed, this.strokeIndex);
    this.strokeIndex += 1;
    if (n < 2) {
      return;
    }
    const p = this.path;
    const arc = this.arcLength;
    const dirX = this.dirX;
    const dirY = this.dirY;
    const valid = this.valid;
    arc[0] = 0;
    let firstValid = -1;
    for (let j = 0; j < n - 1; j += 1) {
      const dx = (p[2 * j + 2] as number) - (p[2 * j] as number);
      const dy = (p[2 * j + 3] as number) - (p[2 * j + 1] as number);
      const length = Math.hypot(dx, dy);
      arc[j + 1] = (arc[j] as number) + length;
      if (length > EPSILON) {
        dirX[j] = dx / length;
        dirY[j] = dy / length;
        valid[j] = 1;
        if (firstValid < 0) {
          firstValid = j;
        }
      } else {
        valid[j] = 0;
      }
    }
    if (firstValid < 0) {
      return;
    }
    // Directions des segments nuls : celle du dernier segment valide (ou du premier, en tête).
    for (let j = 0; j < n - 1; j += 1) {
      if (valid[j] === 0) {
        const from = j < firstValid ? firstValid : j - 1;
        dirX[j] = dirX[from] as number;
        dirY[j] = dirY[from] as number;
      }
    }
    const total = arc[n - 1] as number;
    const seedWidth = mixSeed(strokeSeed, 1);
    const seedWobble = mixSeed(strokeSeed, 2);
    const seedPressure = mixSeed(strokeSeed, 3);
    const minHalf = 0.5 * MIN_STROKE_PX * this.pixelSize;
    const fringe = 0.5 * STROKE_FRINGE_PX * this.pixelSize;
    let prevLx = 0;
    let prevLy = 0;
    let prevRx = 0;
    let prevRy = 0;
    let prevInk = 0;
    for (let i = 0; i < n; i += 1) {
      const a = i > 0 ? i - 1 : 0;
      const b = i < n - 1 ? i : n - 2;
      const ax = dirX[a] as number;
      const ay = dirY[a] as number;
      const bx = dirX[b] as number;
      const by = dirY[b] as number;
      // Onglet : bissectrice des normales gauches (−dy, dx) des deux segments.
      let mx = -ay - by;
      let my = ax + bx;
      const ml = Math.hypot(mx, my);
      let scale = 1;
      if (ml < HAIRPIN) {
        mx = -ay;
        my = ax;
      } else {
        mx /= ml;
        my /= ml;
        scale = Math.min(1 / (mx * -ay + my * ax), MITER_LIMIT);
      }
      const s = arc[i] as number;
      let half = 0.5 * style.width;
      if (style.widthJitter !== 0) {
        half *= 1 + style.widthJitter * valueNoise(seedWidth, s / WIDTH_WAVELENGTH);
      }
      if (style.taper > 0) {
        const t = Math.min(1, Math.min(s, total - s) / style.taper);
        half *= TAPER_MIN + (1 - TAPER_MIN) * t * t * (3 - 2 * t);
      }
      if (half < minHalf) {
        half = minHalf;
      }
      half += fringe;
      const ink =
        style.pressure === 0
          ? style.ink
          : style.ink *
            (1 - style.pressure * 0.5 * (1 + valueNoise(seedPressure, s / PRESSURE_WAVELENGTH)));
      const wobble =
        style.wobble === 0 ? 0 : style.wobble * valueNoise(seedWobble, s / WOBBLE_WAVELENGTH);
      const cx = (p[2 * i] as number) + mx * wobble;
      const cy = (p[2 * i + 1] as number) + my * wobble;
      const ox = mx * scale * half;
      const oy = my * scale * half;
      const lx = cx + ox;
      const ly = cy + oy;
      const rx = cx - ox;
      const ry = cy - oy;
      if (i > 0 && valid[i - 1] === 1) {
        this.quad(prevLx, prevLy, prevRx, prevRy, prevInk, lx, ly, rx, ry, ink);
      }
      prevInk = ink;
      prevLx = lx;
      prevLy = ly;
      prevRx = rx;
      prevRy = ry;
    }
  }

  /**
   * Trace un segment (subdivisé selon le style, pour le tremblé).
   * @param x0 abscisse de départ (m).
   * @param y0 ordonnée de départ (m).
   * @param x1 abscisse d'arrivée (m).
   * @param y1 ordonnée d'arrivée (m).
   * @param style style du trait.
   */
  line(x0: number, y0: number, x1: number, y1: number, style: StrokeStyle): void {
    this.beginPath(style.subdivide);
    this.pathTo(x0, y0);
    this.pathTo(x1, y1);
    this.stroke(style);
  }

  /**
   * Trace une polyligne lue dans `points` (x0, y0, x1, y1…).
   * @param points coordonnées entrelacées (m).
   * @param count nombre de points à lire.
   * @param style style du trait.
   */
  polyline(points: ArrayLike<number>, count: number, style: StrokeStyle): void {
    this.beginPath(style.subdivide);
    for (let i = 0; i < count; i += 1) {
      this.pathTo(points[2 * i] as number, points[2 * i + 1] as number);
    }
    this.stroke(style);
  }

  /**
   * Trace un cercle fermé (ou un arc).
   * @param cx centre, abscisse (m).
   * @param cy centre, ordonnée (m).
   * @param radius rayon (m).
   * @param style style du trait.
   * @param from angle de départ (rad), défaut 0.
   * @param sweep ouverture (rad), défaut 2π (cercle fermé).
   * @param segments nombre de segments.
   */
  arc(
    cx: number,
    cy: number,
    radius: number,
    style: StrokeStyle,
    from = 0,
    sweep = 2 * Math.PI,
    segments = CIRCLE_SEGMENTS,
  ): void {
    this.beginPath(0);
    for (let k = 0; k <= segments; k += 1) {
      const angle = from + (sweep * k) / segments;
      this.pathTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    this.stroke(style);
  }

  /**
   * Trace le contour fermé d'un rectangle.
   * @param x0 bord gauche (m).
   * @param y0 bord bas (m).
   * @param x1 bord droit (m).
   * @param y1 bord haut (m).
   * @param style style du trait.
   */
  rect(x0: number, y0: number, x1: number, y1: number, style: StrokeStyle): void {
    this.beginPath(style.subdivide);
    this.pathTo(x0, y0);
    this.pathTo(x1, y0);
    this.pathTo(x1, y1);
    this.pathTo(x0, y1);
    this.pathTo(x0, y0);
    this.stroke(style);
  }

  private push(x: number, y: number): void {
    if (this.pathCount >= this.pathCapacity) {
      return;
    }
    this.path[2 * this.pathCount] = x;
    this.path[2 * this.pathCount + 1] = y;
    this.pathCount += 1;
  }

  private quad(
    l0x: number,
    l0y: number,
    r0x: number,
    r0y: number,
    ink0: number,
    l1x: number,
    l1y: number,
    r1x: number,
    r1y: number,
    ink1: number,
  ): void {
    if (this.vertexCount + VERTICES_PER_SEGMENT > this.capacity) {
      this.dropped += VERTICES_PER_SEGMENT;
      return;
    }
    this.vertex(l0x, l0y, -1, ink0);
    this.vertex(r0x, r0y, 1, ink0);
    this.vertex(l1x, l1y, -1, ink1);
    this.vertex(r0x, r0y, 1, ink0);
    this.vertex(r1x, r1y, 1, ink1);
    this.vertex(l1x, l1y, -1, ink1);
  }

  private vertex(x: number, y: number, across: number, ink: number): void {
    const v = this.vertexCount;
    this.positions[3 * v] = x;
    this.positions[3 * v + 1] = y;
    this.positions[3 * v + 2] = this.z;
    this.strokes[2 * v] = across;
    this.strokes[2 * v + 1] = ink;
    this.vertexCount = v + 1;
  }
}
