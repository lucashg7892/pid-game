import {
  CONSOLE_REACH,
  CONSOLE_X,
  WALKER_MAX_X,
  WALKER_MIN_X,
  WALKER_SPAWN_X,
  WALKER_SPEED,
} from './constants';

/** Intention de marche : vers la gauche, vers la droite, ou à l'arrêt. */
export type WalkIntent = 'left' | 'right' | 'none';

/** Orientation du bonhomme : −1 regarde à gauche, +1 à droite. */
export type Facing = -1 | 1;

/** Cinématique horizontale du bonhomme sur le quai de départ (sans inertie). */
export interface Walker {
  /** Abscisse courante (m). */
  readonly x: number;
  /** Abscisse au pas précédent (m), pour interpoler l'affichage. */
  readonly prevX: number;
  /** Orientation courante. */
  readonly facing: Facing;
  /** Intention courante. */
  readonly intent: WalkIntent;
  /** Vrai si le bonhomme est dans la zone d'interaction de la console. */
  readonly atConsole: boolean;
  /** Change l'intention ; l'orientation suit la dernière direction demandée. */
  setIntent(intent: WalkIntent): void;
  /**
   * Avance d'un pas : prevX ← x, puis x ← x ± vitesse·dt, borné à
   * [{@link WALKER_MIN_X} ; {@link WALKER_MAX_X}].
   * @param dt durée du pas (s).
   */
  step(dt: number): void;
  /**
   * Marche automatique d'un pas vers `target` (m), à {@link WALKER_SPEED}, SANS les bornes du quai
   * (embarquement, sortie) : prevX ← x, orientation tournée vers la cible, puis x avance de
   * vitesse·dt ; s'il reste au plus un pas (à {@link ARRIVAL_EPSILON} près), x ← target exactement.
   * L'intention manuelle est remise à `none`.
   * @param target abscisse visée (m).
   * @param dt durée du pas (s).
   * @returns vrai si le bonhomme est sur la cible à la fin du pas.
   */
  stepToward(target: number, dt: number): boolean;
  /** Fige le bonhomme : prevX ← x (pas d'interpolation parasite quand il ne marche pas). */
  hold(): void;
  /**
   * Tourne le bonhomme sans le déplacer (x et prevX inchangés).
   * @param facing orientation.
   */
  face(facing: Facing): void;
  /**
   * Place le bonhomme sans interpolation (x = prevX = abscisse), intention remise à `none`.
   * @param x abscisse (m).
   * @param facing orientation.
   */
  place(x: number, facing: Facing): void;
}

/**
 * Tolérance d'arrivée de la marche automatique (m) : absorbe l'arrondi des additions répétées de
 * vitesse·dt (1,5 × 1/120 = 0,0125 m n'est pas exact en binaire), très en dessous d'un pas.
 */
export const ARRIVAL_EPSILON = 1e-9;

/**
 * Vrai si l'abscisse `x` (m) est dans la zone d'interaction de la console :
 * |x − {@link CONSOLE_X}| ≤ {@link CONSOLE_REACH}.
 */
export function isAtConsole(x: number): boolean {
  return Math.abs(x - CONSOLE_X) <= CONSOLE_REACH;
}

/**
 * Crée le bonhomme à {@link WALKER_SPAWN_X}, tourné vers la droite, à l'arrêt.
 * Marche à vitesse constante {@link WALKER_SPEED} (m/s), sans allocation.
 */
export function createWalker(): Walker {
  let x = WALKER_SPAWN_X;
  let prevX = WALKER_SPAWN_X;
  let facing: Facing = 1;
  let intent: WalkIntent = 'none';
  return {
    get x(): number {
      return x;
    },
    get prevX(): number {
      return prevX;
    },
    get facing(): Facing {
      return facing;
    },
    get intent(): WalkIntent {
      return intent;
    },
    get atConsole(): boolean {
      return isAtConsole(x);
    },
    setIntent(next: WalkIntent): void {
      intent = next;
      if (next === 'left') facing = -1;
      else if (next === 'right') facing = 1;
    },
    step(dt: number): void {
      prevX = x;
      if (intent === 'none') return;
      const dx = intent === 'right' ? WALKER_SPEED * dt : -WALKER_SPEED * dt;
      x = Math.min(Math.max(x + dx, WALKER_MIN_X), WALKER_MAX_X);
    },
    stepToward(target: number, dt: number): boolean {
      prevX = x;
      intent = 'none';
      const remaining = target - x;
      const reach = WALKER_SPEED * dt;
      if (remaining !== 0) facing = remaining > 0 ? 1 : -1;
      if (Math.abs(remaining) <= reach + ARRIVAL_EPSILON) {
        x = target;
        return true;
      }
      x += remaining > 0 ? reach : -reach;
      return false;
    },
    hold(): void {
      prevX = x;
    },
    face(face: Facing): void {
      facing = face;
    },
    place(at: number, face: Facing): void {
      x = at;
      prevX = at;
      facing = face;
      intent = 'none';
    },
  };
}
