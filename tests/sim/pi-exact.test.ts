/**
 * Oracle EXACT de la boucle PI (spec T-018 §8, K28) : la boucle PI du noyau
 * (`createElevatorPiLoop`, RK4, dt = 1/120 s, saturation ±5000 N, sol) est comparée, à CHAQUE
 * pas, à la solution exacte du système échantillonné-bloqué, calculée ici sans RK4.
 *
 * Le contrôleur est lui-même discret : à chaque pas, e = r − y, u = Kp·e + I (I AVANT mise à
 * jour), puis I ← I + Ki·dt·e (sur l'erreur, jamais sur la commande saturée). La somme est
 * exacte par construction. Seule la cabine demande une discrétisation : à force nette
 * f = clip(u, ±Umax) − m·g constante sur le pas, x = [y ; ẏ] suit la forme fermée
 * x(k+1) = Φ·x(k) + Γ·f(k) de `exact.test.ts` (et de `validation/matlab/t005_zoh.m`), puis
 * la contrainte de sol. C'est l'algorithme de `validation/matlab/t018_pi_oracle.m`.
 *
 * Tolérances (celles de la spec T-018 §8, marge de 4,7× à 8,3× sur le pire écart mesuré par l'oracle MATLAB T-023 sur
 * Ki ∈ {0, 130, 200, 500, 800, 840, 850, 1000, 2000, 4000, 8000}, Kp = 2500, 1200 pas, et
 * retrouvé ici) : voir TOL_*. Drapeau saturé, pas saturés, k*, pas du pic, issue et pas de
 * l'issue : égalité exacte. Aucune valeur attendue en dur, sauf la limite de stabilité
 * échantillonnée, recoupée avec `validation/matlab/t018_stability.m`.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL2_KP, createOutcomeJudge2, type TripOutcome } from '../../src/game';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_SETPOINT,
  SIM_DT,
  createClosedLoop,
  createElevator,
  createElevatorPiLoop,
  createRk4,
  createSaturation,
  type Controller,
  type SteppableClosedLoop,
} from '../../src/sim';

const { mass: m, gravity: g, damping: c } = ELEVATOR_PARAMS;
const r = ELEVATOR_SETPOINT;
const U_MAX = ELEVATOR_MAX_FORCE;
const KP = LEVEL2_KP;
/** Inverse de la constante de temps de la vitesse, a = c/m (s⁻¹). */
const a = c / m;
/** Nombre de pas comparés (10 s à dt = 1/120, horizon du niveau 2). */
const STEPS = 1200;

/** Tolérance sur y (m), celle de la spec T-018 §8 : pire écart mesuré 1,500e-7 m (Ki = 8000), marge 6,7×. */
const TOL_Y = 1e-6;
/** Tolérance sur ẏ (m/s) : pire écart mesuré 1,524e-6 m/s (Ki = 8000), marge 6,6×. */
const TOL_V = 1e-5;
/** Tolérance sur l'intégrale I (N), celle de la spec T-018 §8 : pire écart mesuré 2,144e-4 N (Ki = 8000), marge 4,7×. */
const TOL_I = 1e-3;
/**
 * Tolérance sur uCmd et uSat (N), déduite des deux précédentes (uCmd = Kp·e + I) : Kp·TOL_Y + TOL_I
 * = 3,5e-3 N ; pire écart mesuré 4,238e-4 N (Ki = 8000), marge 8,3×.
 */
const TOL_U = KP * TOL_Y + TOL_I;

/** Ki des trajectoires comparées pas à pas (ceux de `validation/data/pi_traj_dt120.csv`). */
const TRAJECTORY_KIS = [0, 130, 200, 500, 800, 840, 850, 1000, 2000, 4000, 8000] as const;

/** Grille du curseur (0 à 8000 par pas de 100) et points fins autour des bornes de la fenêtre. */
function sweepKis(): number[] {
  const set = new Set<number>();
  for (let ki = 0; ki <= 8000; ki += 100) set.add(ki);
  for (let ki = 120; ki <= 140; ki++) set.add(ki);
  for (let ki = 840; ki <= 850; ki++) set.add(ki);
  return [...set].sort((x, y) => x - y);
}

