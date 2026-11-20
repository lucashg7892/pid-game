/**
 * Partie « D'où vient la force ? » du tableau d'école (T-053, D37) : calculs purs (testables sous
 * Node) des grandeurs que le tableau dessine, tirées de l'instantané du jeu : le ressort de P
 * (force proportionnelle à l'erreur), le bocal de I (terme intégral accumulé, niveau 2), la butée
 * du moteur (saturation à Umax) et le bilan des forces de la cabine. Les valeurs sont celles du
 * dernier pas simulé (`stepError`, `pTerm`, `iTermUsed`, `uCmd`, `uSat`, `stepVelocity`,
 * `stepAcceleration`), donc cohérentes entre elles : uCmd = pTerm + iTermUsed, uSat = uCmd borné.
 * Le dessin est dans `board-forces-view.ts`.
 */
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS, type LevelSnapshot } from '../game';

/** Contenance du bocal : valeur de ∫e dt (m·s) pour laquelle il est plein. */
export const JAR_CAPACITY = 1;

/** Champs de l'instantané dont le calcul a besoin. */
export type ForcesSource = Pick<
  LevelSnapshot,
  | 'levelId'
  | 'k'
  | 'kp'
  | 'ki'
  | 'stepError'
  | 'pTerm'
  | 'iTermUsed'
  | 'uCmd'
  | 'uSat'
  | 'saturated'
  | 'stepVelocity'
  | 'stepAcceleration'
>;

/** Grandeurs affichées, toutes calculées à l'instant du dernier pas du jeu. */
export interface ForcesModel {
  /** Vrai au niveau 2 (bocal I présent). */
  readonly level2: boolean;
  /** Vrai si un trajet a commencé (sinon : tout est à zéro, cabine posée, moteur coupé). */
  readonly started: boolean;
  /** Erreur e = r − y (m) : l'étirement du ressort. */
  readonly error: number;
  /** Raideur du ressort Kp (N/m). */
  readonly kp: number;
  /** Force du ressort P = Kp·e (N). */
  readonly p: number;
  /** Gain intégral Ki (N/(m·s)). */
  readonly ki: number;
  /** Intégrale de l'erreur ∫e dt (m·s) ; 0 au niveau 1. */
  readonly integral: number;
  /** Remplissage du bocal, dans [0 ; 1]. */
  readonly jarFill: number;
  /** Terme intégral I = Ki·∫e dt (N) ; 0 au niveau 1. */
  readonly i: number;
  /** Force demandée u = P + I, avant saturation (N). */
  readonly uCmd: number;
  /** Force appliquée, après saturation (N). */
  readonly uSat: number;
  /** Force maximale du moteur Umax (N). */
  readonly uMax: number;
  /** Part de la demande perdue par la saturation, |uCmd − uSat| (N). */
  readonly clipped: number;
  /** Vrai si la force est écrêtée. */
  readonly saturated: boolean;
  /** Masse de la cabine (kg). */
  readonly mass: number;
  /** Coefficient de frottement c (N·s/m). */
  readonly damping: number;
  /** Poids m·g (N). */
  readonly weight: number;
  /** Vitesse ẏ (m/s). */
  readonly velocity: number;
  /** Frottement visqueux c·ẏ (N). */
  readonly friction: number;
  /** Résultante uSat − m·g − c·ẏ (N). */
  readonly net: number;
  /** Accélération donnée par le jeu (m/s²). */
  readonly acceleration: number;
  /** Vrai si la cabine est retenue par le sol (résultante vers le bas, accélération nulle). */
  readonly grounded: boolean;
}

/** Évite l'affichage « -0 ». */
function clean(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Grandeurs du tableau à partir d'un instantané du jeu.
 * @param s instantané (au moins les champs de {@link ForcesSource}).
 * @param params paramètres physiques (le jeu par défaut).
 * @param uMax force maximale du moteur (le jeu par défaut).
 */
export function computeForces(
  s: Readonly<ForcesSource>,
  params: {
    readonly mass: number;
    readonly gravity: number;
    readonly damping: number;
  } = ELEVATOR_PARAMS,
  uMax: number = ELEVATOR_MAX_FORCE,
): ForcesModel {
  const level2 = s.levelId === 'level2';
  const started = s.k > 0;
  const integral = level2 && s.ki > 0 ? s.iTermUsed / s.ki : 0;
  const weight = params.mass * params.gravity;
  const friction = params.damping * s.stepVelocity;
  const net = s.uSat - weight - friction;
  return {
    level2,
    started,
    error: clean(s.stepError),
    kp: s.kp,
    p: clean(s.pTerm),
    ki: s.ki,
    integral: clean(integral),
    jarFill: Math.max(0, Math.min(1, integral / JAR_CAPACITY)),
    i: clean(level2 ? s.iTermUsed : 0),
    uCmd: clean(s.uCmd),
    uSat: clean(s.uSat),
    uMax,
    clipped: Math.abs(s.uCmd - s.uSat),
    saturated: s.saturated,
    mass: params.mass,
    damping: params.damping,
    weight,
    velocity: clean(s.stepVelocity),
    friction: clean(friction),
    net: clean(net),
    acceleration: clean(s.stepAcceleration),
    grounded: Math.abs(net / params.mass - s.stepAcceleration) > 0.05,
  };
}

/**
 * Longueur signée (px) d'une flèche de force du bilan : croissante avec la force mais PAS à
 * l'échelle (racine carrée), pour que le poids (491 N) reste visible à côté de 5 000 N.
 * @param force force (N), signe = sens (positif vers le haut).
 * @param uMax force maximale (N), qui donne la longueur `max`.
 * @param max longueur maximale (px).
 */
export function arrowLength(force: number, uMax: number, max: number): number {
  if (Math.abs(force) < 0.5) {
    return 0;
  }
  const length = 6 + (max - 6) * Math.sqrt(Math.abs(force) / uMax);
  return Math.sign(force) * Math.min(max, length);
}

/**
 * Longueur (px) du ressort : une longueur au repos plus `perMeter` par mètre d'erreur, jamais
 * en dessous de `min`.
 */
export function springLength(error: number, rest: number, perMeter: number, min: number): number {
  return Math.max(min, rest + error * perMeter);
}

/**
 * Points (attribut `points` SVG) d'un ressort en zigzag entre `x0` et `x1`, à l'ordonnée `y`.
 * @param x0 abscisse d'accroche.
 * @param x1 abscisse de l'extrémité libre.
 * @param y ordonnée de l'axe.
 * @param coils nombre de spires.
 * @param amplitude demi-hauteur du zigzag.
 */
export function springPoints(x0: number, x1: number, y: number, coils = 9, amplitude = 8): string {
  const end = 6;
  const points: string[] = [`${String(x0)},${String(y)}`, `${String(x0 + end)},${String(y)}`];
  const step = (x1 - x0 - 2 * end) / coils;
  for (let k = 0; k < coils; k += 1) {
    const x = x0 + end + (k + 0.5) * step;
    points.push(`${x.toFixed(1)},${String(y + (k % 2 === 0 ? -amplitude : amplitude))}`);
  }
  points.push(`${(x1 - end).toFixed(1)},${String(y)}`, `${x1.toFixed(1)},${String(y)}`);
  return points.join(' ');
}
