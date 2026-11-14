/**
 * Contrôleur PI discret et boucle PI de l'ascenseur (spec T-018 §3.1, §4.3, §9).
 */
import { describe, expect, it } from 'vitest';
import {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_SETPOINT,
  SIM_DT,
  createElevatorLoop,
  createElevatorPiLoop,
  createProportionalController,
  createProportionalIntegralController,
  type LoopSample,
} from '../../src/sim';

/** 1800 pas = 15 s à dt = 1/120 s. */
const STEPS = 1800;

/** Poids m·g (N). */
const WEIGHT = ELEVATOR_PARAMS.mass * ELEVATOR_PARAMS.gravity;

/** Vrai si a et b ont exactement les mêmes bits (distingue −0 de +0). */
function sameBits(a: number, b: number): boolean {
  return Object.is(a, b);
}

/** Copie les valeurs d'un échantillon (l'objet renvoyé par step est réutilisé). */
function snapshot(s: LoopSample): number[] {
  return [s.k, s.t, s.r, s.y, s.e, s.uCmd, s.uSat, s.saturated ? 1 : 0, ...Array.from(s.x)];
}

describe('contrôleur PI : lois discrètes', () => {
  it('u = Kp·e + I avec I avant mise à jour, puis I ← I + Ki·dt·e', () => {
    const pi = createProportionalIntegralController(2500, 1000);
    expect(pi.kp).toBe(2500);
    expect(pi.ki).toBe(1000);
    expect(pi.integral).toBe(0);
    expect(pi.proportionalTerm).toBe(0);

    // Premier appel : I = 0 avant usage.
    expect(pi.update(3, 1, 0.01)).toBe(2500 * 2);
    expect(pi.proportionalTerm).toBe(5000);
    expect(pi.integral).toBe(1000 * 0.01 * 2);

    // Deuxième appel : u utilise I = 20 N (valeur avant mise à jour).
    expect(pi.update(3, 3.5, 0.01)).toBe(2500 * -0.5 + 20);
    expect(pi.proportionalTerm).toBe(-1250);
    expect(pi.integral).toBe(20 + 1000 * 0.01 * -0.5);

    // dt intervient seulement dans l'intégrale.
    expect(pi.update(3, 3, 0.5)).toBe(15);
    expect(pi.integral).toBe(15);
  });

  it('Ki = 0 : identique au contrôleur P bit à bit, intégrale toujours nulle', () => {
    for (const kp of [0, 150, 2500]) {
      const p = createProportionalController(kp);
      const pi = createProportionalIntegralController(kp, 0);
      for (const [r, y] of [
        [3, 0],
        [3, 3.5],
        [3, 3],
        [0, 1e-300],
        [-2, 7],
      ] as const) {
        expect(sameBits(pi.update(r, y, SIM_DT), p.update(r, y, SIM_DT))).toBe(true);
        expect(sameBits(pi.integral, 0)).toBe(true);
      }
    }
  });

  it('erreur constante : I après n pas = Ki·dt·e·n à l’arrondi', () => {
    const ki = 1234;
    const e = 0.75;
    const pi = createProportionalIntegralController(2500, ki);
    for (let n = 1; n <= 10_000; n++) {
      const u = pi.update(e, 0, SIM_DT);
      // u utilise l'intégrale de n − 1 pas.
      expect(u).toBeCloseTo(2500 * e + ki * SIM_DT * e * (n - 1), 6);
      const expected = ki * SIM_DT * e * n;
      expect(Math.abs(pi.integral - expected)).toBeLessThanOrEqual(1e-12 * expected);
    }
  });

  it('reset() remet I et le terme proportionnel à zéro', () => {
    const pi = createProportionalIntegralController(2500, 1000);
    const first = [pi.update(3, 0, SIM_DT), pi.update(3, 1, SIM_DT), pi.update(3, 2, SIM_DT)];
    expect(pi.integral).toBeGreaterThan(0);
    pi.reset();
    expect(pi.integral).toBe(0);
    expect(pi.proportionalTerm).toBe(0);
    const second = [pi.update(3, 0, SIM_DT), pi.update(3, 1, SIM_DT), pi.update(3, 2, SIM_DT)];
    expect(second).toEqual(first);
  });

  it('Kp ou Ki invalide : RangeError', () => {
    for (const bad of [-1, -1e-9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => createProportionalIntegralController(bad, 100)).toThrow(RangeError);
      expect(() => createProportionalIntegralController(2500, bad)).toThrow(RangeError);
      expect(() => createElevatorPiLoop({ kp: bad, ki: 100 })).toThrow(RangeError);
      expect(() => createElevatorPiLoop({ kp: 2500, ki: bad })).toThrow(RangeError);
    }
    expect(createProportionalIntegralController(0, 0).update(3, 0, SIM_DT)).toBe(0);
  });
});