/** Matrices exactes du bloqueur d'ordre zéro sur un pas h : Φ = [[1, phi01], [0, phi11]], Γ. */
interface Zoh {
  readonly phi01: number;
  readonly phi11: number;
  readonly gam0: number;
  readonly gam1: number;
}

/** Φ et Γ en forme fermée pour le pas h (s), comme `exact.test.ts`. */
function exactZoh(h: number): Zoh {
  const u1 = -Math.expm1(-a * h); // 1 − e^{−a·h}
  return {
    phi01: u1 / a,
    phi11: 1 - u1,
    gam0: (a * h - u1) / (a * a * m),
    gam1: u1 / (a * m),
  };
}

/** Trace d'une boucle PI : ligne k (0-indexée) = k+1-ième pas (état APRÈS le pas). */
interface PiTrace {
  readonly y: Float64Array;
  readonly v: Float64Array;
  readonly integral: Float64Array;
  readonly uCmd: Float64Array;
  readonly uSat: Float64Array;
  readonly saturated: Uint8Array;
}

function emptyTrace(steps: number): PiTrace {
  return {
    y: new Float64Array(steps),
    v: new Float64Array(steps),
    integral: new Float64Array(steps),
    uCmd: new Float64Array(steps),
    uSat: new Float64Array(steps),
    saturated: new Uint8Array(steps),
  };
}

/** Trajectoire exacte du PI échantillonné-bloqué, départ au sol au repos, I = 0. */
function exactPiTrace(kp: number, ki: number, h: number, steps: number): PiTrace {
  const { phi01, phi11, gam0, gam1 } = exactZoh(h);
  const out = emptyTrace(steps);
  let y = 0;
  let v = 0;
  let integral = 0;
  for (let k = 0; k < steps; k++) {
    const e = r - y;
    const u = kp * e + integral;
    integral += ki * h * e;
    const s = Math.min(Math.max(u, -U_MAX), U_MAX);
    const f = s - m * g;
    const yNext = y + phi01 * v + gam0 * f;
    const vNext = phi11 * v + gam1 * f;
    y = yNext;
    v = vNext;
    if (y < 0) {
      y = 0;
      v = Math.max(v, 0);
    }
    out.y[k] = y;
    out.v[k] = v;
    out.integral[k] = integral;
    out.uCmd[k] = u;
    out.uSat[k] = s;
    out.saturated[k] = s !== u ? 1 : 0;
  }
  return out;
}

/** Contrôleur dont l'intégrale est lisible (noyau ou mutant). */
type IntegralController = Controller & { readonly integral: number };

/** Boucle dont on lit l'intégrale après chaque pas. */
interface PiLoop {
  readonly loop: SteppableClosedLoop;
  readonly controller: IntegralController;
}

/** Trace du noyau ou d'un mutant sur `steps` pas. */
function runTrace({ loop, controller }: PiLoop, steps: number): PiTrace {
  const out = emptyTrace(steps);
  for (let k = 0; k < steps; k++) {
    const s = loop.step();
    out.y[k] = s.x[0] as number;
    out.v[k] = s.x[1] as number;
    out.integral[k] = controller.integral;
    out.uCmd[k] = s.uCmd;
    out.uSat[k] = s.uSat;
    out.saturated[k] = s.saturated ? 1 : 0;
  }
  return out;
}

function coreLoop(ki: number, dt: number = SIM_DT): PiLoop {
  const loop = createElevatorPiLoop({ kp: KP, ki, dt });
  return { loop, controller: loop.controller };
}

/** max |a − b| ; un NaN compte comme un écart infini. */
function maxGap(x: Float64Array, y: Float64Array): number {
  let gap = 0;
  for (let k = 0; k < x.length; k++) {
    const d = Math.abs((x[k] as number) - (y[k] as number));
    if (!(d <= gap)) gap = Number.isNaN(d) ? Number.POSITIVE_INFINITY : d;
  }
  return gap;
}

