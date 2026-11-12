/**
 * Oracle EXACT de la trajectoire (défaut D-6 de T-005) : la boucle de jeu (RK4, dt = 1/120 s,
 * saturation ±5000 N, contrainte de sol) est comparée, à CHAQUE pas et sur y ET ẏ, à la
 * solution exacte du système échantillonné-bloqué, calculée ici en forme fermée.
 *
 * Entre deux échantillons, la commande est constante (bloqueur d'ordre zéro) : la force nette
 * f = sat(Kp·(r − y)) − m·g est constante et l'état x = [y ; ẏ] suit ẋ = A·x + B·f avec
 * A = [0 1 ; 0 −a], a = c/m, B = [0 ; 1/m] (pôles 0 et −a, boucle OUVERTE sur le pas). Avec
 * u₁ = 1 − e^{−a·h} (calculé par −expm1 pour éviter la cancellation) :
 *
 *   Φ = e^{A·h} = [1  u₁/a ; 0  1 − u₁],   Γ = ∫₀ʰ e^{A·s} ds · B = [(a·h − u₁)/a² ; u₁/a] / m,
 *
 * et x(k+1) = Φ·x(k) + Γ·f(k), puis contrainte de sol (y < 0 ⇒ y = 0, ẏ = max(ẏ, 0)).
 * C'est la forme fermée de `validation/matlab/t005_zoh.m` (contrôlée à 2,7e-20 contre expm).
 * Aucune intégration numérique dans l'oracle, aucune valeur attendue en dur.
 */
import { describe, expect, it } from 'vitest';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_SETPOINT,
  SIM_DT,
  createClosedLoop,
  createElevator,
  createElevatorLoop,
  createProportionalController,
  createSaturation,
  type Integrator,
  type PlantModel,
  type SteppableClosedLoop,
} from '../../src/sim';

const { mass: m, gravity: g, damping: c } = ELEVATOR_PARAMS;
const r = ELEVATOR_SETPOINT;
const U_MAX = ELEVATOR_MAX_FORCE;
/** Inverse de la constante de temps de la vitesse, a = c/m (s⁻¹). */
const a = c / m;
/** Nombre de pas comparés (10 s à dt = 1/120). */
const STEPS = 1200;
/** Tolérance sur y (m) : T-005 mesure ≤ 1,42e-7 m (Kp = 8000). */
const TOLERANCE_Y = 5e-7;
/**
 * Tolérance sur ẏ (m/s) : T-005 mesure ≤ 2,311e-6 m/s (Kp = 8000), marge 2,2× (≤ 3×). Mesuré
 * en T-004b (tests plus bas) : un intégrateur d'ordre 3 (Kutta) dépasse ces deux tolérances
 * d'un facteur ≥ 2,5 pour chaque Kp, un intégrateur d'ordre 2 d'un facteur ≥ 150.
 */
const TOLERANCE_V = 5e-6;
/** Gains testés : régimes non saturé (500, 1500), saturé, bornes de la fenêtre (3800, 3900), max. */
const GAINS = [500, 1500, 2500, 3800, 3900, 8000] as const;

/** Matrices exactes du bloqueur d'ordre zéro sur un pas h : Φ = [[1, phi01], [0, phi11]], Γ. */
interface Zoh {
  readonly phi01: number;
  readonly phi11: number;
  readonly gam0: number;
  readonly gam1: number;
}

/** Φ et Γ en forme fermée pour le pas h (s). */
function exactZoh(h: number): Zoh {
  const u1 = -Math.expm1(-a * h); // 1 − e^{−a·h}
  return {
    phi01: u1 / a,
    phi11: 1 - u1,
    gam0: (a * h - u1) / (a * a * m),
    gam1: u1 / (a * m),
  };
}

/**
 * Trajectoire exacte : [y, ẏ] après chaque pas, à plat (2·steps valeurs), départ au sol au
 * repos, saturation et contrainte de sol comme la spec §4–§5.
 */
function exactTrajectory(kp: number, h: number, steps: number): Float64Array {
  const { phi01, phi11, gam0, gam1 } = exactZoh(h);
  const out = new Float64Array(2 * steps);
  let y = 0;
  let v = 0;
  for (let k = 0; k < steps; k++) {
    const f = Math.min(Math.max(kp * (r - y), -U_MAX), U_MAX) - m * g;
    const yNext = y + phi01 * v + gam0 * f;
    const vNext = phi11 * v + gam1 * f;
    y = yNext;
    v = vNext;
    if (y < 0) {
      y = 0;
      v = Math.max(v, 0);
    }
    out[2 * k] = y;
    out[2 * k + 1] = v;
  }
  return out;
}

