import { describe, expect, it } from 'vitest';
import {
  MAX_FRAME_SECONDS,
  MAX_STEPS_PER_FRAME,
  SIM_DT,
  createFixedStepClock,
} from '../../src/sim';

/** Fait avancer l'horloge de `frames` images de `frameSeconds` et renvoie le total de pas. */
function totalSteps(
  clock: ReturnType<typeof createFixedStepClock>,
  frameSeconds: number,
  frames: number,
): number {
  let total = 0;
  for (let i = 0; i < frames; i++) total += clock.advance(frameSeconds);
  return total;
}

describe('horloge à pas fixe', () => {
  it('expose les constantes de la spec (dt = 1/120 s, 8 pas, 0,25 s)', () => {
    expect(SIM_DT).toBe(1 / 120);
    expect(MAX_STEPS_PER_FRAME).toBe(8);
    expect(MAX_FRAME_SECONDS).toBe(0.25);
    expect(createFixedStepClock().dt).toBe(SIM_DT);
  });

  it('images de 1/30 s : exactement 4 pas par image, alpha ∈ [0,1)', () => {
    const clock = createFixedStepClock();
    for (let i = 0; i < 300; i++) {
      expect(clock.advance(1 / 30)).toBe(4);
      expect(clock.alpha).toBeGreaterThanOrEqual(0);
      expect(clock.alpha).toBeLessThan(1);
    }
  });

  it('images de 1/60 s : exactement 2 pas par image, alpha ∈ [0,1)', () => {
    const clock = createFixedStepClock();
    for (let i = 0; i < 600; i++) {
      expect(clock.advance(1 / 60)).toBe(2);
      expect(clock.alpha).toBeGreaterThanOrEqual(0);
      expect(clock.alpha).toBeLessThan(1);
    }
  });

  it('images de 1/144 s : motif 0,1,1,1,1,1 (5 pas pour 6 images), alpha ∈ [0,1)', () => {
    const clock = createFixedStepClock();
    for (let cycle = 0; cycle < 240; cycle++) {
      const pattern: number[] = [];
      for (let i = 0; i < 6; i++) {
        pattern.push(clock.advance(1 / 144));
        expect(clock.alpha).toBeGreaterThanOrEqual(0);
        expect(clock.alpha).toBeLessThan(1);
      }
      expect(pattern).toEqual([0, 1, 1, 1, 1, 1]);
    }
    // alpha suit la fraction de pas : après 1 image de 1/144 s, 120/144 = 5/6 de pas.
    const fresh = createFixedStepClock();
    fresh.advance(1 / 144);
    // Tolérance 1e-12 : une seule division flottante, erreur ≈ 1e-16.
    expect(Math.abs(fresh.alpha - 5 / 6)).toBeLessThan(1e-12);
  });

  it('à-coup de 0,5 s : plafonné à 8 pas, le surplus est jeté', () => {
    const clock = createFixedStepClock();
    expect(clock.advance(0.5)).toBe(MAX_STEPS_PER_FRAME);
    expect(clock.alpha).toBeGreaterThanOrEqual(0);
    expect(clock.alpha).toBeLessThan(1);
    // Le surplus (30 − 8 = 22 pas) ne ressort pas à l'image suivante.
    expect(clock.advance(1 / 60)).toBe(2);
  });

  it('plafond de 8 pas atteint mais non dépassé : 1/15 s → 8, 0,1 s → 8', () => {
    const clock = createFixedStepClock();
    expect(clock.advance(1 / 15)).toBe(8);
    expect(clock.advance(0.1)).toBe(8);
  });

  it('plafond configurable et durée bornée à 0,25 s même sans plafond de pas', () => {
    const clock = createFixedStepClock(SIM_DT, 1000);
    // 10 s demandées → 0,25 s prises en compte → 30 pas.
    expect(clock.advance(10)).toBe(30);
  });

  it('durées négatives, nulles ou NaN : 0 pas, accumulateur inchangé', () => {
    const clock = createFixedStepClock();
    clock.advance(1 / 240); // demi-pas en attente
    const before = clock.alpha;
    expect(clock.advance(-1)).toBe(0);
    expect(clock.advance(0)).toBe(0);
    expect(clock.advance(Number.NaN)).toBe(0);
    expect(clock.alpha).toBe(before);
  });

  it('reset vide l’accumulateur', () => {
    const clock = createFixedStepClock();
    clock.advance(1 / 240);
    expect(clock.alpha).toBeGreaterThan(0);
    clock.reset();
    expect(clock.alpha).toBe(0);
    expect(clock.advance(1 / 240)).toBe(0);
  });

  it('10 s en images de 1/60 puis de 1/144 : même total à ±1, sans dérive', () => {
    const a = createFixedStepClock();
    const b = createFixedStepClock();
    let stepsA = 0;
    let stepsB = 0;
    // Contrôle à chaque seconde : aucun écart ne doit croître avec le temps (dérive).
    for (let second = 1; second <= 10; second++) {
      stepsA += totalSteps(a, 1 / 60, 60);
      stepsB += totalSteps(b, 1 / 144, 144);
      expect(Math.abs(stepsA - 120 * second)).toBeLessThanOrEqual(1);
      expect(Math.abs(stepsB - 120 * second)).toBeLessThanOrEqual(1);
      expect(Math.abs(stepsA - stepsB)).toBeLessThanOrEqual(1);
    }
    // Valeur mesurée : 1200 pas exactement des deux côtés.
    expect(stepsA).toBe(1200);
    expect(stepsB).toBe(1200);
  });

  it('sans dérive sur 1 h simulée en images de 1/144 s', () => {
    const clock = createFixedStepClock();
    expect(totalSteps(clock, 1 / 144, 144 * 3600)).toBe(120 * 3600);
  });

  it('paramètres invalides : RangeError', () => {
    expect(() => createFixedStepClock(0)).toThrow(RangeError);
    expect(() => createFixedStepClock(-1)).toThrow(RangeError);
    expect(() => createFixedStepClock(Number.NaN)).toThrow(RangeError);
    expect(() => createFixedStepClock(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => createFixedStepClock(SIM_DT, 0)).toThrow(RangeError);
    expect(() => createFixedStepClock(SIM_DT, 2.5)).toThrow(RangeError);
  });
});