interface Summary {
  readonly saturatedSteps: number;
  /** Premier pas (1-indexé) non saturé ; −1 si aucun. */
  readonly kStar: number;
  /** Pas (1-indexé) du pic échantillonné de y. */
  readonly kPeak: number;
  readonly yPeak: number;
  readonly outcome: TripOutcome | null;
  readonly kOutcome: number;
}

/** Résumé d'une trace, issue évaluée par l'arbitre du niveau 2 du jeu, pas par pas. */
function summarize(t: PiTrace): Summary {
  const judge = createOutcomeJudge2();
  let saturatedSteps = 0;
  let kStar = -1;
  let kPeak = 0;
  let yPeak = 0;
  let outcome: TripOutcome | null = null;
  let kOutcome = -1;
  for (let k = 0; k < t.y.length; k++) {
    const y = t.y[k] as number;
    if (t.saturated[k] === 1) saturatedSteps++;
    else if (kStar < 0) kStar = k + 1;
    if (y > yPeak) {
      yPeak = y;
      kPeak = k + 1;
    }
    if (outcome === null) {
      outcome = judge.evaluate(k + 1, y, t.v[k] as number, KP);
      if (outcome !== null) kOutcome = k + 1;
    }
  }
  return { saturatedSteps, kStar, kPeak, yPeak, outcome, kOutcome };
}

/** Écarts maximaux entre une trace et la trace exacte. */
interface Gaps {
  readonly dy: number;
  readonly dv: number;
  readonly dI: number;
  readonly du: number;
  readonly dus: number;
  readonly flags: number;
}

function gaps(t: PiTrace, exact: PiTrace): Gaps {
  let flags = 0;
  for (let k = 0; k < t.saturated.length; k++) if (t.saturated[k] !== exact.saturated[k]) flags++;
  return {
    dy: maxGap(t.y, exact.y),
    dv: maxGap(t.v, exact.v),
    dI: maxGap(t.integral, exact.integral),
    du: maxGap(t.uCmd, exact.uCmd),
    dus: maxGap(t.uSat, exact.uSat),
    flags,
  };
}

// ───────────────────── Mutants : PI fautifs reconstruits dans le test ─────────────────────

/** Fabrique d'un contrôleur PI fautif, saturation connue à la création (Umax). */
type MutantFactory = (kp: number, ki: number) => IntegralController;

/** Ordre inversé : I mise à jour AVANT le calcul de u (u = Kp·e + I nouvelle). */
const integralBeforeCommand: MutantFactory = (kp, ki) => {
  let integral = 0;
  return {
    get integral() {
      return integral;
    },
    reset() {
      integral = 0;
    },
    update(rr, y, dt) {
      const e = rr - y;
      integral += ki * dt * e;
      return kp * e + integral;
    },
  };
};

/** Intégration conditionnelle : I gelée quand la commande saturée diffère de la demande. */
const conditionalIntegration: MutantFactory = (kp, ki) => {
  let integral = 0;
  return {
    get integral() {
      return integral;
    },
    reset() {
      integral = 0;
    },
    update(rr, y, dt) {
      const e = rr - y;
      const u = kp * e + integral;
      const uSat = Math.min(Math.max(u, -U_MAX), U_MAX);
      if (uSat === u) integral += ki * dt * e;
      return u;
    },
  };
};

/** Rétrocalcul : l'intégrale est corrigée par uSat − u (elle suit la commande saturée). */
const backCalculation: MutantFactory = (kp, ki) => {
  let integral = 0;
  return {
    get integral() {
      return integral;
    },
    reset() {
      integral = 0;
    },
    update(rr, y, dt) {
      const e = rr - y;
      const u = kp * e + integral;
      const uSat = Math.min(Math.max(u, -U_MAX), U_MAX);
      integral += ki * dt * e + (uSat - u);
      return u;
    },
  };
};