interface Gaps {
  /** max |y_TS − y_exact| (m) et pas k où il est atteint. */
  readonly dy: number;
  readonly kY: number;
  /** max |ẏ_TS − ẏ_exact| (m/s) et pas k où il est atteint. */
  readonly dv: number;
  readonly kV: number;
}

/** Fait tourner la boucle `steps` pas et mesure l'écart à l'oracle exact, état après chaque pas. */
function gapsToExact(loop: SteppableClosedLoop, kp: number, steps: number): Gaps {
  const exact = exactTrajectory(kp, loop.dt, steps);
  let dy = 0;
  let dv = 0;
  let kY = -1;
  let kV = -1;
  for (let k = 0; k < steps; k++) {
    const s = loop.step();
    const ey = Math.abs((s.x[0] as number) - (exact[2 * k] as number));
    const ev = Math.abs((s.x[1] as number) - (exact[2 * k + 1] as number));
    // `!(… <= …)` : un NaN compte comme un écart infini.
    if (!(ey <= dy)) {
      dy = Number.isNaN(ey) ? Number.POSITIVE_INFINITY : ey;
      kY = k + 1;
    }
    if (!(ev <= dv)) {
      dv = Number.isNaN(ev) ? Number.POSITIVE_INFINITY : ev;
      kV = k + 1;
    }
  }
  return { dy, kY, dv, kV };
}

/** Boucle de jeu, mais avec un intégrateur imposé (pour vérifier que l'oracle le distingue). */
function loopWith(integrator: Integrator, kp: number): SteppableClosedLoop {
  return createClosedLoop({
    plant: createElevator(),
    controller: createProportionalController(kp),
    saturation: createSaturation(-U_MAX, U_MAX),
    integrator,
    dt: SIM_DT,
    x0: new Float64Array(2),
    setpoint: () => r,
  });
}

/** Euler explicite (ordre 1), sans allocation dans step. */
function createEuler(): Integrator {
  const d = new Float64Array(2);
  return {
    step(plant: PlantModel, x: Float64Array, u: number, dt: number): void {
      plant.derivative(x, u, d);
      for (let i = 0; i < 2; i++) x[i] = (x[i] as number) + dt * (d[i] as number);
    },
  };
}

/** Runge-Kutta 2 du point milieu (ordre 2), sans allocation dans step. */
function createMidpoint(): Integrator {
  const d = new Float64Array(2);
  const mid = new Float64Array(2);
  return {
    step(plant: PlantModel, x: Float64Array, u: number, dt: number): void {
      plant.derivative(x, u, d);
      for (let i = 0; i < 2; i++) mid[i] = (x[i] as number) + 0.5 * dt * (d[i] as number);
      plant.derivative(mid, u, d);
      for (let i = 0; i < 2; i++) x[i] = (x[i] as number) + dt * (d[i] as number);
    },
  };
}

/** Runge-Kutta 3 de Kutta (ordre 3) : k1, k2 = f(x + h/2·k1), k3 = f(x − h·k1 + 2h·k2). */
function createKutta3(): Integrator {
  const k1 = new Float64Array(2);
  const k2 = new Float64Array(2);
  const k3 = new Float64Array(2);
  const tmp = new Float64Array(2);
  return {
    step(plant: PlantModel, x: Float64Array, u: number, dt: number): void {
      plant.derivative(x, u, k1);
      for (let i = 0; i < 2; i++) tmp[i] = (x[i] as number) + 0.5 * dt * (k1[i] as number);
      plant.derivative(tmp, u, k2);
      for (let i = 0; i < 2; i++) {
        tmp[i] = (x[i] as number) - dt * (k1[i] as number) + 2 * dt * (k2[i] as number);
      }
      plant.derivative(tmp, u, k3);
      for (let i = 0; i < 2; i++) {
        x[i] =
          (x[i] as number) +
          (dt / 6) * ((k1[i] as number) + 4 * (k2[i] as number) + (k3[i] as number));
      }
    },
  };
}