describe('boucle PI de l’ascenseur', () => {
  it('Ki = 0 ≡ boucle P bit à bit sur 1800 pas (y, ẏ, uCmd, uSat), Kp ∈ {0, 150, 1500, 2500, 4500}', () => {
    for (const kp of [0, 150, 1500, 2500, 4500]) {
      const p = createElevatorLoop({ kp });
      const pi = createElevatorPiLoop({ kp, ki: 0 });
      let mismatches = 0;
      for (let k = 0; k < STEPS; k++) {
        const a = p.step();
        const b = pi.step();
        if (
          !sameBits(a.x[0] as number, b.x[0] as number) ||
          !sameBits(a.x[1] as number, b.x[1] as number) ||
          !sameBits(a.uCmd, b.uCmd) ||
          !sameBits(a.uSat, b.uSat) ||
          !sameBits(a.y, b.y) ||
          a.saturated !== b.saturated
        ) {
          mismatches++;
        }
      }
      expect(mismatches, `Kp = ${String(kp)}`).toBe(0);
      expect(pi.controller.integral).toBe(0);
    }
  });

  it('LoopSample cohérent : uCmd = Kp·e + I(avant), I lisible après chaque pas', () => {
    const kp = 2500;
    const ki = 1000;
    const loop = createElevatorPiLoop({ kp, ki });
    let before = 0;
    for (let k = 0; k < 600; k++) {
      const s = loop.step();
      expect(s.uCmd).toBe(before === 0 ? kp * s.e : kp * s.e + before);
      expect(loop.controller.proportionalTerm).toBe(kp * s.e);
      expect(loop.controller.integral).toBe(before + ki * SIM_DT * s.e);
      before = loop.controller.integral;
    }
  });

  it('aucune allocation : même échantillon, même état, même contrôleur sur 1000 pas', () => {
    const loop = createElevatorPiLoop({ kp: 2500, ki: 1000 });
    const controller = loop.controller;
    const first = loop.step();
    expect(first.x).toBe(loop.x);
    for (let k = 1; k < 1000; k++) {
      const s = loop.step();
      expect(s).toBe(first);
      expect(s.x).toBe(loop.x);
      expect(loop.controller).toBe(controller);
      expect(typeof loop.controller.integral).toBe('number');
    }
  });

  it('reset() de la boucle remet l’intégrale à zéro : trace identique après reset', () => {
    const loop = createElevatorPiLoop({ kp: 2500, ki: 1500 });
    const run = (): number[][] => {
      const rows: number[][] = [];
      for (let k = 0; k < 600; k++) rows.push([...snapshot(loop.step()), loop.controller.integral]);
      return rows;
    };
    const first = run();
    expect(loop.controller.integral).not.toBe(0);
    loop.setEnabled(false);
    loop.reset();
    expect(loop.k).toBe(0);
    expect(loop.enabled).toBe(true);
    expect(loop.controller.integral).toBe(0);
    expect(loop.controller.proportionalTerm).toBe(0);
    expect(Array.from(loop.x)).toEqual([0, 0]);
    expect(run()).toEqual(first);
  });

  it('setEnabled(false) : intégrale gelée (contrôleur non appelé), pas remise à zéro', () => {
    const loop = createElevatorPiLoop({ kp: 2500, ki: 1000 });
    for (let k = 0; k < 60; k++) loop.step();
    const frozen = loop.controller.integral;
    loop.setEnabled(false);
    for (let k = 0; k < 60; k++) expect(loop.step().uCmd).toBe(0);
    expect(loop.controller.integral).toBe(frozen);
  });

  it('options : défauts = configuration de jeu, options personnalisées respectées', () => {
    const loop = createElevatorPiLoop({ kp: 2500, ki: 1000 });
    expect(loop.dt).toBe(SIM_DT);
    const s = loop.step();
    expect(s.r).toBe(ELEVATOR_SETPOINT);
    expect(s.uSat).toBe(ELEVATOR_MAX_FORCE);
    const custom = createElevatorPiLoop({
      kp: 2500,
      ki: 1000,
      maxForce: 1e12,
      dt: 0.01,
      setpoint: 2,
      params: ELEVATOR_PARAMS,
    });
    const c = custom.step();
    expect(c.r).toBe(2);
    expect(c.uSat).toBe(5000);
    expect(c.saturated).toBe(false);
    expect(custom.dt).toBe(0.01);
    expect(custom.controller.integral).toBe(1000 * 0.01 * 2);
    for (const setpoint of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createElevatorPiLoop({ kp: 2500, ki: 1000, setpoint })).toThrow(RangeError);
    }
    expect(() => createElevatorPiLoop({ kp: 2500, ki: 1000, maxForce: -1 })).toThrow(RangeError);
    expect(() => createElevatorPiLoop({ kp: 2500, ki: 1000, dt: 1 })).toThrow(RangeError);
  });

  it('convergence (Kp = 2500, Ki = 1000) : e → 0 et I → m·g', () => {
    const loop = createElevatorPiLoop({ kp: 2500, ki: 1000 });
    let saturatedSeen = 0;
    let last: LoopSample | null = null;
    for (let k = 0; k < 60 * 120; k++) {
      last = loop.step();
      if (last.saturated) saturatedSeen++;
    }
    expect(saturatedSeen).toBeGreaterThan(0);
    expect(Math.abs(ELEVATOR_SETPOINT - (loop.x[0] as number))).toBeLessThan(1e-6);
    expect(Math.abs(loop.controller.integral - WEIGHT)).toBeLessThan(1e-3);
    expect(last?.saturated).toBe(false);
  });
});