/** Méthode des trapèzes au lieu du rectangle à gauche : I ← I + Ki·dt·(e + e_préc)/2. */
const trapezoidal: MutantFactory = (kp, ki) => {
  let integral = 0;
  let previous = Number.NaN;
  return {
    get integral() {
      return integral;
    },
    reset() {
      integral = 0;
      previous = Number.NaN;
    },
    update(rr, y, dt) {
      const e = rr - y;
      const u = kp * e + integral;
      integral += (ki * dt * (e + (Number.isNaN(previous) ? e : previous))) / 2;
      previous = e;
      return u;
    },
  };
};

function mutantLoop(create: MutantFactory, ki: number): PiLoop {
  const controller = create(KP, ki);
  const loop = createClosedLoop({
    plant: createElevator(),
    controller,
    saturation: createSaturation(-U_MAX, U_MAX),
    integrator: createRk4(2),
    dt: SIM_DT,
    x0: new Float64Array(2),
    setpoint: () => r,
  });
  return { loop, controller };
}

// ─────────────────────────────── Stabilité échantillonnée ────────────────────────────────

/**
 * Coefficients [a2, a1, a0] du polynôme caractéristique z³ + a2·z² + a1·z + a0 de la matrice
 * de boucle fermée PI non saturée M = [[1 − Γ₀·Kp, Φ₀₁, Γ₀], [−Γ₁·Kp, Φ₁₁, Γ₁], [−Ki·h, 0, 1]]
 * (spec T-018 §4.2), état ξ = [y − r, ẏ, I − m·g].
 */
function characteristic(kp: number, ki: number, h: number): [number, number, number] {
  const { phi01, phi11, gam0, gam1 } = exactZoh(h);
  const m00 = 1 - gam0 * kp;
  const m10 = -gam1 * kp;
  const m20 = -ki * h;
  // M = [[m00, phi01, gam0], [m10, phi11, gam1], [m20, 0, 1]].
  const trace = m00 + phi11 + 1;
  const minors = m00 * phi11 - phi01 * m10 + (m00 - gam0 * m20) + phi11;
  const det = m00 * phi11 - phi01 * m10 + gam0 * (-m20 * phi11) - gam1 * (-m20 * phi01) * 1;
  return [-trace, minors, -det];
}

/** Plus petite marge du critère de Jury d'un cubique (toutes > 0 ⇔ stable). */
function juryMargin([a2, a1, a0]: [number, number, number]): number {
  return Math.min(
    1 - Math.abs(a0),
    1 + a2 + a1 + a0,
    1 - a2 + a1 - a0,
    Math.abs(a0 * a0 - 1) - Math.abs(a0 * a2 - a1),
  );
}

// ───────────────────────────────────────── Tests ─────────────────────────────────────────

describe('oracle exact du PI : contrôles de l’oracle lui-même', () => {
  it('Ki = 0 : la trace exacte du PI est celle du P (intégrale nulle)', () => {
    const t = exactPiTrace(KP, 0, SIM_DT, STEPS);
    expect(maxGap(t.integral, new Float64Array(STEPS))).toBe(0);
    for (let k = 0; k < STEPS; k++) {
      const yPrev = k === 0 ? 0 : (t.y[k - 1] as number);
      expect(t.uCmd[k]).toBe(KP * (r - yPrev));
    }
  });

  it('intégrale exacte : I(k) = Ki·dt·Σ_{j<k} e_j, et u utilise I avant mise à jour', () => {
    const ki = 1000;
    const t = exactPiTrace(KP, ki, SIM_DT, STEPS);
    let sum = 0;
    let yPrev = 0;
    for (let k = 0; k < STEPS; k++) {
      const e = r - yPrev;
      expect(t.uCmd[k]).toBeCloseTo(KP * e + ki * SIM_DT * sum, 9);
      sum += e;
      expect(t.integral[k]).toBeCloseTo(ki * SIM_DT * sum, 9);
      yPrev = t.y[k] as number;
    }
  });

  it('M (spec §4.2) prédit un pas exact non saturé : ξ(k+1) = M·ξ(k)', () => {
    const ki = 1000;
    const t = exactPiTrace(KP, ki, SIM_DT, STEPS);
    const { phi01, phi11, gam0, gam1 } = exactZoh(SIM_DT);
    const W = m * g;
    for (let k = 100; k < 110; k++) {
      expect(t.saturated[k + 1]).toBe(0);
      const xi = [(t.y[k] as number) - r, t.v[k] as number, (t.integral[k] as number) - W];
      const [d, v, i] = xi as [number, number, number];
      expect((t.y[k + 1] as number) - r).toBeCloseTo(
        (1 - gam0 * KP) * d + phi01 * v + gam0 * i,
        12,
      );
      expect(t.v[k + 1] as number).toBeCloseTo(-gam1 * KP * d + phi11 * v + gam1 * i, 12);
      expect((t.integral[k + 1] as number) - W).toBeCloseTo(-ki * SIM_DT * d + i, 9);
    }
  });
});

