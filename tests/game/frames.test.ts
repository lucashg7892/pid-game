import { describe, expect, it } from 'vitest';
import { bitwiseEqual, mulberry32, runTrip, type TripResult } from './helpers';

/** Découpages d'images à comparer. */
function framings(): [string, () => () => number][] {
  return [
    ['1/30 s', () => () => 1 / 30],
    ['1/60 s', () => () => 1 / 60],
    ['1/144 s', () => () => 1 / 144],
    [
      'irrégulier 7–40 ms',
      () => {
        const rnd = mulberry32(42);
        return () => 0.007 + 0.033 * rnd();
      },
    ],
    [
      'irrégulier + image de 0,5 s toutes les 50 images',
      () => {
        const rnd = mulberry32(7);
        let n = 0;
        return () => (++n % 50 === 0 ? 0.5 : 0.007 + 0.033 * rnd());
      },
    ],
  ];
}

describe('CA-3 : indépendance au découpage en images', () => {
  it.each([800, 2500, 5000, 5100])(
    'Kp = %i : même issue, même pas, même erreur, même trace',
    (kp) => {
      const results: [string, TripResult][] = framings().map(([name, make]) => [
        name,
        runTrip(kp, make()),
      ]);
      const [, ref] = results[0] as [string, TripResult];
      for (const [name, r] of results) {
        expect(r.outcome, name).toBe(ref.outcome);
        expect(r.outcomeK, name).toBe(ref.outcomeK);
        expect(Object.is(r.finalError, ref.finalError), name).toBe(true);
        expect(bitwiseEqual(r.trace, ref.trace), name).toBe(true);
      }
    },
  );

  it('une image de 0,5 s ne casse rien : au plus 8 pas, alpha ∈ [0, 1), état fini', () => {
    const r = runTrip(2500, () => 1 / 60);
    const level = r.level;
    level.restart();
    level.launch();
    const s = level.update(0.5);
    expect(s.k).toBe(8);
    expect(s.alpha).toBeGreaterThanOrEqual(0);
    expect(s.alpha).toBeLessThan(1);
    expect(Number.isFinite(s.cabinY)).toBe(true);
    // Durées pathologiques : comptées pour 0 s.
    for (const bad of [NaN, -1, 0, -Infinity]) {
      expect(level.update(bad).k).toBe(8);
    }
    expect(level.update(Infinity).k).toBe(16);
  });
});
