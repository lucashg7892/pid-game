/**
 * Feuille de papier millimétré (spec T-001 §7) : un plan qui couvre tout le champ de la caméra,
 * matériau à nœuds TSL (un seul code, compilé en WGSL pour WebGPU et en GLSL pour WebGL2).
 *
 * La grille est calculée en coordonnées MONDE (1 unité = 1 m) : une ligne de mètre passe
 * exactement par chaque entier (x = 0, x = 4, y = 0, y = 3…), ce qui permet de lire les hauteurs
 * sur la feuille. Trois familles de traits, tous les 0,1 m (le « millimètre »), 0,5 m et 1 m (le
 * « centimètre »).
 *
 * Anti-crénelage : la distance au trait le plus proche est convertie en pixels grâce à `fwidth`
 * (mètres par pixel, dérivée écran) ; un trait plus fin qu'un pixel est dessiné sur un pixel avec
 * une intensité réduite d'autant (énergie conservée). Sur petit écran seulement (traits de mètre
 * sous un pixel), chaque trait est posé sur un seul pixel entier (voir `gridLayer`). Anti-moiré :
 * chaque famille s'estompe quand
 * son pas à l'écran tombe sous {@link GRID_FADE_END_PX} pixels et disparaît sous
 * {@link GRID_FADE_START_PX}.
 */
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import {
  abs,
  clamp,
  color,
  float,
  floor,
  fract,
  fwidth,
  hash,
  max,
  mix,
  positionWorld,
  smoothstep,
  step,
} from 'three/tsl';
import type { Frame } from './camera';

/** Couleur du papier : crème légèrement chaud (sRGB). */
export const PAPER_COLOR = '#f7f0de';
/** Couleur des traits du millimètre (0,1 m), bleu-vert pâle (sRGB). */
export const GRID_FINE_COLOR = '#86b9b2';
/** Couleur des traits du demi-centimètre (0,5 m) (sRGB). */
export const GRID_HALF_COLOR = '#5f9f99';
/** Couleur des traits du centimètre (1 m), les plus marqués (sRGB). */
export const GRID_MAJOR_COLOR = '#3d8580';

/** Pas de la grille fine (m). */
export const GRID_FINE_STEP = 0.1;
/** Pas de la grille intermédiaire (m). */
export const GRID_HALF_STEP = 0.5;
/** Pas de la grille principale (m). */
export const GRID_MAJOR_STEP = 1;

/** Épaisseur des traits fins (m). */
export const GRID_FINE_WIDTH = 0.006;
/** Épaisseur des traits intermédiaires (m). */
export const GRID_HALF_WIDTH = 0.012;
/** Épaisseur des traits principaux (m). */
export const GRID_MAJOR_WIDTH = 0.022;

/** Opacité des traits fins. */
export const GRID_FINE_OPACITY = 0.6;
/** Opacité des traits intermédiaires. */
export const GRID_HALF_OPACITY = 0.6;
/** Opacité des traits principaux. */
export const GRID_MAJOR_OPACITY = 0.8;

/**
 * Intensité minimale gardée par un trait plus fin qu'un pixel, par famille : 0 = énergie
 * strictement conservée (le trait pâlit), 1 = toujours à pleine intensité. Les traits principaux
 * restent lisibles (au moins un pixel plein) même sur petit écran.
 */
export const GRID_FINE_MIN_ENERGY = 0;
/** Voir {@link GRID_FINE_MIN_ENERGY}. */
export const GRID_HALF_MIN_ENERGY = 0.4;
/** Voir {@link GRID_FINE_MIN_ENERGY}. */
export const GRID_MAJOR_MIN_ENERGY = 1;

/** Pas à l'écran (pixels) sous lequel une famille de traits est invisible (anti-moiré). */
export const GRID_FADE_START_PX = 2.5;
/** Pas à l'écran (pixels) au-dessus duquel une famille de traits est pleinement visible. */
export const GRID_FADE_END_PX = 6;

/**
 * Régime « un seul pixel » : il dépend de l'échelle de la feuille, mesurée par l'épaisseur à
 * l'écran d'un trait de mètre ({@link GRID_MAJOR_WIDTH}). Au-dessus de {@link GRID_SNAP_END_PX}
 * pixels (bureau : 1,66 px à 1280 × 720, 1,03 px à 800 × 900), le rendu est exactement celui de
 * T-008 ; sous {@link GRID_SNAP_START_PX} (portrait 390 px : 0,50 px), toutes les familles sont
 * posées sur un seul pixel ; fondu continu entre les deux.
 */
export const GRID_SNAP_START_PX = 0.7;
/** Voir {@link GRID_SNAP_START_PX}. */
export const GRID_SNAP_END_PX = 1;
/**
 * Quantification de la position sous-pixel d'un trait (fractions de pixel) avant le choix du
 * pixel : absorbe les erreurs d'arrondi de la coordonnée monde interpolée et de `fwidth`, pour
 * que les deux pixels de part et d'autre d'un trait posé PILE sur une frontière voient
 * exactement −0,5 et +0,5, et que le choix soit le même sur toute la longueur du trait.
 */
export const GRID_SNAP_QUANTUM = 16;

/** Taille d'une cellule de grain de papier (m). */
export const GRAIN_CELL = 0.01;
/** Amplitude crête à crête du grain (fraction de la luminosité). */
export const GRAIN_AMPLITUDE = 0.03;
/** Décalage et pas de ligne du hachage du grain : graine < 2^24, exacte en flottant 32 bits. */
const GRAIN_INDEX_OFFSET = 2048;
const GRAIN_ROW_STRIDE = 4096;

