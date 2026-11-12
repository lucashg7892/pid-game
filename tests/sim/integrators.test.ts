import { describe, expect, it } from 'vitest';
import { createRk4, type PlantModel } from '../../src/sim';

/** ẋ = −x + u (1 état). */
const decay: PlantModel = {
  stateSize: 1,
  derivative(x, u, out) {
    out[0] = -(x[0] as number) + u;
  },
  output: (x) => x[0] as number,
  constrain: () => undefined,
};

/** Oscillateur harmonique ẍ = −ω²x, état [x, v] ; solution x = cos(ωt), v = −ω sin(ωt). */
function oscillator(omega: number): PlantModel {
  return {
    stateSize: 2,
    derivative(x, _u, out) {
      out[0] = x[1] as number;
      out[1] = -omega * omega * (x[0] as number);
    },
    output: (x) => x[0] as number,
    constrain: () => undefined,
  };
}

/** Erreur max (norme ∞) de RK4 sur l'oscillateur ω = 1 après T = 10 s, x0 = [1, 0]. */
function oscillatorError(dt: number): number {
  const steps = Math.round(10 / dt);
  const rk4 = createRk4(2);
  const plant = oscillator(1);
  const x = new Float64Array([1, 0]);
  for (let k = 0; k < steps; k++) rk4.step(plant, x, 0, dt);
  const t = steps * dt;
  return Math.max(
    Math.abs((x[0] as number) - Math.cos(t)),
    Math.abs((x[1] as number) + Math.sin(t)),
  );
}

describe('intégrateur RK4', () => {
  it('RK4 ẋ = −x, x0 = 1, dt = 0,1, 10 pas : |x − e^{−1}| ≤ 1e-6', () => {
    const rk4 = createRk4(1);
    const x = new Float64Array([1]);
    for (let k = 0; k < 10; k++) rk4.step(decay, x, 0, 0.1);
    const error = Math.abs((x[0] as number) - Math.exp(-1));
    // Erreur locale RK4 ≈ dt⁵/120 ≈ 8e-8 par pas, 10 pas ⇒ ≈ 3e-7 attendu, seuil 1e-6 (spec).
    expect(error).toBeLessThanOrEqual(1e-6);
    expect(error).toBeGreaterThan(0); // vraie approximation, pas une solution exacte cachée
  });

  it('ordre 4 : diviser dt par 2 divise l’erreur par ~16 (oscillateur harmonique)', () => {
    const e1 = oscillatorError(0.1);
    const e2 = oscillatorError(0.05);
    const ratio = e1 / e2;
    // Ordre 4 ⇒ rapport théorique 2⁴ = 16 ; [14, 18] laisse place aux termes d'ordre 5.
    // Les erreurs (≈ 1e-5 et 6e-7) restent très au-dessus de l'arrondi (≈ 1e-15).
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });

  it('commande maintenue constante pendant le pas (bloqueur d’ordre zéro)', () => {
    // ẋ = −x + u, x0 = 0, u = 1 constant : x(t) = 1 − e^{−t}.
    const rk4 = createRk4(1);
    const x = new Float64Array([0]);
    for (let k = 0; k < 120; k++) rk4.step(decay, x, 1, 1 / 120);
    // Erreur globale RK4 ≈ C·dt⁴ ≈ 1e-10 à dt = 1/120 ; marge à 1e-9.
    expect(Math.abs((x[0] as number) - (1 - Math.exp(-1)))).toBeLessThan(1e-9);
  });

  it('n’alloue pas : les mêmes tampons de travail sont réutilisés à chaque pas', () => {
    const seen = new Set<Float64Array>();
    const spy: PlantModel = {
      stateSize: 2,
      derivative(x, _u, out) {
        seen.add(out);
        out[0] = x[1] as number;
        out[1] = -(x[0] as number);
      },
      output: (x) => x[0] as number,
      constrain: () => undefined,
    };
    const rk4 = createRk4(2);
    const x = new Float64Array([1, 0]);
    for (let k = 0; k < 1000; k++) rk4.step(spy, x, 0, 0.01);
    // 4 tampons k1..k4 créés une fois pour toutes, jamais 4 × 1000.
    expect(seen.size).toBe(4);
  });

  it('déterministe : deux exécutions donnent les mêmes bits', () => {
    const run = (): Float64Array => {
      const rk4 = createRk4(2);
      const x = new Float64Array([1, 0]);
      for (let k = 0; k < 1800; k++) rk4.step(oscillator(3), x, 0, 1 / 120);
      return x;
    };
    expect(Array.from(run())).toEqual(Array.from(run()));
  });

  it('n’applique pas constrain (rôle de la boucle)', () => {
    let calls = 0;
    const plant: PlantModel = {
      ...decay,
      constrain: () => {
        calls++;
      },
    };
    createRk4(1).step(plant, new Float64Array([1]), 0, 0.1);
    expect(calls).toBe(0);
  });

  it('dimensions invalides : RangeError', () => {
    expect(() => createRk4(0)).toThrow(RangeError);
    expect(() => createRk4(1.5)).toThrow(RangeError);
    const rk4 = createRk4(2);
    expect(() => {
      rk4.step(oscillator(1), new Float64Array(3), 0, 0.1);
    }).toThrow(RangeError);
    expect(() => {
      rk4.step(decay, new Float64Array(2), 0, 0.1);
    }).toThrow(RangeError);
  });
});
