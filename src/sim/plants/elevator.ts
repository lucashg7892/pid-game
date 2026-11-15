import { SIM_DT } from '../clock';
import { createProportionalController } from '../controllers/p';
import {
  createProportionalIntegralController,
  type ProportionalIntegralController,
} from '../controllers/pi';
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

/**
 * Accélération verticale ÿ (m/s²) de la cabine, d'après le modèle (somme des forces / masse), à
 * l'état (y, ẏ) sous la force du moteur `force` (N, déjà saturée) :
 *
 *   ÿ = (u − m·g − c·ẏ) / m,
 *
 * avec exactement les mêmes opérations, dans le même ordre, que la composante vitesse des
 * dérivées de {@link createElevator} : hors contact, le résultat est identique bit à bit à
 * `derivative(x, u, out)` puis `out[ELEVATOR_VELOCITY]`. C'est l'accélération au début du pas
 * (avant intégration), celle de l'état où la commande a été calculée ; elle ne vient jamais d'une
 * différence entre deux pas.
 *
 * Contact au sol : si y ≤ 0, ẏ ≤ 0 et la force nette u − m·g − c·ẏ < 0, la cabine est posée et le
 * sol la retient : renvoie 0 (+0), comme la contrainte du modèle qui garde y = 0 et ẏ ≥ 0 après
 * le pas. Si la force nette est ≥ 0 (décollage) ou si ẏ > 0, la formule s'applique. Un NaN sur ẏ
 * ou sur la force est propagé ; y n'entre que dans le test de contact (comme dans le modèle, ÿ ne
 * dépend pas de y) : y NaN n'est jamais au sol. Les paramètres ne sont pas revalidés : ils doivent
 * respecter le domaine de {@link createElevator}. Pure, sans allocation.
 * @param y hauteur du plancher de la cabine (m, sol = 0).
 * @param v vitesse verticale ẏ (m/s, positive vers le haut).
 * @param force force du moteur appliquée u (N), après saturation.
 * @param params paramètres physiques ; défaut {@link ELEVATOR_PARAMS}.
 * @returns ÿ (m/s²), positive vers le haut.
 */
export function elevatorAcceleration(
  y: number,
  v: number,
  force: number,
  params: Readonly<ElevatorParams> = ELEVATOR_PARAMS,
): number {
  const { mass, gravity, damping } = params;
  const net = force - mass * gravity - damping * v;
  if (y <= GROUND_HEIGHT && v <= 0 && net < 0) return 0;
  return net / mass;
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

/** Options d'assemblage de la boucle PI de l'ascenseur : celles de la boucle P, plus Ki. */
export interface ElevatorPiLoopOptions extends ElevatorLoopOptions {
  /** Gain intégral Ki (N/(m·s)), fini et ≥ 0. */
  readonly ki: number;
}

/**
 * Boucle PI de l'ascenseur : boucle à pas fixe ordinaire, plus son contrôleur exposé en
 * lecture pour que le niveau lise l'intégrale (`controller.integral`) et le terme
 * proportionnel (`controller.proportionalTerm`) après chaque pas. Ne pas appeler
 * `controller.update` ni `controller.reset` directement : la boucle s'en charge.
 */
export type ElevatorPiLoop = SteppableClosedLoop & {
  readonly controller: ProportionalIntegralController;
};

/**
 * Assemble la boucle du niveau « L'ascenseur à action intégrale » (spec T-018 §3.1) : même
 * assemblage que {@link createElevatorLoop} (ascenseur, saturation [−Umax, +Umax], RK4,
 * consigne constante, cabine posée au sol), avec un contrôleur PI sans anti-windup.
 * À Ki = 0, la trace est identique bit à bit à celle de {@link createElevatorLoop}.
 * @param options voir {@link ElevatorPiLoopOptions}.
 * @throws RangeError si un paramètre est invalide (Kp, Ki, Umax, consigne non finie, dt hors de
 *   ]0, `MAX_SIM_DT` (clock.ts)], paramètres physiques).
 */
export function createElevatorPiLoop(options: ElevatorPiLoopOptions): ElevatorPiLoop {
  const maxForce = options.maxForce ?? ELEVATOR_MAX_FORCE;
  const r = options.setpoint ?? ELEVATOR_SETPOINT;
  if (!Number.isFinite(r)) {
    throw new RangeError(`setpoint doit être fini (reçu ${String(r)})`);
  }
  const controller = createProportionalIntegralController(options.kp, options.ki);
  const loop = createClosedLoop({
    plant: createElevator(options.params),
    controller,
    saturation: createSaturation(-maxForce, maxForce),
    integrator: createRk4(ELEVATOR_STATE_SIZE),
    dt: options.dt ?? SIM_DT,
    x0: new Float64Array(ELEVATOR_STATE_SIZE),
    setpoint: () => r,
  });
  // Ajout en place : les accesseurs de la boucle (k, enabled) restent ceux de l'objet d'origine.
  return Object.assign(loop, { controller });
}