/** Profondeur du plan de papier (m) : derrière tout le reste de la scène. */
export const PAPER_Z = -1;
/** Débord du plan au-delà du champ de la caméra (fraction), contre tout liseré au bord. */
export const PAPER_OVERSCAN = 0.02;

/**
 * Intensité [0, 1] d'une famille de traits au fragment courant.
 *
 * Deux couvertures, mélangées selon l'échelle (voir {@link GRID_SNAP_START_PX}) :
 * - `smooth` : couverture analytique de T-008 (filtre boîte d'un pixel), inchangée ; seule
 *   utilisée à l'échelle du bureau (le mélange vaut alors exactement `smooth`) ;
 * - `snapped` (petit écran) : 1 sur le SEUL pixel dont l'intervalle ]−0,5 ; 0,5] contient le
 *   trait, 0 ailleurs. Sinon, selon sa phase sous-pixel, un trait tombait tantôt sur un pixel
 *   plein (bleu-vert), tantôt sur deux pixels à moitié (brunâtre). La position est quantifiée
 *   au 1/{@link GRID_SNAP_QUANTUM} de pixel avant la comparaison (cas d'égalité déterministe).
 * @param spacing pas de la famille (m).
 * @param width épaisseur des traits (m).
 * @param minEnergy intensité minimale d'un trait plus fin qu'un pixel.
 */
function gridLayer(spacing: number, width: number, minEnergy: number) {
  const p = positionWorld.xy;
  const metersPerPixel = fwidth(p);
  const pixelSize = max(metersPerPixel.x, metersPerPixel.y);
  // Position (pixels) du fragment par rapport au trait le plus proche, sur chaque axe.
  const signedPx = fract(p.div(spacing).add(0.5)).sub(0.5).mul(spacing).div(metersPerPixel);
  const distancePx = abs(signedPx);
  const widthPx = float(width).div(pixelSize);
  const drawnPx = max(widthPx, 1);
  // Recouvrement du pixel par un trait de largeur drawnPx (filtre boîte d'un pixel), T-008.
  const smooth = clamp(drawnPx.mul(0.5).add(0.5).sub(distancePx), 0, 1);
  // Un seul pixel : position quantifiée q, pixel retenu si −0,5 < q ≤ 0,5.
  const quantized = floor(signedPx.mul(GRID_SNAP_QUANTUM).add(0.5)).div(GRID_SNAP_QUANTUM);
  const snapped = step(quantized, 0.5).mul(float(1).sub(step(quantized, -0.5)));
  const majorWidthPx = float(GRID_MAJOR_WIDTH).div(pixelSize);
  const thin = float(1).sub(smoothstep(GRID_SNAP_START_PX, GRID_SNAP_END_PX, majorWidthPx));
  const coverage = mix(smooth, snapped, thin);
  const line = max(coverage.x, coverage.y);
  const energy = clamp(widthPx.div(drawnPx), minEnergy, 1);
  const density = smoothstep(GRID_FADE_START_PX, GRID_FADE_END_PX, float(spacing).div(pixelSize));
  return line.mul(energy).mul(density);
}

/** Crée le matériau du papier (nœuds TSL, valable pour WebGPU et WebGL2). */
export function createPaperMaterial(): MeshBasicNodeMaterial {
  const fine = gridLayer(GRID_FINE_STEP, GRID_FINE_WIDTH, GRID_FINE_MIN_ENERGY);
  const half = gridLayer(GRID_HALF_STEP, GRID_HALF_WIDTH, GRID_HALF_MIN_ENERGY);
  const major = gridLayer(GRID_MAJOR_STEP, GRID_MAJOR_WIDTH, GRID_MAJOR_MIN_ENERGY);

  const withFine = mix(color(PAPER_COLOR), color(GRID_FINE_COLOR), fine.mul(GRID_FINE_OPACITY));
  const withHalf = mix(withFine, color(GRID_HALF_COLOR), half.mul(GRID_HALF_OPACITY));
  const withMajor = mix(withHalf, color(GRID_MAJOR_COLOR), major.mul(GRID_MAJOR_OPACITY));

  // Grain : bruit blanc par cellule monde (hachage PCG de three), très discret.
  const cell = clamp(
    floor(positionWorld.xy.div(GRAIN_CELL)),
    -(GRAIN_INDEX_OFFSET - 1),
    GRAIN_INDEX_OFFSET - 1,
  ).add(GRAIN_INDEX_OFFSET);
  const seed = cell.x.add(cell.y.mul(GRAIN_ROW_STRIDE));
  const grain = hash(seed).sub(0.5).mul(GRAIN_AMPLITUDE).add(1);

  const material = new MeshBasicNodeMaterial();
  material.colorNode = withMajor.mul(grain);
  material.depthWrite = false;
  material.name = 'paper';
  return material;
}

/** Crée le plan de papier (1 m × 1 m, mis à l'échelle par {@link fitPaperToFrame}). */
export function createPaper(): Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  const paper = new Mesh(new PlaneGeometry(1, 1), createPaperMaterial());
  paper.name = 'paper';
  paper.position.z = PAPER_Z;
  paper.renderOrder = -1;
  paper.frustumCulled = false;
  return paper;
}

/**
 * Étire le plan de papier pour couvrir tout le champ de la caméra (plus {@link PAPER_OVERSCAN}).
 * @param paper plan créé par {@link createPaper}.
 * @param frame cadrage courant.
 */
export function fitPaperToFrame(paper: Mesh, frame: Frame): void {
  const scale = 1 + PAPER_OVERSCAN;
  paper.scale.set((frame.right - frame.left) * scale, (frame.top - frame.bottom) * scale, 1);
  paper.position.set((frame.left + frame.right) / 2, (frame.top + frame.bottom) / 2, PAPER_Z);
}
