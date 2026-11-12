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
  /** Fige le bonhomme : prevX ← x (pas d'interpolation parasite quand il ne marche pas). */
  hold(): void;
  /**
   * Place le bonhomme sans interpolation (x = prevX = abscisse), intention remise à `none`.
   * @param x abscisse (m).
   * @param facing orientation.
   */
  place(x: number, facing: Facing): void;
}

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
    hold(): void {
      prevX = x;
    },
    place(at: number, face: Facing): void {
      x = at;
      prevX = at;
      facing = face;
      intent = 'none';
    },
  };
}
