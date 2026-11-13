/**
 * Cadrage de la caméra orthographique (spec T-001 §7). 1 unité monde = 1 m.
 *
 * Zone de jeu {@link PLAY_ZONE} (toujours entièrement visible) :
 * - x ∈ [−6,5 ; 10,5] m : tout le décor du niveau, du bord gauche du quai de départ
 *   (`LEVEL_MIN_X` = −6, apparition du bonhomme à −5,5) au bord droit du quai d'arrivée
 *   (`LEVEL_MAX_X` = 10), plus 0,5 m de marge de chaque côté ;
 * - y ∈ [−1,5 ; 5,5] m : 1,5 m sous le sol du quai de départ (épaisseur du sol, fond de la cage) et
 *   2,2 m au-dessus de la poutre (`BEAM_HEIGHT` = 3,30 m), de quoi voir un bonhomme d'environ
 *   1,7 m debout sur le quai d'arrivée (y = 3) et un dépassement de la cabine.
 *
 * Soit 17 m × 7 m (rapport 2,43). La spec indiquait « ~12 m × 6,75 m » : 12 m ne contiennent pas
 * les 16 m du décor (`LEVEL_MAX_X − LEVEL_MIN_X`) ; la zone est donc élargie.
 *
 * Adaptation au ratio de la fenêtre : on garde la même échelle (pixels par mètre) en x et en y, la
 * plus grande qui fait tenir toute la zone ; le surplus, réparti également des deux côtés, montre
 * plus de papier. La logique est une fonction pure ; seul {@link applyFrame} touche three (import
 * de type uniquement, effacé à la compilation).
 */
import type { OrthographicCamera } from 'three/webgpu';
import { BEAM_HEIGHT, LEVEL_MAX_X, LEVEL_MIN_X } from '../game';

/** Rectangle en coordonnées monde (m). */
export interface WorldRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Bornes visibles de la caméra orthographique (m) et échelle en pixels CSS par mètre. */
export interface Frame {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  /** Pixels CSS par mètre, identique en x et en y ; 0 si la taille de la fenêtre est invalide. */
  readonly pixelsPerMeter: number;
}

/** Marge horizontale autour du décor (m). */
export const PLAY_ZONE_MARGIN_X = 0.5;
/** Profondeur visible sous le sol du quai de départ (m). */
export const PLAY_ZONE_BELOW_GROUND = 1.5;
/** Hauteur visible au-dessus de la poutre (m). */
export const PLAY_ZONE_ABOVE_BEAM = 2.2;

/** Zone qui doit toujours être entièrement visible : x ∈ [−6,5 ; 10,5], y ∈ [−1,5 ; 5,5] (m). */
export const PLAY_ZONE: WorldRect = Object.freeze({
  minX: LEVEL_MIN_X - PLAY_ZONE_MARGIN_X,
  maxX: LEVEL_MAX_X + PLAY_ZONE_MARGIN_X,
  minY: -PLAY_ZONE_BELOW_GROUND,
  maxY: BEAM_HEIGHT + PLAY_ZONE_ABOVE_BEAM,
});

/**
 * Calcule les bornes de la caméra pour une fenêtre de `widthPx` × `heightPx` pixels CSS. Fonction
 * pure. Taille nulle, négative ou non finie : renvoie exactement la zone, avec `pixelsPerMeter` = 0
 * (jamais de NaN).
 * @param widthPx largeur de la surface de dessin (pixels CSS).
 * @param heightPx hauteur de la surface de dessin (pixels CSS).
 * @param zone zone à garder entièrement visible ; défaut {@link PLAY_ZONE}.
 */
export function computeFrame(
  widthPx: number,
  heightPx: number,
  zone: WorldRect = PLAY_ZONE,
): Frame {
  const zoneWidth = zone.maxX - zone.minX;
  const zoneHeight = zone.maxY - zone.minY;
  const centerX = (zone.minX + zone.maxX) / 2;
  const centerY = (zone.minY + zone.maxY) / 2;
  const valid =
    Number.isFinite(widthPx) && Number.isFinite(heightPx) && widthPx > 0 && heightPx > 0;
  if (!valid) {
    return {
      left: zone.minX,
      right: zone.maxX,
      top: zone.maxY,
      bottom: zone.minY,
      pixelsPerMeter: 0,
    };
  }
  const pixelsPerMeter = Math.min(widthPx / zoneWidth, heightPx / zoneHeight);
  const halfWidth = widthPx / pixelsPerMeter / 2;
  const halfHeight = heightPx / pixelsPerMeter / 2;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY + halfHeight,
    bottom: centerY - halfHeight,
    pixelsPerMeter,
  };
}

/**
 * Abscisse en pixels CSS (depuis le bord gauche) d'un point monde d'abscisse `x`.
 * @param frame cadrage courant.
 * @param widthPx largeur de la surface de dessin (pixels CSS).
 * @param x abscisse monde (m).
 */
export function worldXToPixel(frame: Frame, widthPx: number, x: number): number {
  return ((x - frame.left) / (frame.right - frame.left)) * widthPx;
}

/**
 * Ordonnée en pixels CSS (depuis le bord haut, vers le bas) d'un point monde de hauteur `y`.
 * @param frame cadrage courant.
 * @param heightPx hauteur de la surface de dessin (pixels CSS).
 * @param y hauteur monde (m).
 */
export function worldYToPixel(frame: Frame, heightPx: number, y: number): number {
  return ((frame.top - y) / (frame.top - frame.bottom)) * heightPx;
}

/**
 * Applique un cadrage à une caméra orthographique et recalcule sa matrice de projection.
 * @param camera caméra à modifier.
 * @param frame cadrage calculé par {@link computeFrame}.
 */
export function applyFrame(camera: OrthographicCamera, frame: Frame): void {
  camera.left = frame.left;
  camera.right = frame.right;
  camera.top = frame.top;
  camera.bottom = frame.bottom;
  camera.updateProjectionMatrix();
}