describe('boucle PI du noyau = solution exacte échantillonnée (spec T-018 §8)', () => {
  it.each(TRAJECTORY_KIS)(
    'Ki = %i : 1200 pas, y, ẏ, I, uCmd, uSat dans les tolérances, drapeau saturé identique',
    (ki) => {
      const exact = exactPiTrace(KP, ki, SIM_DT, STEPS);
      const core = runTrace(coreLoop(ki), STEPS);
      const gap = gaps(core, exact);
      console.info(
        `PI-EXACT Ki=${String(ki)} max|Δy|=${gap.dy.toExponential(3)} m ` +
          `max|Δẏ|=${gap.dv.toExponential(3)} m/s max|ΔI|=${gap.dI.toExponential(3)} N ` +
          `max|ΔuCmd|=${gap.du.toExponential(3)} N max|ΔuSat|=${gap.dus.toExponential(3)} N`,
      );
      expect(gap.dy).toBeLessThanOrEqual(TOL_Y);
      expect(gap.dv).toBeLessThanOrEqual(TOL_V);
      expect(gap.dI).toBeLessThanOrEqual(TOL_I);
      expect(gap.du).toBeLessThanOrEqual(TOL_U);
      expect(gap.dus).toBeLessThanOrEqual(TOL_U);
      expect(gap.flags).toBe(0);
      const a1 = summarize(core);
      const b1 = summarize(exact);
      expect(a1.saturatedSteps).toBe(b1.saturatedSteps);
      expect(a1.kStar).toBe(b1.kStar);
      expect(a1.kPeak).toBe(b1.kPeak);
      expect(a1.outcome).toBe(b1.outcome);
      expect(a1.kOutcome).toBe(b1.kOutcome);
    },
  );

  it('l’écart est l’erreur de troncature d’ordre 4 de RK4 : divisé par ≈ 16 quand dt est divisé par 2', () => {
    const ki = 1000;
    const coarse = gaps(runTrace(coreLoop(ki), STEPS), exactPiTrace(KP, ki, SIM_DT, STEPS));
    const fine = gaps(
      runTrace(coreLoop(ki, SIM_DT / 2), 2 * STEPS),
      exactPiTrace(KP, ki, SIM_DT / 2, 2 * STEPS),
    );
    const ratio = coarse.dy / fine.dy;
    console.info(`PI-EXACT ordre Ki=1000 rapport |Δy|(dt)/|Δy|(dt/2)=${ratio.toFixed(2)}`);
    expect(ratio).toBeGreaterThan(12);
    expect(ratio).toBeLessThan(20);
  });

  it('balayage Ki = 0…8000 (pas de 100) et points fins 120…140, 840…850 : 0 désaccord d’issue', () => {
    const kis = sweepKis();
    const seen = new Set<TripOutcome | null>();
    const disagreements: string[] = [];
    let worstPeak = 0;
    for (const ki of kis) {
      const core = summarize(runTrace(coreLoop(ki), STEPS));
      const exact = summarize(exactPiTrace(KP, ki, SIM_DT, STEPS));
      seen.add(exact.outcome);
      worstPeak = Math.max(worstPeak, Math.abs(core.yPeak - exact.yPeak));
      if (
        core.outcome !== exact.outcome ||
        core.kOutcome !== exact.kOutcome ||
        core.saturatedSteps !== exact.saturatedSteps ||
        core.kStar !== exact.kStar ||
        core.kPeak !== exact.kPeak
      ) {
        disagreements.push(`Ki=${String(ki)}`);
      }
    }
    console.info(
      `PI-EXACT balayage ${String(kis.length)} Ki : ${String(disagreements.length)} désaccord(s), ` +
        `max|Δy_max|=${worstPeak.toExponential(3)} m, issues ${[...seen].join(', ')}`,
    );
    expect(disagreements).toEqual([]);
    expect(worstPeak).toBeLessThanOrEqual(TOL_Y);
    // Le balayage n'est pas trivial : il traverse les quatre issues du niveau 2.
    expect([...seen].sort()).toEqual(['bonk', 'slow', 'step', 'win']);
  });
});