describe('windup : l’intégrale accumule pendant la saturation (spec T-018 §4.3)', () => {
  it('saturation maintenue (Umax < m·g, cabine clouée au sol) : I = Ki·dt·e·n, croissante', () => {
    const ki = 800;
    // Umax = 400 N < m·g = 490,5 N : la cabine ne décolle jamais, e = 3 m constant.
    const loop = createElevatorPiLoop({ kp: 2500, ki, maxForce: 400 });
    let previous = 0;
    for (let n = 1; n <= STEPS; n++) {
      const s = loop.step();
      expect(s.saturated).toBe(true);
      expect(s.uSat).toBe(400);
      expect(s.uCmd).toBeGreaterThan(s.uSat);
      expect(s.e).toBe(ELEVATOR_SETPOINT);
      const integral = loop.controller.integral;
      expect(integral).toBeGreaterThan(previous);
      const expected = ki * SIM_DT * ELEVATOR_SETPOINT * n;
      expect(Math.abs(integral - expected)).toBeLessThanOrEqual(1e-12 * expected);
      previous = integral;
    }
    expect(Array.from(loop.x)).toEqual([0, 0]);
    // Après 15 s : I = 800·3·15 = 36 000 N, plus de 70 fois le poids.
    expect(previous).toBeGreaterThan(70 * WEIGHT);
  });

  it('saturation initiale du jeu (Kp = 2500) : I croît à chaque pas saturé et vaut Ki·dt·Σ e', () => {
    const ki = 4000;
    const loop = createElevatorPiLoop({ kp: 2500, ki });
    let sumE = 0;
    let previous = 0;
    let saturatedSteps = 0;
    for (;;) {
      const s = loop.step();
      if (!s.saturated) break;
      saturatedSteps++;
      expect(s.uSat).toBe(ELEVATOR_MAX_FORCE);
      expect(s.uCmd).toBeGreaterThan(s.uSat);
      expect(s.e).toBeGreaterThan(0);
      sumE += s.e;
      const integral = loop.controller.integral;
      expect(integral).toBeGreaterThan(previous);
      const expected = ki * SIM_DT * sumE;
      expect(Math.abs(integral - expected)).toBeLessThanOrEqual(1e-12 * expected);
      previous = integral;
    }
    expect(saturatedSteps).toBeGreaterThan(10);
    // Le terme intégral a déjà dépassé le poids pendant la seule phase saturée.
    expect(previous).toBeGreaterThan(WEIGHT);
  });
});
