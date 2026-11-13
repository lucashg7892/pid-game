/**
 * Courbe y(t) tracée sur le mur de la cage (T-009) : conversion temps → abscisse et tampon de
 * points préalloué. Fichier pur (ni three ni DOM).
 *
 * Axe vertical : la hauteur RÉELLE (m) ; la courbe et le plancher de la cabine sont à la même
 * altitude, la pointe de la courbe touche le plancher. Axe horizontal : le temps, depuis le bord
 * gauche du plancher ({@link CURVE_ORIGIN_X}) vers la droite, sur au plus {@link CURVE_SPAN}
 * mètres (la largeur du plancher, entre les montants de la cage).
 *
 * Échelle de temps à deux régimes ({@link curveTimeScale}) : {@link CURVE_MAX_SPEED} m/s tant que
 * le trajet dure au plus {@link CURVE_FULL_SPEED_SECONDS} s, puis la courbe entière est
 * resserrée pour que sa pointe reste au bord droit du plancher. Raison : les issues qui
 * s'apprennent sur la forme de la courbe sont courtes (choc avant 0,53 s, victoire vers 2,3 à
 * 2,6 s) et se lisent en grand ; les trajets de 15 s (marche trop haute, pas de décollage) n'ont
 * qu'une montée puis un palier, lisibles même resserrés (0,24 m/s). L'échelle fixe de la spec
 * (0,4 m/s) donnerait 6 m pour 15 s, plus que la cage (4 m), et seulement 0,2 m pour la montée.
 */
import { CABIN_CENTER_X, CABIN_WIDTH, TRIP_MAX_STEPS } from '../game';

/** Abscisse du temps t = 0 : bord gauche du plancher de la cabine (m). */
export const CURVE_ORIGIN_X = CABIN_CENTER_X - CABIN_WIDTH / 2;
/** Longueur maximale de l'axe des temps : largeur du plancher (m). */
export const CURVE_SPAN = CABIN_WIDTH;
/** Échelle de temps maximale (m/s). */
export const CURVE_MAX_SPEED = 1.2;
/** Durée tracée à l'échelle maximale avant resserrement (s). */
export const CURVE_FULL_SPEED_SECONDS = CURVE_SPAN / CURVE_MAX_SPEED;
/** Capacité du tampon : un point par pas du trajet le plus long, plus la pointe interpolée. */
export const CURVE_CAPACITY = TRIP_MAX_STEPS + 1;

/**
 * Échelle de temps (m/s) pour un tracé qui s'arrête à `tEnd` secondes.
 * @param tEnd durée tracée (s) ; ≤ 0 ou non fini : échelle maximale.
 */
export function curveTimeScale(tEnd: number): number {
  if (!Number.isFinite(tEnd) || tEnd <= CURVE_FULL_SPEED_SECONDS) {
    return CURVE_MAX_SPEED;
  }
  return CURVE_SPAN / tEnd;
}

/**
 * Abscisse monde (m) de l'instant `t` à l'échelle `scale`.
 * @param t temps (s).
 * @param scale échelle (m/s).
 */
export function curveX(t: number, scale: number): number {
  return CURVE_ORIGIN_X + t * scale;
}

/** Tampon de points de la courbe, préalloué. */
export class CurveTrace {
  /** Nombre maximal de points. */
  readonly capacity: number;
  /** Points x, y (m) entrelacés ; jamais réalloué. */
  readonly points: Float64Array;
  /** Points écrits depuis le dernier {@link begin}. */
  count = 0;
  /** Points refusés faute de place depuis le dernier {@link begin}. */
  dropped = 0;
  /** Échelle courante (m/s). */
  scale = CURVE_MAX_SPEED;
  /**
   * Ajoute un échantillon (t en s, y en m). Fonction créée une seule fois : passable telle quelle
   * à `SignalRecorder.forEach` sans allocation.
   */
  readonly add: (t: number, y: number) => void;

  /**
   * @param capacity nombre maximal de points (entier ≥ 2).
   * @throws RangeError si la capacité est invalide.
   */
  constructor(capacity: number = CURVE_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new RangeError(`capacité de courbe invalide : ${String(capacity)}`);
    }
    this.capacity = capacity;
    this.points = new Float64Array(capacity * 2);
    this.add = (t: number, y: number): void => {
      if (this.count >= this.capacity) {
        this.dropped += 1;
        return;
      }
      this.points[2 * this.count] = curveX(t, this.scale);
      this.points[2 * this.count + 1] = y;
      this.count += 1;
    };
  }

  /**
   * Vide le tampon et fixe l'échelle pour un tracé qui s'arrête à `tEnd`.
   * @param tEnd durée tracée (s).
   */
  begin(tEnd: number): void {
    this.count = 0;
    this.dropped = 0;
    this.scale = curveTimeScale(tEnd);
  }
}