describe('sensibilité de l’oracle exact : un PI fautif échoue', () => {
  const mutants = [
    { name: 'ordre inversé (I mise à jour avant u)', create: integralBeforeCommand },
    { name: 'intégration conditionnelle (I dépend de uSat)', create: conditionalIntegration },
    { name: 'rétrocalcul (I corrigée par uSat − u)', create: backCalculation },
    { name: 'trapèzes au lieu du rectangle à gauche', create: trapezoidal },
  ];
  it.each(mutants)(
    '$name dépasse les tolérances sur y et sur I pour chaque Ki > 0',
    ({ name, create }) => {
      for (const ki of [130, 200, 800, 1000, 4000, 8000]) {
        const gap = gaps(
          runTrace(mutantLoop(create, ki), STEPS),
          exactPiTrace(KP, ki, SIM_DT, STEPS),
        );
        console.info(
          `MUTANT PI ${name} Ki=${String(ki)} max|Δy|=${gap.dy.toExponential(3)} m ` +
            `max|ΔI|=${gap.dI.toExponential(3)} N`,
        );
        expect(gap.dy).toBeGreaterThan(TOL_Y);
        expect(gap.dI).toBeGreaterThan(TOL_I);
      }
    },
  );

  it('le noyau lui-même, rejoué par la même fabrique de boucle, reste dans les tolérances', () => {
    const exactLike: MutantFactory = (kp, ki) => {
      let integral = 0;
      return {
        get integral() {
          return integral;
        },
        reset() {
          integral = 0;
        },
        update(rr, y, dt) {
          const e = rr - y;
          const u = kp * e + integral;
          integral += ki * dt * e;
          return u;
        },
      };
    };
    const gap = gaps(
      runTrace(mutantLoop(exactLike, 1000), STEPS),
      exactPiTrace(KP, 1000, SIM_DT, STEPS),
    );
    expect(gap.dy).toBeLessThanOrEqual(TOL_Y);
    expect(gap.dI).toBeLessThanOrEqual(TOL_I);
  });
});

describe('stabilité de la boucle PI échantillonnée (spec T-018 §4.2, Kp = 2500)', () => {
  it('Ki critique (Jury) ≈ 18 310 N/(m·s), sous la limite continue 8·Kp et au-dessus du curseur', () => {
    let lo = 1000;
    let hi = 1e6;
    expect(juryMargin(characteristic(KP, lo, SIM_DT))).toBeGreaterThan(0);
    expect(juryMargin(characteristic(KP, hi, SIM_DT))).toBeLessThan(0);
    for (let it = 0; it < 200 && hi - lo > 1e-9 * hi; it++) {
      const mid = (lo + hi) / 2;
      if (juryMargin(characteristic(KP, mid, SIM_DT)) > 0) lo = mid;
      else hi = mid;
    }
    console.info(`PI-EXACT Ki critique échantillonné (Jury) = ${lo.toFixed(4)} N/(m·s)`);
    // validation/matlab/t018_stability.m : 18310,30 (valeurs propres et Jury).
    expect(lo).toBeGreaterThan(18310);
    expect(lo).toBeLessThan(18311);
    expect(lo).toBeLessThan((c * KP) / m); // limite continue de Routh : 20 000
    expect(lo).toBeGreaterThan(8000); // borne haute du curseur
  });
});
