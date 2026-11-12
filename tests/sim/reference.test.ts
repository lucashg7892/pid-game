/**
 * Valeurs de référence de non-régression de la configuration de jeu (spec T-001 §5) :
 * saturation ±5000 N active, dt = 1/120 s, cabine au sol, consigne 3 m. y(k) désigne la
 * hauteur après k pas, soit y(k·dt). Valeurs issues du script Python du concepteur, à 1e-6 m.
 */
import { describe, expect, it } from 'vitest';
import { ELEVATOR_MAX_FORCE, createElevatorLoop } from '../../src/sim';

/** Tolérance de la spec (m). */
const TOLERANCE = 1e-6;
/** Horizon de comptage de y_max et des pas saturés (s) : 10 s, comme l'oracle. */
const HORIZON_STEPS = 1200;
/** Pas auxquels y est relevé. */
const CHECKPOINTS = [60, 120, 240, 600] as const;

interface Reference {
  readonly kp: number;
  /** y aux pas CHECKPOINTS (m). */
  readonly y: readonly [number, number, number, number];
  readonly yMax: number;
  readonly saturatedSteps: number;
}

/** Tableau de la spec §5 (copié tel quel). */
const REFERENCES: readonly Reference[] = [
  { kp: 1500, y: [2.430138, 2.747366, 2.671735, 2.673], yMax: 2.776872, saturatedSteps: 0 },
  { kp: 2500, y: [3.033662, 2.784761, 2.804005, 2.8038], yMax: 3.116315, saturatedSteps: 23 },
  { kp: 3500, y: [3.236641, 2.782849, 2.858821, 2.859857], yMax: 3.266902, saturatedSteps: 30 },
  { kp: 4500, y: [3.32914, 2.825564, 2.892738, 2.891], yMax: 3.338958, saturatedSteps: 34 },
];

describe('valeurs de référence de jeu (spec §5, saturation ±5000 N)', () => {
  it('la saturation de jeu vaut ±5000 N', () => {
    expect(ELEVATOR_MAX_FORCE).toBe(5000);
  });

  it.each(REFERENCES)('Kp = $kp', (ref) => {
    const loop = createElevatorLoop({ kp: ref.kp });
    const ys = new Float64Array(HORIZON_STEPS + 1);
    let saturatedSteps = 0;
    let yMax = 0;
    for (let k = 1; k <= HORIZON_STEPS; k++) {
      const s = loop.step();
      expect(Math.abs(s.uSat)).toBeLessThanOrEqual(ELEVATOR_MAX_FORCE);
      if (s.saturated) saturatedSteps++;
      ys[k] = s.x[0] as number;
      yMax = Math.max(yMax, ys[k] as number);
    }
    const measured = CHECKPOINTS.map((k) => ys[k] as number);
    const gaps = [
      ...measured.map((v, i) => Math.abs(v - (ref.y[i] as number))),
      Math.abs(yMax - ref.yMax),
    ];
    console.info(
      `REF Kp=${String(ref.kp)} y(60,120,240,600)=${measured.map((v) => v.toFixed(9)).join(', ')} ` +
        `y_max=${yMax.toFixed(9)} saturés=${String(saturatedSteps)} écart_max=${Math.max(...gaps).toExponential(2)}`,
    );
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(TOLERANCE);
    expect(saturatedSteps).toBe(ref.saturatedSteps);
  });
});
