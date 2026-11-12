import { SIM_DT } from '../clock';
import { createProportionalController } from '../controllers/p';
import { createRk4 } from '../integrators';
import { createClosedLoop, type SteppableClosedLoop } from '../loop';
import { createSaturation } from '../saturation';
import type { PlantModel } from '../types';

/** Paramètres physiques de la cabine (spec T-001 §5). */
export interface ElevatorParams {
  /** Masse m de la cabine, bonhomme compris (kg), finie et > 0. */
  readonly mass: number;
  /** Pesanteur g (m/s²), finie. */
  readonly gravity: number;
  /** Coefficient de frottement visqueux c des glissières (N·s/m), fini et ≥ 0. */
  readonly damping: number;
}

/** Valeurs de la spec T-001 §5 : m = 50 kg, g = 9,81 m/s², c = 400 N·s/m. */
export const ELEVATOR_PARAMS: Readonly<ElevatorParams> = Object.freeze({
  mass: 50,
  gravity: 9.81,
  damping: 400,
});

/** Saturation du moteur Umax (N), ≈ 10·m·g (spec T-001 §5). La commande est bornée à ±Umax. */
export const ELEVATOR_MAX_FORCE = 5000;

/** Consigne r (m) : hauteur du quai d'arrivée (spec T-001 §5). */
export const ELEVATOR_SETPOINT = 3;

/** Dimension de l'état de l'ascenseur : x = [y, ẏ]. */
export const ELEVATOR_STATE_SIZE = 2;

/** Indice de la position verticale y (m, sol = 0) dans l'état. */
export const ELEVATOR_POSITION = 0;

/** Indice de la vitesse verticale ẏ (m/s, positive vers le haut) dans l'état. */
export const ELEVATOR_VELOCITY = 1;

/** Hauteur du sol (m) : contrainte y ≥ 0. */
const GROUND_HEIGHT = 0;

/**
 * Crée le modèle de l'ascenseur (spec T-001 §5), état x = [y (m), ẏ (m/s)] :
 *
 *   m·ÿ = u − m·g − c·ẏ   ⇒   dy/dt = ẏ,  dẏ/dt = (u − m·g − c·ẏ) / m,
 *
 * où u (N) est la force du moteur déjà saturée par la boucle. Sortie mesurée : y (m).
 * Contrainte de contact sol (appliquée par la boucle après chaque pas) : si y < 0 alors
 * y = 0 et ẏ = max(ẏ, 0). NaN n'est pas corrigé (propagé, jamais masqué).
 * `derivative`, `output` et `constrain` n'allouent rien.
 * @param params paramètres physiques ; défaut {@link ELEVATOR_PARAMS}.
 * @throws RangeError si un paramètre est hors domaine.
 */
export function createElevator(params: Readonly<ElevatorParams> = ELEVATOR_PARAMS): PlantModel {
  const { mass, gravity, damping } = params;
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new RangeError(`mass doit être finie et > 0 (reçu ${String(mass)})`);
  }
  if (!Number.isFinite(gravity)) {
    throw new RangeError(`gravity doit être finie (reçu ${String(gravity)})`);
  }
  if (!Number.isFinite(damping) || damping < 0) {
    throw new RangeError(`damping doit être fini et ≥ 0 (reçu ${String(damping)})`);
  }
  /** Poids m·g (N), calculé une fois. */
  const weight = mass * gravity;

  return {
    stateSize: ELEVATOR_STATE_SIZE,
    derivative(x: Readonly<Float64Array>, u: number, out: Float64Array): void {
      const v = x[ELEVATOR_VELOCITY] as number;
      out[ELEVATOR_POSITION] = v;
      out[ELEVATOR_VELOCITY] = (u - weight - damping * v) / mass;
    },
    output(x: Readonly<Float64Array>): number {
      return x[ELEVATOR_POSITION] as number;
    },
    constrain(x: Float64Array): void {
      if ((x[ELEVATOR_POSITION] as number) < GROUND_HEIGHT) {
        x[ELEVATOR_POSITION] = GROUND_HEIGHT;
        x[ELEVATOR_VELOCITY] = Math.max(x[ELEVATOR_VELOCITY] as number, 0);
      }
    },
  };
}

/** Options d'assemblage de la boucle de l'ascenseur. */
export interface ElevatorLoopOptions {
  /** Gain proportionnel Kp (N/m), fini et ≥ 0. */
  readonly kp: number;
  /** Saturation symétrique Umax (N), ≥ 0 (sinon RangeError) ; défaut {@link ELEVATOR_MAX_FORCE}. */
  readonly maxForce?: number;
  /** Pas de simulation dt (s), dans ]0, `MAX_SIM_DT` (clock.ts)] ; défaut {@link SIM_DT}. */
  readonly dt?: number;
  /** Consigne constante r (m), finie (sinon RangeError) ; défaut {@link ELEVATOR_SETPOINT}. */
  readonly setpoint?: number;
  /** Paramètres physiques ; défaut {@link ELEVATOR_PARAMS}. */
  readonly params?: Readonly<ElevatorParams>;
}

/**
 * Assemble la boucle du niveau « L'ascenseur proportionnel » (spec T-001 §4–§5) : ascenseur,
 * contrôleur P, saturation [−Umax, +Umax], RK4, consigne constante, cabine posée au sol
 * (y0 = 0 m, ẏ0 = 0 m/s).
 * @param options voir {@link ElevatorLoopOptions}.
 * @throws RangeError si un paramètre est invalide (Kp, Umax, consigne non finie, dt hors de
 *   ]0, `MAX_SIM_DT` (clock.ts)], paramètres physiques).
 */
export function createElevatorLoop(options: ElevatorLoopOptions): SteppableClosedLoop {
  const maxForce = options.maxForce ?? ELEVATOR_MAX_FORCE;
  const r = options.setpoint ?? ELEVATOR_SETPOINT;
  if (!Number.isFinite(r)) {
    throw new RangeError(`setpoint doit être fini (reçu ${String(r)})`);
  }
  return createClosedLoop({
    plant: createElevator(options.params),
    controller: createProportionalController(options.kp),
    saturation: createSaturation(-maxForce, maxForce),
    integrator: createRk4(ELEVATOR_STATE_SIZE),
    dt: options.dt ?? SIM_DT,
    x0: new Float64Array(ELEVATOR_STATE_SIZE),
    setpoint: () => r,
  });
}