describe('forme fermée Φ, Γ du bloqueur d’ordre zéro (contrôles de l’oracle lui-même)', () => {
  it('semi-groupe : Φ(2h) = Φ(h)², Γ(2h) = Φ(h)·Γ(h) + Γ(h)', () => {
    const h = SIM_DT;
    const one = exactZoh(h);
    const two = exactZoh(2 * h);
    expect(two.phi01).toBeCloseTo(one.phi01 + one.phi01 * one.phi11, 15);
    expect(two.phi11).toBeCloseTo(one.phi11 * one.phi11, 15);
    expect(two.gam0).toBeCloseTo(one.gam0 + one.phi01 * one.gam1 + one.gam0, 15);
    expect(two.gam1).toBeCloseTo(one.phi11 * one.gam1 + one.gam1, 15);
  });

  it('développement limité : Φ ≈ I + A·h, Γ ≈ [h²/(2m) ; h/m] pour h → 0', () => {
    const h = 1e-6;
    const z = exactZoh(h);
    expect(z.phi01 / h).toBeCloseTo(1, 5);
    expect((1 - z.phi11) / (a * h)).toBeCloseTo(1, 5);
    expect(z.gam0 / ((h * h) / (2 * m))).toBeCloseTo(1, 5);
    expect(z.gam1 / (h / m)).toBeCloseTo(1, 5);
  });

  it('chute libre sans commande : vitesse limite −m·g/c atteinte', () => {
    const { phi11, gam1 } = exactZoh(SIM_DT);
    let v = 0;
    for (let k = 0; k < 1200; k++) v = phi11 * v + gam1 * -(m * g);
    expect(v).toBeCloseTo(-(m * g) / c, 12);
  });
});

describe('trajectoire RK4 de la boucle de jeu = solution exacte échantillonnée (D-6)', () => {
  it.each(GAINS)(
    'Kp = %i : 1200 pas à dt = 1/120, |Δy| ≤ 5e-7 m et |Δẏ| ≤ 5e-6 m/s à chaque pas',
    (kp) => {
      const gaps = gapsToExact(createElevatorLoop({ kp }), kp, STEPS);
      console.info(
        `EXACT Kp=${String(kp)} max|Δy|=${gaps.dy.toExponential(3)} m (pas ${String(gaps.kY)}) ` +
          `max|Δẏ|=${gaps.dv.toExponential(3)} m/s (pas ${String(gaps.kV)})`,
      );
      expect(gaps.dy).toBeLessThanOrEqual(TOLERANCE_Y);
      expect(gaps.dv).toBeLessThanOrEqual(TOLERANCE_V);
    },
  );

  it('l’écart est bien l’erreur de troncature d’ordre 4 : divisé par ≈ 16 quand dt est divisé par 2', () => {
    const kp = 2500;
    const coarse = gapsToExact(createElevatorLoop({ kp, dt: SIM_DT }), kp, STEPS);
    const fine = gapsToExact(createElevatorLoop({ kp, dt: SIM_DT / 2 }), kp, 2 * STEPS);
    const ratio = coarse.dy / fine.dy;
    console.info(`EXACT ordre Kp=2500 rapport |Δy|(dt)/|Δy|(dt/2)=${ratio.toFixed(2)}`);
    expect(ratio).toBeGreaterThan(12); // ordre 4 : 16 ; ordre 3 : 8 ; ordre 2 : 4
    expect(ratio).toBeLessThan(20);
  });
});

describe('sensibilité de l’oracle exact : un intégrateur d’ordre inférieur échoue', () => {
  const lowOrder = [
    { name: 'Euler (ordre 1)', create: createEuler },
    { name: 'RK2 point milieu (ordre 2)', create: createMidpoint },
    { name: 'RK3 de Kutta (ordre 3)', create: createKutta3 },
  ];
  it.each(lowOrder)('$name dépasse les tolérances pour chaque Kp', ({ name, create }) => {
    for (const kp of GAINS) {
      const gaps = gapsToExact(loopWith(create(), kp), kp, STEPS);
      console.info(
        `MUTANT ${name} Kp=${String(kp)} max|Δy|=${gaps.dy.toExponential(3)} m ` +
          `max|Δẏ|=${gaps.dv.toExponential(3)} m/s`,
      );
      expect(gaps.dy).toBeGreaterThan(TOLERANCE_Y);
      expect(gaps.dv).toBeGreaterThan(TOLERANCE_V);
    }
  });
});
