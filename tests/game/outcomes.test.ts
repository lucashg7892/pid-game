import { describe, expect, it } from 'vitest';
import {
  BEAM_HEIGHT,
  CABIN_WEIGHT,
  KP_DEFAULT,
  KP_MAX,
  KP_STEP,
  NO_LIFT_KP_THRESHOLD,
  STEP_TOLERANCE,
  TRIP_MAX_STEPS,
  WIN_HOLD_STEPS,
  createLevel1,
  type TripOutcome,
} from '../../src/game';
import { ELEVATOR_POSITION, createElevatorLoop } from '../../src/sim';
import { finishTrip, reachConsole, runTrip } from './helpers';

/** Pic des échantillons y(k·dt) sur `steps` pas, boucle du noyau seule (sans arbitre). */
function sampledPeak(kp: number, steps = TRIP_MAX_STEPS): number {
  const loop = createElevatorLoop({ kp });
  let peak = 0;
  for (let k = 0; k < steps; k++) {
    loop.step();
    peak = Math.max(peak, loop.x[ELEVATOR_POSITION] as number);
  }
  return peak;
}

describe('CA-1 : issues de la spec §11', () => {
  const cases: [number, TripOutcome][] = [
    [150, 'noLift'],
    [KP_DEFAULT, 'win'],
    [800, 'step'],
    [2500, 'win'],
    [3500, 'win'],
    [4500, 'win'],
    [7000, 'bonk'],
  ];
  it.each(cases)('Kp = %i → %s', (kp, expected) => {
    expect(runTrip(kp).outcome).toBe(expected);
  });
});

describe("CA-2 : pas d'issue exacts (convention : état après chaque pas, k = pas exécutés)", () => {
  const cases: [number, TripOutcome, number][] = [
    [1000, 'win', 267],
    [2500, 'win', 291],
    [3500, 'win', 278],
    [3800, 'win', 273],
    [4000, 'win', 301],
    [5000, 'win', 293],
    [5100, 'bonk', 61],
    [7000, 'bonk', 56],
    [KP_DEFAULT, 'win', 262],
    [100, 'noLift', TRIP_MAX_STEPS],
    [150, 'noLift', TRIP_MAX_STEPS],
    [200, 'step', TRIP_MAX_STEPS],
    [800, 'step', TRIP_MAX_STEPS],
    [900, 'step', TRIP_MAX_STEPS],
  ];
  it.each(cases)('Kp = %i → %s au pas %i', (kp, outcome, step) => {
    const r = runTrip(kp);
    expect(r.outcome).toBe(outcome);
    expect(r.outcomeK).toBe(step);
  });

  it('borne haute de la fenêtre figée (T-020) : 5000 gagne, 5100 se cogne', () => {
    const at5000 = runTrip(5000);
    const at5100 = runTrip(5100);
    expect(at5000.outcome).toBe('win');
    expect(at5100.outcome).toBe('bonk');
    // Le maximum de 5000 reste sous la poutre : la victoire n'est pas un accident d'ordre.
    expect(Math.max(...at5000.trace)).toBeLessThan(BEAM_HEIGHT);
    expect(at5100.finalY).toBeGreaterThan(BEAM_HEIGHT);
  });

  it('borne basse de la fenêtre figée (T-020) : 1000 gagne, 900 reste trop court', () => {
    expect(runTrip(1000).outcome).toBe('win');
    const at900 = runTrip(900);
    expect(at900.outcome).toBe('step');
    expect(at900.finalError as number).toBeGreaterThan(STEP_TOLERANCE);
  });
});

describe('fenêtre complète du niveau 1 (T-020) : ne doit pas dériver en silence', () => {
  it('balayage 0 → 8000 par pas de 100 : noLift, step, win contigu [1000 ; 5000], bonk', () => {
    expect(NO_LIFT_KP_THRESHOLD).toBeCloseTo(163.5, 12);
    const ranges: string[] = [];
    let start = 0;
    let current: TripOutcome | null = null;
    let slowestWin = 0;
    for (let kp = 0; kp <= KP_MAX; kp += KP_STEP) {
      const r = runTrip(kp);
      expect(r.outcome === 'win').toBe(kp >= 1000 && kp <= 5000);
      expect(r.outcome === 'noLift').toBe(kp <= 100);
      if (r.outcome === 'bonk') expect(r.finalY).toBeGreaterThan(BEAM_HEIGHT);
      if (r.outcome === 'win') slowestWin = Math.max(slowestWin, r.outcomeK as number);
      if (r.outcome !== current) {
        if (current !== null) ranges.push(`${String(start)}-${String(kp - KP_STEP)}:${current}`);
        current = r.outcome;
        start = kp;
      }
    }
    ranges.push(`${String(start)}-${String(KP_MAX)}:${String(current)}`);
    expect(ranges.join(' | ')).toBe('0-100:noLift | 200-900:step | 1000-5000:win | 5100-8000:bonk');
    // Victoire la plus lente (Kp = 4000 et 4100) : 301 pas, maintien de 1 s compris, soit
    // 899 pas (7,5 s) de marge avant la fin de temps (1200 pas, 10 s, D27).
    expect(TRIP_MAX_STEPS).toBe(1200);
    expect(slowestWin).toBe(301);
    expect(TRIP_MAX_STEPS - slowestWin).toBe(899);
    expect(slowestWin).toBeGreaterThan(WIN_HOLD_STEPS);
  });

  it('marges de la borne haute : 1,74 mm sous la poutre à 5000, 1,79 mm au-dessus à 5100', () => {
    const peak5000 = sampledPeak(5000);
    const peak5100 = sampledPeak(5100);
    expect(peak5000).toBeCloseTo(3.360855, 6);
    expect(peak5100).toBeCloseTo(3.364391, 6);
    // Marges en mm, au centième de millimètre : toutes deux positives.
    expect(1000 * (BEAM_HEIGHT - peak5000)).toBeCloseTo(1.74, 2);
    expect(1000 * (peak5100 - BEAM_HEIGHT)).toBeCloseTo(1.79, 2);
  });

  it('Kp par défaut (2000, D28) dans la fenêtre : un lancement sans réglage gagne', () => {
    expect(KP_DEFAULT).toBe(2000);
    expect(KP_DEFAULT % KP_STEP).toBe(0);
    expect(KP_DEFAULT).toBeGreaterThanOrEqual(1000);
    expect(KP_DEFAULT).toBeLessThanOrEqual(5000);
    const level = createLevel1();
    expect(level.snapshot.kp).toBe(KP_DEFAULT);
    reachConsole(level);
    const r = finishTrip(level);
    expect(r.outcome).toBe('win');
    expect(r.outcomeK).toBe(262);
  });

  it('marge de la borne basse : m·g/1000 = 0,4905 m, 9,5 mm sous la tolérance de 0,5 m', () => {
    expect(STEP_TOLERANCE).toBe(0.5);
    expect(1000 * (STEP_TOLERANCE - CABIN_WEIGHT / 1000)).toBeCloseTo(9.5, 6);
    expect(CABIN_WEIGHT / 900).toBeGreaterThan(STEP_TOLERANCE);
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

  it('erreur finale en échec : marche de 0,613 m à Kp = 800 (m·g/Kp)', () => {
    const r = runTrip(800);
    expect(r.outcome).toBe('step');
    expect(r.finalError as number).toBeCloseTo(0.613125, 6);
    expect(Math.abs((r.finalError as number) - CABIN_WEIGHT / 800)).toBeLessThanOrEqual(1e-6);
  });
});
