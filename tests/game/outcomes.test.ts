import { describe, expect, it } from 'vitest';
import {
  CABIN_WEIGHT,
  KP_MAX,
  KP_STEP,
  NO_LIFT_KP_THRESHOLD,
  TRIP_MAX_STEPS,
  type TripOutcome,
} from '../../src/game';
import { runTrip } from './helpers';

describe('CA-1 : issues de la spec §11', () => {
  const cases: [number, TripOutcome][] = [
    [150, 'noLift'],
    [1500, 'step'],
    [2500, 'win'],
    [3500, 'win'],
    [4500, 'bonk'],
  ];
  it.each(cases)('Kp = %i → %s', (kp, expected) => {
    expect(runTrip(kp).outcome).toBe(expected);
  });
});

describe("CA-2 : pas d'issue exacts (convention : état après chaque pas, k = pas exécutés)", () => {
  const cases: [number, TripOutcome, number][] = [
    [2500, 'win', 291],
    [3500, 'win', 278],
    [3800, 'win', 273],
    [3900, 'bonk', 63],
    [4500, 'bonk', 58],
    [150, 'noLift', TRIP_MAX_STEPS],
    [1500, 'step', TRIP_MAX_STEPS],
  ];
  it.each(cases)('Kp = %i → %s au pas %i', (kp, outcome, step) => {
    const r = runTrip(kp);
    expect(r.outcome).toBe(outcome);
    expect(r.outcomeK).toBe(step);
  });

  it('borne haute de la fenêtre figée (D-11) : 3800 gagne, 3900 se cogne', () => {
    const at3800 = runTrip(3800);
    const at3900 = runTrip(3900);
    expect(at3800.outcome).toBe('win');
    expect(at3900.outcome).toBe('bonk');
    // Le maximum de 3800 reste sous la poutre : la victoire n'est pas un accident d'ordre.
    expect(Math.max(...at3800.trace)).toBeLessThan(3.3);
    expect(at3900.finalY).toBeGreaterThan(3.3);
  });

  it('balayage 0 → 8000 par pas de 100 : win ⇔ 2000 ≤ Kp ≤ 3800, noLift ⇔ Kp ≤ 100', () => {
    expect(NO_LIFT_KP_THRESHOLD).toBeCloseTo(163.5, 12);
    const ranges: string[] = [];
    let start = 0;
    let current: TripOutcome | null = null;
    for (let kp = 0; kp <= KP_MAX; kp += KP_STEP) {
      const r = runTrip(kp);
      expect(r.outcome === 'win').toBe(kp >= 2000 && kp <= 3800);
      expect(r.outcome === 'noLift').toBe(kp <= 100);
      if (r.outcome === 'bonk') expect(r.finalY).toBeGreaterThan(3.3);
      if (r.outcome !== current) {
        if (current !== null) ranges.push(`${String(start)}-${String(kp - KP_STEP)}:${current}`);
        current = r.outcome;
        start = kp;
      }
    }
    ranges.push(`${String(start)}-${String(KP_MAX)}:${String(current)}`);
    expect(ranges.join(' | ')).toBe(
      '0-100:noLift | 200-1900:step | 2000-3800:win | 3900-8000:bonk',
    );
  });
});

describe('CA-7 : erreur finale mesurée à la victoire ≈ m·g/Kp (1e-3 m)', () => {
  it.each([2000, 2500, 3000, 3800])('Kp = %i', (kp) => {
    const r = runTrip(kp);
    expect(r.outcome).toBe('win');
    expect(r.finalError).not.toBeNull();
    expect(Math.abs((r.finalError as number) - CABIN_WEIGHT / kp)).toBeLessThanOrEqual(1e-3);
    expect(r.level.snapshot.theoreticalError).toBe(CABIN_WEIGHT / kp);
  });

  it('erreur finale en échec : marche de 0,327 m à Kp = 1500 (spec §5)', () => {
    const r = runTrip(1500);
    expect(r.finalError as number).toBeCloseTo(0.327, 6);
  });
});
