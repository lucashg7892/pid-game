import { describe, expect, it } from 'vitest';
import { createSaturation, isSaturated, saturate, type Saturation } from '../../src/sim';

/** Bornes de l'actionneur de la tranche verticale (spec §9) : ±5000 N. */
const ACTUATOR: Saturation = createSaturation(-5000, 5000);

describe('saturation', () => {
  it('laisse passer une commande dans les bornes, drapeau faux', () => {
    for (const u of [-5000, -1234.5, -0, 0, 42, 5000]) {
      const uSat = saturate(u, ACTUATOR);
      expect(uSat).toBe(u);
      expect(isSaturated(u, uSat)).toBe(false);
    }
  });

  it('écrête au-delà des bornes, uSat ∈ [−5000, 5000], drapeau vrai', () => {
    expect(saturate(5000.0001, ACTUATOR)).toBe(5000);
    expect(saturate(-7000, ACTUATOR)).toBe(-5000);
    expect(isSaturated(7000, saturate(7000, ACTUATOR))).toBe(true);
    expect(isSaturated(-7000, saturate(-7000, ACTUATOR))).toBe(true);
    for (let u = -20000; u <= 20000; u += 137.5) {
      const uSat = saturate(u, ACTUATOR);
      expect(uSat).toBeGreaterThanOrEqual(-5000);
      expect(uSat).toBeLessThanOrEqual(5000);
      expect(isSaturated(u, uSat)).toBe(Math.abs(u) > 5000);
    }
  });

  it('±Infinity ramené aux bornes, drapeau vrai', () => {
    expect(saturate(Number.POSITIVE_INFINITY, ACTUATOR)).toBe(5000);
    expect(saturate(Number.NEGATIVE_INFINITY, ACTUATOR)).toBe(-5000);
    expect(isSaturated(Number.POSITIVE_INFINITY, 5000)).toBe(true);
  });

  it('NaN : propagé (renvoie NaN), drapeau faux', () => {
    const uSat = saturate(Number.NaN, ACTUATOR);
    expect(Number.isNaN(uSat)).toBe(true);
    expect(isSaturated(Number.NaN, uSat)).toBe(false);
  });

  it('bornes égales : sortie constante', () => {
    const s = createSaturation(3, 3);
    expect(saturate(-10, s)).toBe(3);
    expect(saturate(10, s)).toBe(3);
  });

  it('bornes infinies : aucune limite', () => {
    const s = createSaturation(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    expect(saturate(1e300, s)).toBe(1e300);
  });

  it('min > max ou borne NaN : RangeError (création et littéral non validé)', () => {
    expect(() => createSaturation(1, -1)).toThrow(RangeError);
    expect(() => createSaturation(Number.NaN, 1)).toThrow(RangeError);
    expect(() => createSaturation(0, Number.NaN)).toThrow(RangeError);
    expect(() => saturate(0, { min: 1, max: -1 })).toThrow(RangeError);
  });
});
